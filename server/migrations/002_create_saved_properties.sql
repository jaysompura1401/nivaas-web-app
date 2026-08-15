-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Create nivaas_saved_properties table
--
-- Purpose:
--   Stores properties that users (both owners and customers) have heart/saved.
--   One row per (user, property) pair. UNIQUE constraint prevents duplicates.
--   INSERT IGNORE is used on save so double-clicks are safe.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `nivaas_saved_properties` (
  `id`          CHAR(36)   NOT NULL DEFAULT (UUID()),
  `user_id`     CHAR(36)   NOT NULL,
  `property_id` CHAR(36)   NOT NULL,
  `saved_at`    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_property` (`user_id`, `property_id`),
  KEY `idx_saved_user`     (`user_id`),
  KEY `idx_saved_property` (`property_id`),

  CONSTRAINT `fk_saved_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `nivaas_users`(`id`)
    ON DELETE CASCADE,

  CONSTRAINT `fk_saved_property`
    FOREIGN KEY (`property_id`)
    REFERENCES `nivaas_properties`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
