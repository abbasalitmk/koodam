import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { LatLng } from '../common/utils/geo.util';

export interface SpatialRow {
  id: string;
  distance_m: number;
}

/**
 * All PostGIS access lives here.
 *
 * Two rules this service exists to enforce:
 *  1. Geographic filtering happens in PostgreSQL (ST_DWithin against a GIST
 *     index), never by pulling rows into Node and measuring them.
 *  2. Public people queries read `discovery_point` — the ghosted/exploring
 *     position — so a precise `current_point` can never reach a client.
 */
@Injectable()
export class SpatialService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes the profile's real position and its ghosted twin in one statement. */
  async updateProfileLocation(
    userId: string,
    real: LatLng,
    ghost: LatLng,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE profiles
         SET current_lat = ${real.latitude},
             current_lng = ${real.longitude},
             ghost_lat = ${ghost.latitude},
             ghost_lng = ${ghost.longitude},
             location_updated_at = NOW(),
             updated_at = NOW()
       WHERE user_id = ${userId}::uuid
    `;
  }

  async updateExploringLocation(userId: string, point: LatLng | null): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE profiles
         SET exploring_lat = ${point?.latitude ?? null},
             exploring_lng = ${point?.longitude ?? null},
             updated_at = NOW()
       WHERE user_id = ${userId}::uuid
    `;
  }

  /**
   * Ids of published events within `radiusKm`, nearest first.
   *
   * `filters` is composed from already-validated values by the caller; every
   * user-supplied value still travels as a bound parameter.
   */
  async findEventIdsWithin(params: {
    center: LatLng;
    radiusKm: number;
    limit: number;
    offset?: number;
    extraWhere?: Prisma.Sql;
    orderBy?: 'distance' | 'date' | 'featured';
  }): Promise<SpatialRow[]> {
    const { center, radiusKm, limit, offset = 0, extraWhere, orderBy = 'distance' } = params;
    const origin = this.pointSql(center);

    const order =
      orderBy === 'date'
        ? Prisma.sql`ORDER BY e.is_featured DESC, e.start_time ASC`
        : orderBy === 'featured'
          ? Prisma.sql`ORDER BY e.is_featured DESC, distance_m ASC`
          : Prisma.sql`ORDER BY distance_m ASC`;

    return this.prisma.$queryRaw<SpatialRow[]>`
      SELECT e.id, ST_Distance(e.point, ${origin}) AS distance_m
        FROM events e
       WHERE e.deleted_at IS NULL
         AND e.status = 'PUBLISHED'
         AND e.privacy = 'PUBLIC'
         AND ST_DWithin(e.point, ${origin}, ${radiusKm * 1000})
         ${extraWhere ?? Prisma.empty}
       ${order}
       LIMIT ${limit} OFFSET ${offset}
    `;
  }

  /**
   * Ids of discoverable people within `radiusKm` of a point, measured against
   * the ghosted location so the result can never be inverted into an address.
   */
  async findPeopleIdsWithin(params: {
    center: LatLng;
    radiusKm: number;
    viewerId: string;
    limit: number;
    offset?: number;
    extraWhere?: Prisma.Sql;
  }): Promise<SpatialRow[]> {
    const { center, radiusKm, viewerId, limit, offset = 0, extraWhere } = params;
    const origin = this.pointSql(center);

    return this.prisma.$queryRaw<SpatialRow[]>`
      SELECT p.user_id AS id, ST_Distance(p.discovery_point, ${origin}) AS distance_m
        FROM profiles p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN user_privacy_settings s ON s.user_id = p.user_id
       WHERE u.status = 'ACTIVE'
         AND u.deleted_at IS NULL
         AND p.user_id <> ${viewerId}::uuid
         AND p.is_profile_complete = true
         AND p.discovery_point IS NOT NULL
         AND COALESCE(s.private_mode, false) = false
         AND COALESCE(s.show_in_discover, true) = true
         AND ST_DWithin(p.discovery_point, ${origin}, ${radiusKm * 1000})
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
            WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = p.user_id)
               OR (b.blocker_id = p.user_id AND b.blocked_id = ${viewerId}::uuid)
         )
         ${extraWhere ?? Prisma.empty}
       ORDER BY distance_m ASC
       LIMIT ${limit} OFFSET ${offset}
    `;
  }

  /** People discovery restricted to a map viewport rather than a radius. */
  async findPeopleIdsInBounds(params: {
    north: number;
    south: number;
    east: number;
    west: number;
    viewerId: string;
    limit: number;
  }): Promise<Array<{ id: string; lat: number; lng: number }>> {
    const { north, south, east, west, viewerId, limit } = params;
    return this.prisma.$queryRaw`
      SELECT p.user_id AS id, p.ghost_lat AS lat, p.ghost_lng AS lng
        FROM profiles p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN user_privacy_settings s ON s.user_id = p.user_id
       WHERE u.status = 'ACTIVE'
         AND u.deleted_at IS NULL
         AND p.user_id <> ${viewerId}::uuid
         AND p.discovery_point IS NOT NULL
         AND COALESCE(s.private_mode, false) = false
         AND COALESCE(s.show_on_people_map, true) = true
         AND ST_Intersects(
               p.discovery_point,
               ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)::geography
             )
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
            WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = p.user_id)
               OR (b.blocker_id = p.user_id AND b.blocked_id = ${viewerId}::uuid)
         )
       LIMIT ${limit}
    `;
  }

  async findEventIdsInBounds(params: {
    north: number;
    south: number;
    east: number;
    west: number;
    limit: number;
  }): Promise<Array<{ id: string }>> {
    const { north, south, east, west, limit } = params;
    return this.prisma.$queryRaw`
      SELECT e.id
        FROM events e
       WHERE e.deleted_at IS NULL
         AND e.status = 'PUBLISHED'
         AND e.privacy = 'PUBLIC'
         AND e.end_time > NOW()
         AND ST_Intersects(
               e.point,
               ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)::geography
             )
       ORDER BY e.is_featured DESC, e.start_time ASC
       LIMIT ${limit}
    `;
  }

  /** Distance in metres between two users, using the ghosted points. */
  async distanceBetweenUsers(userA: string, userB: string): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<Array<{ distance_m: number | null }>>`
      SELECT ST_Distance(a.discovery_point, b.discovery_point) AS distance_m
        FROM profiles a, profiles b
       WHERE a.user_id = ${userA}::uuid AND b.user_id = ${userB}::uuid
    `;
    return rows[0]?.distance_m ?? null;
  }

  /** Distances from one origin to many users, keyed by user id. */
  async distancesFrom(
    center: LatLng,
    userIds: string[],
  ): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const origin = this.pointSql(center);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; distance_m: number }>>`
      SELECT p.user_id AS id, ST_Distance(p.discovery_point, ${origin}) AS distance_m
        FROM profiles p
       WHERE p.user_id = ANY(${userIds}::uuid[])
         AND p.discovery_point IS NOT NULL
    `;
    return new Map(rows.map((r) => [r.id, Number(r.distance_m)]));
  }

  async distancesToEvents(
    center: LatLng,
    eventIds: string[],
  ): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    const origin = this.pointSql(center);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; distance_m: number }>>`
      SELECT e.id, ST_Distance(e.point, ${origin}) AS distance_m
        FROM events e
       WHERE e.id = ANY(${eventIds}::uuid[])
    `;
    return new Map(rows.map((r) => [r.id, Number(r.distance_m)]));
  }

  /** Nearest seeded location row to a coordinate — used to resolve GPS to a district. */
  async reverseResolveLocation(point: LatLng, kinds: string[] = ['CITY', 'TOWN', 'DISTRICT']) {
    const origin = this.pointSql(point);
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; kind: string; distance_m: number }>
    >`
      SELECT l.id, l.name, l.kind::text AS kind, ST_Distance(l.point, ${origin}) AS distance_m
        FROM locations l
       WHERE l.kind::text = ANY(${kinds})
       ORDER BY l.point <-> ${origin}
       LIMIT 1
    `;
    return rows[0] ?? null;
  }

  private pointSql(point: LatLng): Prisma.Sql {
    return Prisma.sql`ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography`;
  }
}
