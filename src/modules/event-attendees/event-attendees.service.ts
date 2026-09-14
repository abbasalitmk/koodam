import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendeeStatus, Gender, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { calculateAge } from '../../common/utils/date.util';
import { CheckInPassDto, JoinEventDto } from './dto/attendees.dto';

@Injectable()
export class EventAttendeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  async joinEvent(userId: string, eventId: string, dto: JoinEventDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gender: true, isProfileComplete: true, displayName: true },
    });

    if (!profile || !profile.isProfileComplete) {
      throw new AppException(
        ErrorCode.PROFILE_INCOMPLETE,
        'Please complete your profile before joining gatherings',
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Row lock on event to guarantee strict atomic capacity & 50:50 ratio
      const events = await tx.$queryRaw<Array<{
        id: string;
        max_attendees: number | null;
        attendee_count: number;
        gender_balance_enforced: boolean;
        female_count: number;
        male_count: number;
        status: string;
        organizer_id: string;
      }>>`
        SELECT id, max_attendees, attendee_count, gender_balance_enforced,
               female_count, male_count, status, organizer_id
          FROM events
         WHERE id = ${eventId}::uuid
           FOR UPDATE
      `;

      const event = events[0];
      if (!event) throw new NotFoundException('Event not found');

      if (event.status === 'CANCELLED') {
        throw new BadRequestException('This gathering has been cancelled.');
      }

      const existingAttendee = await tx.eventAttendee.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (existingAttendee && existingAttendee.status === AttendeeStatus.CONFIRMED) {
        throw new ConflictException('You are already confirmed for this gathering.');
      }

      if (event.max_attendees && event.attendee_count >= event.max_attendees) {
        throw new BadRequestException('This gathering has reached its maximum capacity limit.');
      }

      const userGender = profile.gender;
      let updateGenderField: Prisma.EventUpdateInput = {};

      if (event.gender_balance_enforced && event.max_attendees) {
        const halfCapacity = Math.ceil(event.max_attendees / 2);

        if (userGender === Gender.MALE && event.male_count >= halfCapacity) {
          throw new BadRequestException(
            'Male reservation spots are currently full to preserve 50:50 social equilibrium.',
          );
        }

        if (userGender === Gender.FEMALE && event.female_count >= halfCapacity) {
          throw new BadRequestException(
            'Female reservation spots are currently full to preserve 50:50 social equilibrium.',
          );
        }

        if (userGender === Gender.MALE) {
          updateGenderField = { maleCount: { increment: 1 } };
        } else if (userGender === Gender.FEMALE) {
          updateGenderField = { femaleCount: { increment: 1 } };
        }
      }

      const qrPassCode = `KD-${Math.floor(1000 + Math.random() * 9000)}`;

      const attendee = await tx.eventAttendee.upsert({
        where: { eventId_userId: { eventId, userId } },
        update: {
          status: AttendeeStatus.CONFIRMED,
          qrPassCode,
          openToConnect: dto.openToConnect ?? true,
          joinedAt: new Date(),
        },
        create: {
          eventId,
          userId,
          status: AttendeeStatus.CONFIRMED,
          qrPassCode,
          openToConnect: dto.openToConnect ?? true,
        },
      });

      await tx.event.update({
        where: { id: eventId },
        data: {
          attendeeCount: { increment: 1 },
          ...updateGenderField,
        },
      });

      // Join event group chat if one exists
      const conversation = await tx.conversation.findUnique({
        where: { eventId },
      });

      if (conversation) {
        await tx.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conversation.id, userId } },
          update: { leftAt: null },
          create: {
            conversationId: conversation.id,
            userId,
          },
        });
      }

      return {
        confirmed: true,
        qrPassCode,
        attendee,
        message: 'Pass confirmed! Show your QR code at the gathering entrance.',
      };
    });
  }

  async leaveEvent(userId: string, eventId: string) {
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!attendee || attendee.status !== AttendeeStatus.CONFIRMED) {
      throw new BadRequestException('You are not attending this gathering.');
    }

    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gender: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.eventAttendee.update({
        where: { id: attendee.id },
        data: { status: AttendeeStatus.CANCELLED },
      });

      let genderDecrement: Prisma.EventUpdateInput = {};
      if (userProfile?.gender === Gender.MALE) {
        genderDecrement = { maleCount: { decrement: 1 } };
      } else if (userProfile?.gender === Gender.FEMALE) {
        genderDecrement = { femaleCount: { decrement: 1 } };
      }

      await tx.event.update({
        where: { id: eventId },
        data: {
          attendeeCount: { decrement: 1 },
          ...genderDecrement,
        },
      });

      // Leave event chat
      const conversation = await tx.conversation.findUnique({ where: { eventId } });
      if (conversation) {
        await tx.conversationMember.updateMany({
          where: { conversationId: conversation.id, userId },
          data: { leftAt: new Date() },
        });
      }
    });

    return { cancelled: true, eventId };
  }

  async saveEvent(userId: string, eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.savedEvent.upsert({
        where: { userId_eventId: { userId, eventId } },
        update: {},
        create: { userId, eventId },
      });
      await tx.event.update({
        where: { id: eventId },
        data: { saveCount: { increment: 1 } },
      });
    });
    return { saved: true, eventId };
  }

  async unsaveEvent(userId: string, eventId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.savedEvent.deleteMany({
        where: { userId, eventId },
      });
      await tx.event.update({
        where: { id: eventId },
        data: { saveCount: { decrement: 1 } },
      });
    });
    return { saved: false, eventId };
  }

  async getAttendees(eventId: string, viewerId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { allowAttendeeDiscovery: true, organizerId: true },
    });

    if (!event) throw new NotFoundException('Event not found');

    const blockedIds = await this.blocks.relatedIds(viewerId);

    const rows = await this.prisma.eventAttendee.findMany({
      where: {
        eventId,
        status: AttendeeStatus.CONFIRMED,
        userId: { notIn: blockedIds },
      },
      include: {
        user: {
          include: {
            profile: true,
            privacySettings: true,
            photos: { where: { isPrimary: true, status: 'ACTIVE' }, take: 1 },
          },
        },
      },
    });

    return rows
      .filter((row) => {
        const p = row.user.profile;
        const s = row.user.privacySettings;
        if (!p) return false;
        // If private mode is enabled and user is not viewer or host
        if (s?.privateMode && row.userId !== viewerId && row.userId !== event.organizerId) {
          return false;
        }
        return true;
      })
      .map((row) => ({
        userId: row.userId,
        displayName: row.user.profile?.displayName ?? 'Koodam member',
        age: row.user.profile?.dateOfBirth ? calculateAge(row.user.profile.dateOfBirth) : null,
        gender: row.user.profile?.gender,
        avatarUrl: row.user.photos[0]?.url ?? null,
        isOrganizer: row.isOrganizer,
        openToConnect: row.openToConnect,
        joinedAt: row.joinedAt,
      }));
  }

  async checkInAttendee(organizerId: string, eventId: string, dto: CheckInPassDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerId },
    });
    if (!event) throw new BadRequestException('Only the gathering organizer can check in passes.');

    const attendee = await this.prisma.eventAttendee.findFirst({
      where: { eventId, qrPassCode: dto.qrPassCode },
      include: {
        user: {
          include: {
            profile: true,
            photos: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    if (!attendee) throw new NotFoundException('Invalid QR Pass code.');
    if (attendee.status === AttendeeStatus.CHECKED_IN) {
      return {
        alreadyCheckedIn: true,
        checkedInAt: attendee.checkedInAt,
        attendeeName: attendee.user.profile?.displayName,
      };
    }

    const updated = await this.prisma.eventAttendee.update({
      where: { id: attendee.id },
      data: { status: AttendeeStatus.CHECKED_IN, checkedInAt: new Date() },
    });

    return {
      checkedIn: true,
      attendeeName: attendee.user.profile?.displayName,
      avatarUrl: attendee.user.photos[0]?.url ?? null,
      passCode: attendee.qrPassCode,
      checkedInAt: updated.checkedInAt,
    };
  }

  async getMyAttending(userId: string) {
    const attendees = await this.prisma.eventAttendee.findMany({
      where: { userId, status: { in: [AttendeeStatus.CONFIRMED, AttendeeStatus.CHECKED_IN] } },
      include: {
        event: {
          include: {
            category: true,
            organizer: {
              select: {
                profile: { select: { displayName: true } },
                photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: { event: { startTime: 'asc' } },
    });

    return attendees.map((a) => ({
      attendeeId: a.id,
      qrPassCode: a.qrPassCode,
      status: a.status,
      checkedInAt: a.checkedInAt,
      isOrganizer: a.isOrganizer,
      event: {
        ...a.event,
        organizerName: a.event.organizer.profile?.displayName,
        organizerAvatar: a.event.organizer.photos[0]?.url,
      },
    }));
  }

  async getMyHosting(userId: string) {
    return this.prisma.event.findMany({
      where: { organizerId: userId, deletedAt: null },
      include: {
        category: true,
        _count: { select: { attendees: { where: { status: 'CONFIRMED' } } } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async getMySaved(userId: string) {
    const saved = await this.prisma.savedEvent.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            category: true,
            organizer: {
              select: {
                profile: { select: { displayName: true } },
                photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return saved.map((s) => s.event);
  }
}
