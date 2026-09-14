/* eslint-disable no-console */
import {
  EventFormat,
  EventStatus,
  Gender,
  LocationKind,
  PrismaClient,
  RelationshipIntention,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { DIASPORA_HUBS, KERALA_DISTRICTS, SeedLocation } from './data/kerala-locations';
import { EVENT_CATEGORIES, INTERESTS } from './data/taxonomy';

const prisma = new PrismaClient();

const SEED_DEMO = process.env.SEED_DEMO !== 'false';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Koodam@2026';

async function upsertLocation(params: {
  kind: LocationKind;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  parentId?: string;
  countryCode?: string;
  timezone?: string;
  isKerala?: boolean;
  isDiaspora?: boolean;
  searchTerms?: string;
}): Promise<string> {
  const { slug, ...rest } = params;
  const row = await prisma.location.upsert({
    where: { slug },
    update: { ...rest },
    create: { slug, ...rest },
    select: { id: true },
  });
  return row.id;
}

async function seedLocations(): Promise<void> {
  console.log('→ Seeding locations (Kerala + diaspora)…');

  const indiaId = await upsertLocation({
    kind: LocationKind.COUNTRY,
    name: 'India',
    slug: 'india',
    latitude: 20.5937,
    longitude: 78.9629,
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
  });

  const keralaId = await upsertLocation({
    kind: LocationKind.STATE,
    name: 'Kerala',
    slug: 'kerala',
    latitude: 10.8505,
    longitude: 76.2711,
    parentId: indiaId,
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    isKerala: true,
    searchTerms: 'കേരളം gods own country malayalam',
  });

  const walk = async (node: SeedLocation, parentId: string, kind: LocationKind) => {
    const id = await upsertLocation({
      kind,
      name: node.name,
      slug: node.slug,
      latitude: node.latitude,
      longitude: node.longitude,
      parentId,
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      isKerala: true,
      searchTerms: node.searchTerms,
    });

    const childKind =
      kind === LocationKind.DISTRICT
        ? LocationKind.CITY
        : kind === LocationKind.CITY
          ? LocationKind.LOCALITY
          : LocationKind.LOCALITY;

    for (const child of node.children ?? []) await walk(child, id, childKind);
  };

  for (const district of KERALA_DISTRICTS) {
    await walk(district, keralaId, LocationKind.DISTRICT);
  }

  // Diaspora hubs, grouped under their country.
  const countryCache = new Map<string, string>([['india', indiaId]]);
  for (const hub of DIASPORA_HUBS) {
    let countryId = countryCache.get(hub.countrySlug);
    if (!countryId) {
      countryId = await upsertLocation({
        kind: LocationKind.COUNTRY,
        name: hub.country,
        slug: hub.countrySlug,
        latitude: hub.latitude,
        longitude: hub.longitude,
        countryCode: hub.countryCode,
        timezone: hub.timezone,
      });
      countryCache.set(hub.countrySlug, countryId);
    }

    await upsertLocation({
      kind: LocationKind.CITY,
      name: hub.city,
      slug: hub.slug,
      latitude: hub.latitude,
      longitude: hub.longitude,
      parentId: countryId,
      countryCode: hub.countryCode,
      timezone: hub.timezone,
      isDiaspora: true,
      searchTerms: hub.searchTerms,
    });
  }

  const count = await prisma.location.count();
  console.log(`  ✓ ${count} locations`);
}

async function seedTaxonomy(): Promise<void> {
  console.log('→ Seeding interests and event categories…');
  for (const interest of INTERESTS) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: interest,
      create: interest,
    });
  }
  for (const category of EVENT_CATEGORIES) {
    await prisma.eventCategory.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
  console.log(`  ✓ ${INTERESTS.length} interests, ${EVENT_CATEGORIES.length} categories`);
}

/** Mirrors GhostPrivacy: a 400–900 m random offset around the true point. */
function ghost(lat: number, lng: number): { lat: number; lng: number } {
  const distance = 400 + Math.random() * 500;
  const bearing = Math.random() * 2 * Math.PI;
  const dLat = (distance * Math.cos(bearing)) / 6378137;
  const dLng = (distance * Math.sin(bearing)) / (6378137 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: Number((lat + (dLat * 180) / Math.PI).toFixed(6)),
    lng: Number((lng + (dLng * 180) / Math.PI).toFixed(6)),
  };
}

interface DemoPerson {
  email: string;
  phone: string;
  name: string;
  gender: Gender;
  dob: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  profession: string;
  bio: string;
  intention: RelationshipIntention;
  interests: string[];
  role?: UserRole;
}

const DEMO_PEOPLE: DemoPerson[] = [
  { email: 'devika@koodam.app', phone: '+919000000001', name: 'Devika S.', gender: Gender.FEMALE, dob: '1999-04-12', district: 'Thrissur', city: 'Kozhikode', lat: 11.2588, lng: 75.7804, profession: 'Architect', bio: 'Thrissur roots, Kozhikode evenings. Sketching whatever the light does to old buildings.', intention: RelationshipIntention.SERIOUS_RELATIONSHIP, interests: ['art', 'sulaimani-chai', 'books', 'photography'] },
  { email: 'rahul@koodam.app', phone: '+919000000002', name: 'Rahul M.', gender: Gender.MALE, dob: '1998-09-02', district: 'Kozhikode', city: 'Kozhikode', lat: 11.2761, lng: 75.8199, profession: 'Software Developer', bio: 'Turf on Tuesdays, Malabar food crawls on Sundays.', intention: RelationshipIntention.OPEN_TO_CONNECTIONS, interests: ['football', 'technology', 'food', 'music'] },
  { email: 'anjali@koodam.app', phone: '+919000000003', name: 'Dr. Anjali Menon', gender: Gender.FEMALE, dob: '1998-01-20', district: 'Alappuzha', city: 'Kozhikode', lat: 11.2492, lng: 75.7695, profession: 'Pediatric Resident & Oil Canvas Painter', bio: 'Appam & stew at Paragon with three pages of a Basheer book.', intention: RelationshipIntention.LONG_TERM, interests: ['art', 'malayalam-indie', 'wayanad-trails', 'badminton'] },
  { email: 'ashwin@koodam.app', phone: '+919000000004', name: 'Ashwin K.', gender: Gender.MALE, dob: '1995-06-30', district: 'Kozhikode', city: 'Kozhikode', lat: 11.2543, lng: 75.7936, profession: 'Sports Steward', bio: 'I organise the Tuesday–Thursday padel and badminton circle.', intention: RelationshipIntention.FRIENDSHIP, interests: ['badminton', 'fitness', 'cricket'] },
  { email: 'meera@koodam.app', phone: '+919000000005', name: 'Meera R.', gender: Gender.FEMALE, dob: '1997-11-08', district: 'Ernakulam', city: 'Kochi', lat: 9.9586, lng: 76.2969, profession: 'Product Designer', bio: 'Fort Kochi walks, indie gigs, and far too much filter coffee.', intention: RelationshipIntention.DATING, interests: ['music', 'art', 'travel', 'startups'] },
  { email: 'nikhil@koodam.app', phone: '+919000000006', name: 'Nikhil Varma', gender: Gender.MALE, dob: '1994-02-17', district: 'Ernakulam', city: 'Kochi', lat: 9.9312, lng: 76.2673, profession: 'Chef', bio: 'Cooking my grandmother’s Syrian Christian recipes with a Kakkanad kitchen.', intention: RelationshipIntention.MARRIAGE, interests: ['cooking', 'food', 'books'] },
  { email: 'fathima@koodam.app', phone: '+919000000007', name: 'Fathima N.', gender: Gender.FEMALE, dob: '2000-07-25', district: 'Malappuram', city: 'Kozhikode', lat: 11.3234, lng: 75.8189, profession: 'Journalist', bio: 'Reporting on Malabar’s music scene. Will travel for a good qawwali.', intention: RelationshipIntention.SOCIAL, interests: ['music', 'books', 'photography', 'malayalam-indie'] },
  { email: 'arun@koodam.app', phone: '+919000000008', name: 'Arun Prakash', gender: Gender.MALE, dob: '1993-12-05', district: 'Thiruvananthapuram', city: 'Dubai', lat: 25.2048, lng: 55.2708, profession: 'Civil Engineer', bio: 'Trivandrum boy in Dubai. Home every Onam, exploring Kochi in between.', intention: RelationshipIntention.SERIOUS_RELATIONSHIP, interests: ['travel', 'cricket', 'food'] },
  { email: 'admin@koodam.app', phone: '+919000000099', name: 'Koodam Admin', gender: Gender.PREFER_NOT_TO_SAY, dob: '1990-01-01', district: 'Ernakulam', city: 'Kochi', lat: 9.9816, lng: 76.2999, profession: 'Platform Operations', bio: 'Koodam moderation desk.', intention: RelationshipIntention.SOCIAL, interests: ['technology'], role: UserRole.ADMIN },
];

async function seedDemo(): Promise<void> {
  console.log('→ Seeding demo users and events…');
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const interestsBySlug = new Map(
    (await prisma.interest.findMany()).map((i) => [i.slug, i.id]),
  );
  const categoriesBySlug = new Map(
    (await prisma.eventCategory.findMany()).map((c) => [c.slug, c.id]),
  );
  const locationsBySlug = new Map(
    (await prisma.location.findMany({ select: { id: true, slug: true } })).map((l) => [
      l.slug,
      l.id,
    ]),
  );

  const userIdByEmail = new Map<string, string>();

  for (const person of DEMO_PEOPLE) {
    const g = ghost(person.lat, person.lng);
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {},
      create: {
        email: person.email,
        phone: person.phone,
        passwordHash,
        role: person.role ?? UserRole.USER,
        isVerified: true,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        privacySettings: { create: {} },
        preferences: { create: {} },
        profile: {
          create: {
            displayName: person.name,
            dateOfBirth: new Date(person.dob),
            gender: person.gender,
            bio: person.bio,
            profession: person.profession,
            homeDistrict: person.district,
            city: person.city,
            district: person.district,
            state: person.city === 'Dubai' ? 'Dubai' : 'Kerala',
            country: person.city === 'Dubai' ? 'United Arab Emirates' : 'India',
            relationshipIntention: person.intention,
            currentLat: person.lat,
            currentLng: person.lng,
            ghostLat: g.lat,
            ghostLng: g.lng,
            locationUpdatedAt: new Date(),
            isProfileComplete: true,
            verification: VerificationStatus.VERIFIED,
            peerVouchScore: 3,
            culturalPrompts: [
              { prompt: 'Sunday morning ritual', answer: 'Appam at Paragon, then a long walk.' },
            ],
          },
        },
      },
      select: { id: true },
    });

    userIdByEmail.set(person.email, user.id);

    for (const slug of person.interests) {
      const interestId = interestsBySlug.get(slug);
      if (!interestId) continue;
      await prisma.userInterest.upsert({
        where: { userId_interestId: { userId: user.id, interestId } },
        update: {},
        create: { userId: user.id, interestId },
      });
    }
  }

  const inDays = (days: number, hour: number, minutes = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, minutes, 0, 0);
    return d;
  };

  const demoEvents = [
    {
      slugKey: 'kozhikode-sunset-food-crawl',
      organizer: 'rahul@koodam.app',
      title: 'Kozhikode Sunset Food Crawl & Sulaimani Jam',
      description:
        'Bite into crispy Kallummakkaya, sip fragrant Sulaimani, and enjoy an open-mic unplugged set as the sun goes down over the beach. We start at the Gujarati Street arch and walk the stretch together.',
      category: 'food-crawl',
      district: 'Kozhikode',
      city: 'Kozhikode',
      locationName: 'Gujarati Street & Beach',
      address: 'Near Old Pier, Kozhikode Beach, Kozhikode',
      lat: 11.2492,
      lng: 75.7695,
      start: inDays(2, 17, 30),
      end: inDays(2, 20, 30),
      max: 30,
      format: EventFormat.CASUAL_MEETUP,
      locationSlug: 'kozhikode-beach',
    },
    {
      slugKey: 'padel-badminton-turf',
      organizer: 'ashwin@koodam.app',
      title: 'Kozhikode Padel & Badminton Turf',
      description:
        'Weekly mixed doubles at Decathlon Play Arena. Balanced 50:50 group, all skill levels welcome. Rackets available on site.',
      category: 'turf-sports',
      district: 'Kozhikode',
      city: 'Kozhikode',
      locationName: 'Decathlon Play Arena',
      address: 'Mavoor Road, Kozhikode',
      lat: 11.2543,
      lng: 75.7936,
      start: inDays(4, 19, 30),
      end: inDays(4, 21, 30),
      max: 20,
      format: EventFormat.CASUAL_MEETUP,
      genderBalance: true,
      locationSlug: 'mavoor-road',
    },
    {
      slugKey: 'malabar-indie-cinema',
      organizer: 'fathima@koodam.app',
      title: 'Malabar Malayalam Indie Cinema Club',
      description:
        "Screening John Abraham's 'Amma Ariyan' followed by a moderated porch discussion and dinner at Paragon. Classic retrospective series, third edition.",
      category: 'film-screening',
      district: 'Kozhikode',
      city: 'Kozhikode',
      locationName: 'Crown Theatre Studio 2',
      address: 'Mavoor Road, Kozhikode',
      lat: 11.2561,
      lng: 75.7901,
      start: inDays(5, 18, 0),
      end: inDays(5, 22, 0),
      max: 60,
      format: EventFormat.CURATED_EVENT,
      locationSlug: 'kozhikode-city',
    },
    {
      slugKey: 'fort-kochi-acoustic',
      organizer: 'meera@koodam.app',
      title: 'Fort Kochi Acoustic & Unplugged Evening',
      description:
        'Sunset acoustic circle at Vasco da Gama Square. Bring a guitar, a poem, or just yourself. Free entry, chai on the house.',
      category: 'indie-music',
      district: 'Ernakulam',
      city: 'Kochi',
      locationName: 'Vasco da Gama Square',
      address: 'Fort Kochi, Ernakulam',
      lat: 9.9658,
      lng: 76.2421,
      start: inDays(9, 16, 0),
      end: inDays(9, 19, 0),
      max: 50,
      format: EventFormat.CASUAL_MEETUP,
      locationSlug: 'fort-kochi',
    },
    {
      slugKey: 'kakkanad-tech-brunch',
      organizer: 'nikhil@koodam.app',
      title: 'Kakkanad Startup Brunch',
      description:
        'Product folks, founders and engineers over a long Saturday brunch. Ten-minute lightning demos, no pitching to investors.',
      category: 'tech-meetup',
      district: 'Ernakulam',
      city: 'Kochi',
      locationName: 'Infopark Phase 1 Cafeteria',
      address: 'Kakkanad, Kochi',
      lat: 10.0158,
      lng: 76.3419,
      start: inDays(12, 10, 30),
      end: inDays(12, 13, 30),
      max: 40,
      format: EventFormat.CURATED_EVENT,
      locationSlug: 'kakkanad',
    },
  ];

  for (const e of demoEvents) {
    const organizerId = userIdByEmail.get(e.organizer);
    const categoryId = categoriesBySlug.get(e.category);
    if (!organizerId || !categoryId) continue;

    const existing = await prisma.event.findFirst({
      where: { title: e.title, organizerId },
      select: { id: true },
    });
    if (existing) continue;

    const event = await prisma.event.create({
      data: {
        organizerId,
        categoryId,
        title: e.title,
        description: e.description,
        format: e.format,
        status: EventStatus.PUBLISHED,
        publishedAt: new Date(),
        eventDate: new Date(e.start.toISOString().slice(0, 10)),
        startTime: e.start,
        endTime: e.end,
        locationName: e.locationName,
        address: e.address,
        city: e.city,
        district: e.district,
        state: 'Kerala',
        country: 'India',
        latitude: e.lat,
        longitude: e.lng,
        locationId: locationsBySlug.get(e.locationSlug) ?? null,
        maxAttendees: e.max,
        genderBalanceEnforced: e.genderBalance ?? false,
        vouchesCount: 3,
        attendeeCount: 1,
        conversation: { create: { type: 'EVENT_GROUP', title: e.title } },
        attendees: {
          create: {
            userId: organizerId,
            isOrganizer: true,
            qrPassCode: `KD-${Math.floor(1000 + Math.random() * 9000)}`,
          },
        },
      },
      select: { id: true, conversation: { select: { id: true } } },
    });

    if (event.conversation) {
      await prisma.conversationMember.create({
        data: { conversationId: event.conversation.id, userId: organizerId, isAdmin: true },
      });
    }
  }

  console.log(
    `  ✓ ${userIdByEmail.size} demo users (password: ${DEMO_PASSWORD}), ${demoEvents.length} events`,
  );
}

async function main(): Promise<void> {
  console.log('Koodam database seed\n');
  await seedLocations();
  await seedTaxonomy();
  if (SEED_DEMO) await seedDemo();
  else console.log('→ Skipping demo data (SEED_DEMO=false)');
  console.log('\nSeed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
