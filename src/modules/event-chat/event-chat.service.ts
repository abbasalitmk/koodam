import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class EventChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async getEventConversation(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        conversation: {
          include: {
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
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (!event.conversation) throw new NotFoundException('Event chat has not been initialized');

    const member = event.conversation.members.find((m) => m.userId === userId && m.leftAt === null);
    if (!member) {
      throw new ForbiddenException('You must join this gathering to enter the community chat.');
    }

    return {
      conversationId: event.conversation.id,
      eventId: event.id,
      eventTitle: event.title,
      memberCount: event.conversation.members.filter((m) => m.leftAt === null).length,
      isOrganizer: event.organizerId === userId,
      members: event.conversation.members.map((m) => ({
        userId: m.userId,
        displayName: m.user.profile?.displayName ?? 'Member',
        avatarUrl: m.user.photos[0]?.url ?? null,
        isAdmin: m.isAdmin,
      })),
    };
  }

  async postAnnouncement(organizerId: string, eventId: string, content: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerId },
      include: { conversation: true },
    });

    if (!event) throw new ForbiddenException('Only the host can post announcements to the community.');
    if (!event.conversation) throw new NotFoundException('Conversation not found');

    return this.messagesService.sendMessage(organizerId, event.conversation.id, {
      content: `📢 HOST ANNOUNCEMENT:\n${content}`,
      type: 'ANNOUNCEMENT' as any,
    });
  }
}
