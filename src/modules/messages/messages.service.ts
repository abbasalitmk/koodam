import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MessagePermission, MessageType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrivacyService } from '../privacy/privacy.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { CreateDirectConversationDto, MessagePaginationQueryDto, SendMessageDto } from './dto/messages.dto';

const MALAYALI_ICEBREAKERS = [
  'Sulaimani or Filter Coffee on a rainy evening?',
  'Appam with vegetable stew or spicy chicken roast?',
  'Favourite monsoon road trip in Kerala: Wayanad, Munnar, or Vagamon?',
  'Paragon Biryani in Kozhikode or Kayees Rahmathulla in Kochi?',
  'Best indie music track currently on your loop?',
  'A sunset stroll on Fort Kochi beach or Kozhikode beach with pickled fruit?',
  'What is your go-to Sunday morning ritual?',
];

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly privacy: PrivacyService,
  ) {}

  getIcebreakers() {
    return MALAYALI_ICEBREAKERS;
  }

  async listConversations(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, leftAt: null },
      include: {
        conversation: {
          include: {
            event: { select: { id: true, title: true, coverImage: true } },
            members: {
              include: {
                user: {
                  include: {
                    profile: { select: { displayName: true } },
                    photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
                  },
                },
              },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    return memberships.map((m) => {
      const conv = m.conversation;
      const lastMsg = conv.messages[0] ?? null;

      let title = conv.title;
      let avatarUrl: string | null = null;
      let peerUserId: string | null = null;

      if (conv.type === 'DIRECT') {
        const peer = conv.members.find((mem) => mem.userId !== userId);
        if (peer) {
          title = peer.user.profile?.displayName ?? 'Koodam member';
          avatarUrl = peer.user.photos[0]?.url ?? null;
          peerUserId = peer.userId;
        }
      } else if (conv.type === 'EVENT_GROUP' && conv.event) {
        title = conv.event.title;
        avatarUrl = conv.event.coverImage;
      }

      return {
        conversationId: conv.id,
        type: conv.type,
        title,
        avatarUrl,
        peerUserId,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content,
              senderId: lastMsg.senderId,
              createdAt: lastMsg.createdAt,
              type: lastMsg.type,
            }
          : null,
        unreadCount: 0, // calculated from lastReadAt in frontend
        lastReadAt: m.lastReadAt,
        createdAt: conv.createdAt,
        lastMessageAt: conv.lastMessageAt,
      };
    });
  }

  async getMessages(userId: string, conversationId: string, query: MessagePaginationQueryDto) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member || member.leftAt !== null) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }

    const limit = query.limit ?? 30;
    const where: any = { conversationId, deletedAt: null };

    if (query.cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        sender: {
          select: {
            id: true,
            profile: { select: { displayName: true } },
            photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items: items.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderName: msg.sender?.profile?.displayName ?? 'Member',
        senderAvatar: msg.sender?.photos[0]?.url ?? null,
        content: msg.content,
        type: msg.type,
        mediaUrl: msg.mediaUrl,
        isIcebreaker: msg.isIcebreaker,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      })),
      nextCursor,
      hasMore,
    };
  }

  async createDirectConversation(userId: string, dto: CreateDirectConversationDto) {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('You cannot create a conversation with yourself.');
    }

    await this.blocks.assertNotBlocked(userId, dto.targetUserId);

    const [userAId, userBId] = [userId, dto.targetUserId].sort();
    const directKey = `${userAId}:${userBId}`;

    const conversation = await this.prisma.conversation.upsert({
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

    return conversation;
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: { conversation: { include: { members: true } } },
    });

    if (!member || member.leftAt !== null) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }

    // If direct conversation, verify permissions and block state
    if (member.conversation.type === 'DIRECT') {
      const peer = member.conversation.members.find((m) => m.userId !== userId);
      if (peer) {
        await this.blocks.assertNotBlocked(userId, peer.userId);

        const peerPrivacy = await this.privacy.get(peer.userId);
        if (peerPrivacy.allowMessages === MessagePermission.NOBODY) {
          throw new AppException(ErrorCode.FORBIDDEN, 'This user is not accepting direct messages', 403);
        }

        if (peerPrivacy.allowMessages === MessagePermission.CONNECTIONS_ONLY) {
          const [u1, u2] = [userId, peer.userId].sort();
          const conn = await this.prisma.connection.findUnique({
            where: { userAId_userBId: { userAId: u1, userBId: u2 } },
          });
          if (!conn || conn.status !== 'ACTIVE') {
            throw new AppException(
              ErrorCode.FORBIDDEN,
              'Direct messaging requires a mutual connection with this member',
              403,
            );
          }
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: dto.content,
          type: dto.type ?? MessageType.TEXT,
          mediaUrl: dto.mediaUrl,
          isIcebreaker: dto.isIcebreaker ?? false,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      return msg;
    });
  }

  async markAsRead(userId: string, conversationId: string) {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.conversationMember.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: now },
      }),
      this.prisma.message.updateMany({
        where: { conversationId, senderId: { not: userId }, readAt: null },
        data: { readAt: now },
      }),
    ]);

    return { read: true, readAt: now };
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, senderId: userId },
    });
    if (!message) throw AppException.notFound('Message');

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { deleted: true, messageId };
  }
}
