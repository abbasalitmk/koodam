import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export type AuthenticatedSocket = Socket & { data: { user?: AuthenticatedUser } };

/**
 * Socket handshakes are authenticated once in the gateway's `handleConnection`;
 * this guard simply refuses any event that arrives on an unauthenticated socket,
 * which is what stops a client from spoofing `senderId` in a payload.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    return Boolean(client.data?.user?.id);
  }
}
