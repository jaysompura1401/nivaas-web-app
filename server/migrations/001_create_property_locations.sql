-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create nivaas_property_locations table
--
-- Purpose:
--   Separate authoritative location table for properties.
--   One row per property (1-to-1).
--   ONLY owner-provided, Google Maps resolved coordinates are stored here.
--   NO fallback / approximate / city-center coordinates allowed.
--
-- After running this migration, run the backfill script to move existing
-- lat/lng + map_url data from nivaas_properties into this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `nivaas_property_locations` (
  `id`             CHAR(36)      NOT NULL DEFAULT (UUID()),
  `property_id`    CHAR(36)      NOT NULL,
  `google_maps_url` VARCHAR(1000) NOT NULL,
  `latitude`       DOUBLE        NOT NULL,
  `longitude`      DOUBLE        NOT NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_property_location` (`property_id`),
  KEY `idx_loc_lat` (`latitude`),
  KEY `idx_loc_lng` (`longitude`),
  CONSTRAINT `fk_loc_property`
    FOREIGN KEY (`property_id`)
    REFERENCES `nivaas_properties`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: Move existing exact coordinates from nivaas_properties
--           into nivaas_property_locations.
--
-- Only migrates rows where BOTH latitude AND longitude are non-NULL, non-zero,
-- AND map_url is present — i.e. only genuinely owner-pinned locations.
-- Properties with NULL coordinates are intentionally excluded (no fake data).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO `nivaas_property_locations`
  (`id`, `property_id`, `google_maps_url`, `latitude`, `longitude`)
SELECT
  UUID()        AS id,
  p.id          AS property_id,
  p.map_url     AS google_maps_url,
  p.latitude    AS latitude,
  p.longitude   AS longitude
FROM `nivaas_properties` p
WHERE
  p.latitude  IS NOT NULL
  AND p.longitude IS NOT NULL
  AND p.latitude  != 0
  AND p.longitude != 0
  AND p.map_url   IS NOT NULL
  AND p.map_url   != ''
ON DUPLICATE KEY UPDATE
  google_maps_url = VALUES(google_maps_url),
  latitude        = VALUES(latitude),
  longitude       = VALUES(longitude),
  updated_at      = CURRENT_TIMESTAMP;
