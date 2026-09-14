-- ---------------------------------------------------------------------------
-- PostGIS geography columns, spatial indexes, full-text search and triggers.
-- Prisma cannot model geography(Point,4326), so the columns live here and are
-- kept in sync from the plain lat/lng columns by triggers. Every spatial read
-- uses these columns via ST_DWithin / ST_Distance (see SpatialService).
-- ---------------------------------------------------------------------------

-- PROFILES ------------------------------------------------------------------
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "current_point"   geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS "ghost_point"     geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS "exploring_point" geography(Point, 4326),
  -- Point actually used for discovery: exploring when set, else ghost.
  ADD COLUMN IF NOT EXISTS "discovery_point" geography(Point, 4326);

CREATE OR REPLACE FUNCTION koodam_sync_profile_points() RETURNS TRIGGER AS $$
BEGIN
  NEW.current_point := CASE
    WHEN NEW.current_lat IS NULL OR NEW.current_lng IS NULL THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326)::geography
  END;

  NEW.ghost_point := CASE
    WHEN NEW.ghost_lat IS NULL OR NEW.ghost_lng IS NULL THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(NEW.ghost_lng, NEW.ghost_lat), 4326)::geography
  END;

  NEW.exploring_point := CASE
    WHEN NEW.exploring_lat IS NULL OR NEW.exploring_lng IS NULL THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(NEW.exploring_lng, NEW.exploring_lat), 4326)::geography
  END;

  NEW.discovery_point := COALESCE(NEW.exploring_point, NEW.ghost_point);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_sync_points ON "profiles";
CREATE TRIGGER trg_profiles_sync_points
  BEFORE INSERT OR UPDATE OF current_lat, current_lng, ghost_lat, ghost_lng, exploring_lat, exploring_lng
  ON "profiles" FOR EACH ROW EXECUTE FUNCTION koodam_sync_profile_points();

CREATE INDEX IF NOT EXISTS idx_profiles_discovery_point ON "profiles" USING GIST ("discovery_point");
CREATE INDEX IF NOT EXISTS idx_profiles_current_point   ON "profiles" USING GIST ("current_point");

-- EVENTS --------------------------------------------------------------------
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "point" geography(Point, 4326);

CREATE OR REPLACE FUNCTION koodam_sync_event_point() RETURNS TRIGGER AS $$
BEGIN
  NEW.point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_sync_point ON "events";
CREATE TRIGGER trg_events_sync_point
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON "events" FOR EACH ROW EXECUTE FUNCTION koodam_sync_event_point();

CREATE INDEX IF NOT EXISTS idx_events_point ON "events" USING GIST ("point");

-- LOCATIONS -----------------------------------------------------------------
ALTER TABLE "locations"
  ADD COLUMN IF NOT EXISTS "point" geography(Point, 4326);

CREATE OR REPLACE FUNCTION koodam_sync_location_point() RETURNS TRIGGER AS $$
BEGIN
  NEW.point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locations_sync_point ON "locations";
CREATE TRIGGER trg_locations_sync_point
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON "locations" FOR EACH ROW EXECUTE FUNCTION koodam_sync_location_point();

CREATE INDEX IF NOT EXISTS idx_locations_point ON "locations" USING GIST ("point");

-- FULL-TEXT SEARCH ----------------------------------------------------------
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("location_name", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("city", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("district", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_events_search_vector ON "events" USING GIN ("search_vector");

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("display_name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("profession", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("city", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("district", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("bio", '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_profiles_search_vector ON "profiles" USING GIN ("search_vector");

ALTER TABLE "locations"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("search_terms", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_locations_search_vector ON "locations" USING GIN ("search_vector");

-- INTEGRITY GUARDS ----------------------------------------------------------
-- Strict single-day policy enforced at the database level, not only in code.
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS chk_events_single_day;
ALTER TABLE "events" ADD CONSTRAINT chk_events_single_day
  CHECK ("end_time" > "start_time" AND "end_time" - "start_time" <= interval '8 hours');

-- A connection row is stored once per pair, canonically ordered.
ALTER TABLE "connections" DROP CONSTRAINT IF EXISTS chk_connections_canonical;
ALTER TABLE "connections" ADD CONSTRAINT chk_connections_canonical
  CHECK ("user_a_id" < "user_b_id");

ALTER TABLE "love_requests" DROP CONSTRAINT IF EXISTS chk_love_not_self;
ALTER TABLE "love_requests" ADD CONSTRAINT chk_love_not_self
  CHECK ("sender_id" <> "receiver_id");

ALTER TABLE "blocks" DROP CONSTRAINT IF EXISTS chk_block_not_self;
ALTER TABLE "blocks" ADD CONSTRAINT chk_block_not_self
  CHECK ("blocker_id" <> "blocked_id");

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS chk_events_capacity;
ALTER TABLE "events" ADD CONSTRAINT chk_events_capacity
  CHECK ("max_attendees" IS NULL OR "attendee_count" <= "max_attendees");

-- Exactly one primary photo per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_photos_one_primary
  ON "profile_photos" ("user_id") WHERE "is_primary" = true AND "status" = 'ACTIVE';
