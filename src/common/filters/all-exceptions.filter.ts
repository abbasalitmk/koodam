import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorCode } from '../utils/error-codes';

interface NormalisedError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

/**
 * Single exit point for errors. Guarantees the documented error envelope and,
 * critically, never leaks stack traces, SQL, or Prisma internals to a client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const normalised = this.normalise(exception);

    if (normalised.status >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId: request.requestId,
          path: request.originalUrl,
          message: normalised.message,
        }),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(normalised.status).json({
      success: false,
      error: {
        code: normalised.code,
        message: normalised.message,
        ...(normalised.details ? { details: normalised.details } : {}),
      },
    });
  }

  private normalise(exception: unknown): NormalisedError {
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: ErrorCode.RATE_LIMITED,
        message: 'Too many requests. Please slow down and try again shortly.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'object' && payload !== null) {
        const body = payload as {
          code?: string;
          message?: string | string[];
          details?: Record<string, string[]>;
          error?: string;
        };

        // class-validator produces `message: string[]`
        if (Array.isArray(body.message)) {
          return {
            status,
            code: ErrorCode.VALIDATION_FAILED,
            message: body.message[0] ?? 'Request validation failed',
            details: { fields: body.message },
          };
        }

        return {
          status,
          code: body.code ?? this.codeForStatus(status),
          message: body.message ?? exception.message,
          details: body.details,
        };
      }

      return { status, code: this.codeForStatus(status), message: String(payload) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong. Please try again.',
    };
  }

  private fromPrisma(error: Prisma.PrismaClientKnownRequestError): NormalisedError {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: 'That record already exists.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
          message: 'The requested record was not found.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'A referenced record does not exist.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'A database error occurred.',
        };
    }
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_FAILED;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 429:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
