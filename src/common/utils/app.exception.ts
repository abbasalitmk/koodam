import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeValue } from './error-codes';

/**
 * Domain error carrying a stable `code` alongside the HTTP status, so clients can
 * branch on behaviour without string-matching human-readable messages.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCodeValue,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: Record<string, string[]>,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(entity: string, code: ErrorCodeValue = 'NOT_FOUND' as ErrorCodeValue) {
    return new AppException(code, `${entity} not found`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new AppException('FORBIDDEN' as ErrorCodeValue, message, HttpStatus.FORBIDDEN);
  }

  static conflict(code: ErrorCodeValue, message: string) {
    return new AppException(code, message, HttpStatus.CONFLICT);
  }

  static badRequest(code: ErrorCodeValue, message: string) {
    return new AppException(code, message, HttpStatus.BAD_REQUEST);
  }
}
