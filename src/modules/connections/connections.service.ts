import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionOrigin, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { calculateAge } from '../../common/utils/date.util';
import { CreateConnectionDto } from './dto/connections.dto';

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  async listConnections(userId: string) {
    const rows = await this.prisma.connection.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: ConnectionStatus.ACTIVE,
      },
      include: {
        userA: {
          include: {
            profile: true,
            photos: { where: { isPrimary: true }, take: 1 },
          },
        },
        userB: {
          include: {
            profile: true,
            photos: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((r) => {
      const peer = r.userAId === userId ? r.userB : r.userA;
      return {
        connectionId: r.id,
        peerId: peer.id,
        displayName: peer.profile?.displayName ?? 'Koodam member',
        age: peer.profile?.dateOfBirth ? calculateAge(peer.profile.dateOfBirth) : null,
        gender: peer.profile?.gender,
        city: peer.profile?.city,
        homeDistrict: peer.profile?.homeDistrict,
        avatarUrl: peer.photos[0]?.url ?? null,
        origin: r.origin,
        sharedEventId: r.sharedEventId,
        connectedAt: r.createdAt,
      };
    });
  }

  async createConnection(userId: string, dto: CreateConnectionDto) {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('You cannot connect with yourself.');
    }

    await this.blocks.assertNotBlocked(userId, dto.targetUserId);

    const [userAId, userBId] = [userId, dto.targetUserId].sort();
    const directKey = `${userAId}:${userBId}`;

    return this.prisma.$transaction(async (tx) => {
      const connection = await tx.connection.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {
          status: ConnectionStatus.ACTIVE,
          origin: dto.origin ?? ConnectionOrigin.CONNECT_FRIEND,
          sharedEventId: dto.sharedEventId,
        },
        create: {
          userAId,
          userBId,
          origin: dto.origin ?? ConnectionOrigin.CONNECT_FRIEND,
          status: ConnectionStatus.ACTIVE,
          sharedEventId: dto.sharedEventId,
        },
      });

      // Ensure 1:1 direct conversation exists
      await tx.conversation.upsert({
        where: { directKey },
        update: {},
        create: {
          type: 'DIRECT',
          directKey,
          members: {
            create: [{ userId: userAId }, { userId: userBId }],
          },
        },
      });

      return { connected: true, connection };
    });
  }

  async removeConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || (connection.userAId !== userId && connection.userBId !== userId)) {
      throw new NotFoundException('Connection not found.');
    }

    await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.REMOVED },
    });

    return { removed: true, connectionId };
  }
}
