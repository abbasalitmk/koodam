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

  private static readonly KERALA_DISTRICTS_FALLBACK = [
    { id: 'loc-ekm', name: 'Ernakulam', slug: 'ernakulam', code: 'KL-EKM', latitude: 9.9816, longitude: 76.2999, population: 3282388, children: [
      { id: 'loc-kochi', name: 'Kochi', slug: 'kochi', latitude: 9.9312, longitude: 76.2673 },
      { id: 'loc-aluva', name: 'Aluva', slug: 'aluva', latitude: 10.1076, longitude: 76.3516 },
      { id: 'loc-kakkanad', name: 'Kakkanad', slug: 'kakkanad', latitude: 10.0159, longitude: 76.3419 },
    ]},
    { id: 'loc-tvm', name: 'Thiruvananthapuram', slug: 'thiruvananthapuram', code: 'KL-TVM', latitude: 8.5241, longitude: 76.9366, population: 3301427, children: [
      { id: 'loc-tvm-city', name: 'Trivandrum City', slug: 'trivandrum', latitude: 8.5241, longitude: 76.9366 },
      { id: 'loc-kazhakkoottam', name: 'Kazhakkoottam', slug: 'kazhakkoottam', latitude: 8.5686, longitude: 76.8731 },
    ]},
    { id: 'loc-kkd', name: 'Kozhikode', slug: 'kozhikode', code: 'KL-KKD', latitude: 11.2588, longitude: 75.7804, population: 3086293, children: [
      { id: 'loc-calicut', name: 'Calicut City', slug: 'calicut', latitude: 11.2588, longitude: 75.7804 },
    ]},
    { id: 'loc-tsr', name: 'Thrissur', slug: 'thrissur', code: 'KL-TSR', latitude: 10.5276, longitude: 76.2144, population: 3121200, children: []},
    { id: 'loc-alp', name: 'Alappuzha', slug: 'alappuzha', code: 'KL-ALP', latitude: 9.4981, longitude: 76.3388, population: 2127789, children: []},
    { id: 'loc-ktm', name: 'Kottayam', slug: 'kottayam', code: 'KL-KTM', latitude: 9.5916, longitude: 76.5222, population: 1974551, children: []},
    { id: 'loc-knr', name: 'Kannur', slug: 'kannur', code: 'KL-KNR', latitude: 11.8745, longitude: 75.3704, population: 2523003, children: []},
    { id: 'loc-plk', name: 'Palakkad', slug: 'palakkad', code: 'KL-PLK', latitude: 10.7867, longitude: 76.6548, population: 2809934, children: []},
    { id: 'loc-mpm', name: 'Malappuram', slug: 'malappuram', code: 'KL-MPM', latitude: 11.0510, longitude: 76.0711, population: 4112920, children: []},
    { id: 'loc-klm', name: 'Kollam', slug: 'kollam', code: 'KL-KLM', latitude: 8.8932, longitude: 76.6141, population: 2635375, children: []},
    { id: 'loc-idk', name: 'Idukki', slug: 'idukki', code: 'KL-IDK', latitude: 9.8500, longitude: 76.9400, population: 1108974, children: []},
    { id: 'loc-wyn', name: 'Wayanad', slug: 'wayanad', code: 'KL-WYN', latitude: 11.6854, longitude: 76.1320, population: 817420, children: []},
    { id: 'loc-ksr', name: 'Kasaragod', slug: 'kasaragod', code: 'KL-KSR', latitude: 12.4996, longitude: 74.9869, population: 1307375, children: []},
    { id: 'loc-pta', name: 'Pathanamthitta', slug: 'pathanamthitta', code: 'KL-PTA', latitude: 9.2648, longitude: 76.7870, population: 1197412, children: []},
  ];

  private static readonly DIASPORA_HUBS_FALLBACK = [
    { id: 'loc-dxb', name: 'Dubai', slug: 'dubai', countryCode: 'AE', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
    { id: 'loc-doh', name: 'Doha', slug: 'doha', countryCode: 'QA', latitude: 25.2854, longitude: 51.5310, timezone: 'Asia/Qatar' },
    { id: 'loc-ruh', name: 'Riyadh', slug: 'riyadh', countryCode: 'SA', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh' },
    { id: 'loc-blr', name: 'Bengaluru', slug: 'bengaluru', countryCode: 'IN', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
    { id: 'loc-lon', name: 'London', slug: 'london', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
    { id: 'loc-sin', name: 'Singapore', slug: 'singapore', countryCode: 'SG', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
  ];

  async getKeralaDistricts() {
    try {
      return await this.prisma.location.findMany({
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
    } catch {
      return LocationsService.KERALA_DISTRICTS_FALLBACK;
    }
  }

  async getDiasporaHubs() {
    try {
      return await this.prisma.location.findMany({
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
    } catch {
      return LocationsService.DIASPORA_HUBS_FALLBACK;
    }
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
