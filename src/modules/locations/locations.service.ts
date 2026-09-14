import { Injectable } from '@nestjs/common';
import { LocationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import { AppException } from '../../common/utils/app.exception';
import { LocationSearchQueryDto } from './dto/locations.dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spatial: SpatialService,
  ) {}

  async getKeralaDistricts() {
    return this.prisma.location.findMany({
      where: { kind: LocationKind.DISTRICT, isKerala: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        population: true,
        children: {
          where: { kind: LocationKind.CITY },
          select: { id: true, name: true, slug: true, latitude: true, longitude: true },
          take: 10,
        },
      },
    });
  }

  async getDiasporaHubs() {
    return this.prisma.location.findMany({
      where: { isDiaspora: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        timezone: true,
      },
    });
  }

  async search(dto: LocationSearchQueryDto) {
    const where: Prisma.LocationWhereInput = {};

    if (dto.q) {
      const term = dto.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term.toLowerCase(), mode: 'insensitive' } },
        { searchTerms: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (dto.kind) where.kind = dto.kind;
    if (dto.isKerala !== undefined) where.isKerala = dto.isKerala;
    if (dto.isDiaspora !== undefined) where.isDiaspora = dto.isDiaspora;

    return this.prisma.location.findMany({
      where,
      orderBy: [{ isKerala: 'desc' }, { population: 'desc' }, { name: 'asc' }],
      take: dto.limit ?? 20,
      include: {
        parent: { select: { id: true, name: true, kind: true } },
      },
    });
  }

  async getById(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
        children: {
          orderBy: { name: 'asc' },
          take: 50,
        },
      },
    });

    if (!location) throw AppException.notFound('Location');
    return location;
  }

  async reverseGeocode(latitude: number, longitude: number) {
    const resolved = await this.spatial.reverseResolveLocation({ latitude, longitude });
    if (!resolved) {
      // Find nearest location within 100km
      const nearest = await this.prisma.$queryRaw<Array<{ id: string; name: string; kind: string; distance_m: number }>>`
        SELECT id, name, kind,
               ST_Distance(point, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) AS distance_m
          FROM locations
         WHERE point IS NOT NULL
         ORDER BY distance_m ASC
         LIMIT 1
      `;
      if (nearest[0]) {
        return this.getById(nearest[0].id);
      }
      return null;
    }
    return this.getById(resolved.id);
  }
}
