import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventFormat, EventPrivacy, EventStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import { RedisService } from '../../database/redis.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { LatLng } from '../../common/utils/geo.util';
import { CreateEventDto, EventRadarQueryDto, UpdateEventDto } from './dto/events.dto';

export function validateSingleDaySchedule(dateStr: string, startTimeStr: string, endTimeStr: string): {
  eventDate: Date;
  startDateTime: Date;
  endDateTime: Date;
} {
  const eventDate = new Date(dateStr);
  if (isNaN(eventDate.getTime())) {
    throw new BadRequestException('Invalid event date.');
  }

  // Check not in the distant past (allow today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(eventDate);
  compareDate.setHours(0, 0, 0, 0);
  if (compareDate.getTime() < today.getTime()) {
    throw new BadRequestException('Cannot create an event in the past.');
  }

  // Parse HH:mm[:ss]
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    throw new BadRequestException('Start time and end time must be formatted as HH:mm or HH:mm:ss');
  }

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const durationMinutes = endMinutes - startMinutes;

  if (durationMinutes <= 0) {
    throw new BadRequestException('End time must be after start time on the same day.');
  }
  if (durationMinutes > 480) {
    throw new BadRequestException('Koodam gatherings are limited to a single calendar day (max 8 hours).');
  }

  const startDateTime = new Date(eventDate);
  startDateTime.setHours(startH, startM, 0, 0);

  const endDateTime = new Date(eventDate);
  endDateTime.setHours(endH, endM, 0, 0);

  return { eventDate, startDateTime, endDateTime };
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spatial: SpatialService,
    private readonly redis: RedisService,
  ) {}

  async listCategories() {
    return this.prisma.eventCategory.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true, slug: true, name: true, emoji: true, colorHex: true },
    });
  }

  async createEvent(organizerId: string, dto: CreateEventDto) {
    const { eventDate, startDateTime, endDateTime } = validateSingleDaySchedule(
      dto.eventDate,
      dto.startTime,
      dto.endTime,
    );

    const category = await this.prisma.eventCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw AppException.notFound('Event Category');

    // Generate unique vouch token for 3-peer trust invite link
    const vouchToken = `kd_vouch_${randomBytes(16).toString('hex')}`;

    // Staging status: User meetups start in PENDING_VOUCH, requiring 3 peer endorsements
    const status = EventStatus.PENDING_VOUCH;

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organizerId,
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          coverImage: dto.coverImage,
          format: dto.format,
          privacy: dto.privacy,
          status,
          eventDate,
          startTime: startDateTime,
          endTime: endDateTime,
          locationName: dto.locationName,
          address: dto.address,
          city: dto.city,
          district: dto.district,
          state: dto.state ?? 'Kerala',
          country: 'India',
          latitude: dto.latitude,
          longitude: dto.longitude,
          maxAttendees: dto.maxAttendees ?? 16,
          pricingType: dto.pricingType ?? 'FREE',
          price: dto.price ?? 0,
          currency: 'INR',
          upiId: dto.upiId,
          genderBalanceEnforced: dto.genderBalanceEnforced ?? true,
          requiresApproval: dto.requiresApproval ?? false,
          allowChat: dto.allowChat ?? true,
          allowAttendeeDiscovery: dto.allowAttendeeDiscovery ?? true,
          vouchesCount: 0,
          requiredVouches: 3,
          vouchToken,
        },
      });

      // Update PostGIS geography point
      await tx.$executeRaw`
        UPDATE events
           SET point = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
         WHERE id = ${created.id}::uuid
      `;

      // Auto-add organizer as first confirmed attendee with QR code
      const qrPassCode = `KD-${Math.floor(1000 + Math.random() * 9000)}`;
      await tx.eventAttendee.create({
        data: {
          eventId: created.id,
          userId: organizerId,
          status: 'CONFIRMED',
          isOrganizer: true,
          qrPassCode,
        },
      });

      // Create event community conversation
      await tx.conversation.create({
        data: {
          type: 'EVENT_GROUP',
          eventId: created.id,
          title: dto.title,
          members: {
            create: {
              userId: organizerId,
              isAdmin: true,
            },
          },
        },
      });

      return created;
    });

    return {
      event,
      vouchInviteLink: `https://koodam.app/vouch/${vouchToken}`,
      message: 'Gathering created! Share the vouch link with 3 verified friends to publish it to the live radar.',
    };
  }

  async getRadarEvents(query: EventRadarQueryDto) {
    const lat = query.lat ?? 9.9312; // default Kochi
    const lng = query.lng ?? 76.2673;
    const radiusKm = query.radius_km ?? 15;
    const center: LatLng = { latitude: lat, longitude: lng };

    let extraWhere = Prisma.empty;
    if (query.format) {
      extraWhere = Prisma.sql`${extraWhere} AND e.format = ${query.format}::event_format_enum`;
    }
    if (query.district) {
      extraWhere = Prisma.sql`${extraWhere} AND e.district ILIKE ${query.district}`;
    }
    if (query.categoryId) {
      extraWhere = Prisma.sql`${extraWhere} AND e.category_id = ${query.categoryId}::uuid`;
    }

    const rows = await this.spatial.findEventIdsWithin({
      center,
      radiusKm,
      limit: query.limit ?? 20,
      extraWhere,
      orderBy: 'featured',
    });

    if (rows.length === 0) return [];

    const eventIds = rows.map((r) => r.id);
    const distanceMap = new Map(rows.map((r) => [r.id, r.distance_m]));

    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      include: {
        category: true,
        organizer: {
          select: {
            id: true,
            isVerified: true,
            profile: { select: { displayName: true, peerVouchScore: true } },
            photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
      },
    });

    return events.map((event) => ({
      ...event,
      distanceMeters: Math.round(distanceMap.get(event.id) ?? 0),
      distanceKm: Number(((distanceMap.get(event.id) ?? 0) / 1000).toFixed(1)),
      organizerName: event.organizer.profile?.displayName ?? 'Host',
      organizerAvatar: event.organizer.photos[0]?.url ?? null,
    }));
  }

  async getEventById(eventId: string, currentUserId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId, deletedAt: null },
      include: {
        category: true,
        organizer: {
          select: {
            id: true,
            isVerified: true,
            profile: {
              select: { displayName: true, peerVouchScore: true, bio: true },
            },
            photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
        vouches: {
          include: {
            voucher: {
              select: {
                id: true,
                isVerified: true,
                profile: { select: { displayName: true } },
                photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
              },
            },
          },
        },
        _count: {
          select: { attendees: true },
        },
      },
    });

    if (!event) throw AppException.notFound('Event');

    let userAttendance = null;
    let isSaved = false;

    if (currentUserId) {
      userAttendance = await this.prisma.eventAttendee.findUnique({
        where: { eventId_userId: { eventId, userId: currentUserId } },
      });
      const saved = await this.prisma.savedEvent.findUnique({
        where: { userId_eventId: { userId: currentUserId, eventId } },
      });
      isSaved = Boolean(saved);
    }

    return {
      ...event,
      confirmedCount: event._count.attendees,
      userAttendance,
      isSaved,
    };
  }

  async updateEvent(eventId: string, organizerId: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });
    if (!existing) throw AppException.notFound('Event');

    const { eventDate, startDateTime, endDateTime } = validateSingleDaySchedule(
      dto.eventDate,
      dto.startTime,
      dto.endTime,
    );

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        title: dto.title,
        description: dto.description,
        coverImage: dto.coverImage,
        format: dto.format,
        privacy: dto.privacy,
        eventDate,
        startTime: startDateTime,
        endTime: endDateTime,
        locationName: dto.locationName,
        address: dto.address,
        city: dto.city,
        district: dto.district,
        latitude: dto.latitude,
        longitude: dto.longitude,
        maxAttendees: dto.maxAttendees,
        pricingType: dto.pricingType,
        price: dto.price,
        upiId: dto.upiId,
        genderBalanceEnforced: dto.genderBalanceEnforced,
        requiresApproval: dto.requiresApproval,
      },
    });

    // Update PostGIS point
    await this.prisma.$executeRaw`
      UPDATE events
         SET point = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
       WHERE id = ${eventId}::uuid
    `;

    return updated;
  }

  async cancelEvent(eventId: string, organizerId: string) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, organizerId, deletedAt: null },
    });
    if (!existing) throw AppException.notFound('Event');

    await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.CANCELLED, cancelledAt: new Date() },
    });

    // Remove from Redis GEO index
    await this.redis.client.zrem('koodam:events:geo', eventId);

    return { cancelled: true, eventId };
  }
}
