-- =====================================================================
-- NIVAAS DATABASE SCHEMA
-- Import karo: phpMyAdmin > nivaas (naya database) > Import > nivaas_db.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_users
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_users` (
  `id`            CHAR(36)      NOT NULL DEFAULT (UUID()),
  `full_name`     VARCHAR(255)  DEFAULT NULL,
  `email`         VARCHAR(255)  NOT NULL,
  `phone`         VARCHAR(20)   DEFAULT NULL,
  `password_hash` VARCHAR(255)  DEFAULT NULL,
  `avatar_url`    VARCHAR(1000) DEFAULT NULL,
  `city`          VARCHAR(100)  DEFAULT NULL,
  `bio`           TEXT          DEFAULT NULL,
  `role`          ENUM('customer','owner','admin') NOT NULL DEFAULT 'customer',
  `is_verified`   TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nivaas_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_cities
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_cities` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100) NOT NULL,
  `state`      VARCHAR(100) NOT NULL,
  `country`    VARCHAR(100) NOT NULL DEFAULT 'India',
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nivaas_cities_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `nivaas_cities` (`name`, `state`) VALUES
  ('Ahmedabad',   'Gujarat'),
  ('Surat',       'Gujarat'),
  ('Vadodara',    'Gujarat'),
  ('Rajkot',      'Gujarat'),
  ('Gandhinagar', 'Gujarat'),
  ('Bhavnagar',   'Gujarat'),
  ('Mumbai',      'Maharashtra'),
  ('Bangalore',   'Karnataka'),
  ('Pune',        'Maharashtra'),
  ('Delhi',       'Delhi');


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_amenities
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_amenities` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100) NOT NULL,
  `icon`       VARCHAR(50)  DEFAULT NULL,
  `category`   VARCHAR(50)  DEFAULT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nivaas_amenities_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `nivaas_amenities` (`name`, `icon`, `category`) VALUES
  ('WiFi',               '📶', 'basic'),
  ('Air Conditioning',   '❄️', 'basic'),
  ('Parking',            '🚗', 'basic'),
  ('Power Backup',       '🔋', 'basic'),
  ('Water Supply 24/7',  '💧', 'basic'),
  ('Gas Pipeline',       '🔥', 'basic'),
  ('Lift/Elevator',      '🛗', 'basic'),
  ('CCTV Security',      '📷', 'security'),
  ('Security Guard',     '💂', 'security'),
  ('Intercom',           '📞', 'security'),
  ('Gym',                '🏋️', 'recreation'),
  ('Swimming Pool',      '🏊', 'recreation'),
  ('Clubhouse',          '🏛️', 'recreation'),
  ('Children Play Area', '🛝', 'recreation'),
  ('Jogging Track',      '🏃', 'recreation'),
  ('Housekeeping',       '🧹', 'service'),
  ('Laundry',            '👕', 'service'),
  ('Meals Included',     '🍽️', 'service'),
  ('Pet Friendly',       '🐾', 'lifestyle'),
  ('Balcony',            '🌅', 'lifestyle');


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_properties
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_properties` (
  `id`                CHAR(36)      NOT NULL DEFAULT (UUID()),
  `owner_id`          CHAR(36)      NOT NULL,
  `city_id`           INT           DEFAULT NULL,

  `title`             VARCHAR(500)  NOT NULL,
  `description`       TEXT          DEFAULT NULL,
  `property_type`     ENUM('Apartment','Villa','PG','Office Space','Plot','Warehouse','Farm House') NOT NULL DEFAULT 'Apartment',
  `listing_type`      ENUM('rent','sale','pg') NOT NULL DEFAULT 'rent',
  `status`            ENUM('draft','pending_review','active','inactive','rented') NOT NULL DEFAULT 'draft',

  `address`           TEXT          DEFAULT NULL,
  `locality`          VARCHAR(255)  DEFAULT NULL,
  `city`              VARCHAR(100)  NOT NULL,
  `state`             VARCHAR(100)  DEFAULT NULL,
  `pincode`           VARCHAR(10)   DEFAULT NULL,
  `latitude`          DOUBLE        DEFAULT NULL,
  `longitude`         DOUBLE        DEFAULT NULL,
  `map_url`           VARCHAR(1000) DEFAULT NULL,

  `bedrooms`          TINYINT UNSIGNED DEFAULT NULL,
  `bathrooms`         TINYINT UNSIGNED DEFAULT NULL,
  `balconies`         TINYINT UNSIGNED DEFAULT 0,
  `area_sqft`         DECIMAL(10,2) DEFAULT NULL,
  `carpet_area`       DECIMAL(10,2) DEFAULT NULL,
  `floor_number`      SMALLINT      DEFAULT NULL,
  `total_floors`      SMALLINT      DEFAULT NULL,
  `age_years`         VARCHAR(20)   DEFAULT NULL,
  `furnished`         ENUM('Unfurnished','Semi-Furnished','Fully Furnished') DEFAULT 'Unfurnished',
  `facing`            VARCHAR(20)   DEFAULT NULL,
  `parking_slots`     TINYINT UNSIGNED DEFAULT 0,

  `price`             DECIMAL(14,2) NOT NULL,
  `deposit`           DECIMAL(12,2) DEFAULT NULL,
  `maintenance_fee`   DECIMAL(10,2) DEFAULT 0,
  `brokerage`         DECIMAL(10,2) DEFAULT 0,
  `price_negotiable`  TINYINT(1)    NOT NULL DEFAULT 0,

  `available_from`    DATE          DEFAULT NULL,
  `min_lease_months`  TINYINT UNSIGNED DEFAULT 11,
  `preferred_tenants` VARCHAR(50)   DEFAULT NULL,

  `cover_image_url`   VARCHAR(1000) DEFAULT NULL,
  `verified`          TINYINT(1)    NOT NULL DEFAULT 0,
  `rera_id`           VARCHAR(100)  DEFAULT NULL,

  `views_count`       INT UNSIGNED  NOT NULL DEFAULT 0,
  `saves_count`       INT UNSIGNED  NOT NULL DEFAULT 0,
  `inquiries_count`   INT UNSIGNED  NOT NULL DEFAULT 0,

  `created_at`        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_prop_owner`  (`owner_id`),
  KEY `idx_prop_city`   (`city`),
  KEY `idx_prop_status` (`status`),
  KEY `idx_prop_type`   (`property_type`),
  CONSTRAINT `fk_prop_owner` FOREIGN KEY (`owner_id`) REFERENCES `nivaas_users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_prop_city`  FOREIGN KEY (`city_id`)  REFERENCES `nivaas_cities`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_property_images
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_property_images` (
  `id`           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `property_id`  CHAR(36)      NOT NULL,
  `url`          VARCHAR(1000) NOT NULL,
  `storage_path` VARCHAR(1000) DEFAULT NULL,
  `caption`      VARCHAR(255)  DEFAULT NULL,
  `is_cover`     TINYINT(1)    NOT NULL DEFAULT 0,
  `sort_order`   SMALLINT      NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_propimg_prop` (`property_id`),
  CONSTRAINT `fk_propimg_prop` FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_property_amenities (junction)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_property_amenities` (
  `property_id` CHAR(36) NOT NULL,
  `amenity_id`  INT      NOT NULL,
  PRIMARY KEY (`property_id`, `amenity_id`),
  CONSTRAINT `fk_pa_prop`    FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pa_amenity` FOREIGN KEY (`amenity_id`)  REFERENCES `nivaas_amenities`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_saved_properties
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_saved_properties` (
  `id`          CHAR(36)  NOT NULL DEFAULT (UUID()),
  `user_id`     CHAR(36)  NOT NULL,
  `property_id` CHAR(36)  NOT NULL,
  `saved_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved` (`user_id`, `property_id`),
  KEY `idx_saved_user` (`user_id`),
  CONSTRAINT `fk_saved_user` FOREIGN KEY (`user_id`)     REFERENCES `nivaas_users`(`id`)      ON DELETE CASCADE,
  CONSTRAINT `fk_saved_prop` FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_inquiries
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_inquiries` (
  `id`          CHAR(36)  NOT NULL DEFAULT (UUID()),
  `property_id` CHAR(36)  NOT NULL,
  `customer_id` CHAR(36)  NOT NULL,
  `owner_id`    CHAR(36)  NOT NULL,
  `message`     TEXT      DEFAULT NULL,
  `status`      ENUM('pending','responded','scheduled','closed') NOT NULL DEFAULT 'pending',
  `visit_date`  DATETIME  DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inq_customer` (`customer_id`),
  KEY `idx_inq_owner`    (`owner_id`),
  KEY `idx_inq_prop`     (`property_id`),
  CONSTRAINT `fk_inq_prop`     FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inq_customer` FOREIGN KEY (`customer_id`) REFERENCES `nivaas_users`(`id`),
  CONSTRAINT `fk_inq_owner`    FOREIGN KEY (`owner_id`)    REFERENCES `nivaas_users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_messages
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_messages` (
  `id`          CHAR(36)   NOT NULL DEFAULT (UUID()),
  `sender_id`   CHAR(36)   NOT NULL,
  `receiver_id` CHAR(36)   NOT NULL,
  `property_id` CHAR(36)   DEFAULT NULL,
  `content`     TEXT       NOT NULL,
  `is_read`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_sender`   (`sender_id`),
  KEY `idx_msg_receiver` (`receiver_id`),
  CONSTRAINT `fk_msg_sender`   FOREIGN KEY (`sender_id`)   REFERENCES `nivaas_users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msg_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `nivaas_users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msg_prop`     FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_agreements
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_agreements` (
  `id`               CHAR(36)      NOT NULL DEFAULT (UUID()),
  `property_id`      CHAR(36)      NOT NULL,
  `owner_id`         CHAR(36)      NOT NULL,
  `tenant_id`        CHAR(36)      NOT NULL,
  `start_date`       DATE          NOT NULL,
  `end_date`         DATE          NOT NULL,
  `monthly_rent`     DECIMAL(12,2) NOT NULL,
  `security_deposit` DECIMAL(12,2) DEFAULT NULL,
  `status`           ENUM('draft','sent','signed','expired','terminated') NOT NULL DEFAULT 'draft',
  `document_url`     VARCHAR(1000) DEFAULT NULL,
  `notes`            TEXT          DEFAULT NULL,
  `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agr_owner`  (`owner_id`),
  KEY `idx_agr_tenant` (`tenant_id`),
  CONSTRAINT `fk_agr_prop`   FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`),
  CONSTRAINT `fk_agr_owner`  FOREIGN KEY (`owner_id`)    REFERENCES `nivaas_users`(`id`),
  CONSTRAINT `fk_agr_tenant` FOREIGN KEY (`tenant_id`)   REFERENCES `nivaas_users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_rent_payments
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_rent_payments` (
  `id`             CHAR(36)      NOT NULL DEFAULT (UUID()),
  `agreement_id`   CHAR(36)      NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `due_date`       DATE          NOT NULL,
  `paid_date`      DATE          DEFAULT NULL,
  `status`         ENUM('pending','paid','overdue','waived') NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(50)   DEFAULT NULL,
  `transaction_id` VARCHAR(100)  DEFAULT NULL,
  `notes`          TEXT          DEFAULT NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pay_agreement` (`agreement_id`),
  CONSTRAINT `fk_pay_agreement` FOREIGN KEY (`agreement_id`) REFERENCES `nivaas_agreements`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_reviews
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_reviews` (
  `id`          CHAR(36)  NOT NULL DEFAULT (UUID()),
  `property_id` CHAR(36)  NOT NULL,
  `reviewer_id` CHAR(36)  NOT NULL,
  `rating`      TINYINT UNSIGNED NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `comment`     TEXT      DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review` (`property_id`, `reviewer_id`),
  CONSTRAINT `fk_rev_prop`     FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rev_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `nivaas_users`(`id`)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- SAMPLE DATA — 3 users + 3 properties (delete before production)
-- ─────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO `nivaas_users` (`id`, `full_name`, `email`, `phone`, `role`, `is_verified`) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rahul Mehta',  'rahul@nivaas.in',  '9876543210', 'owner',    1),
  ('00000000-0000-0000-0000-000000000002', 'Priya Sharma', 'priya@nivaas.in',  '9876543211', 'customer', 1),
  ('00000000-0000-0000-0000-000000000003', 'Admin User',   'admin@nivaas.in',  '9876543212', 'admin',    1);

INSERT IGNORE INTO `nivaas_properties`
  (`id`, `owner_id`, `city_id`, `title`, `property_type`, `listing_type`, `status`,
   `address`, `locality`, `city`, `state`, `pincode`, `latitude`, `longitude`,
   `bedrooms`, `bathrooms`, `area_sqft`, `furnished`, `price`, `deposit`,
   `available_from`, `cover_image_url`, `verified`)
VALUES
(
  'prop-0001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001', 1,
  '3 BHK Luxury Apartment in Prahlad Nagar', 'Apartment', 'rent', 'active',
  'B-402, Sky Vista, Prahlad Nagar', 'Prahlad Nagar', 'Ahmedabad', 'Gujarat', '380015',
  23.0225, 72.5714, 3, 2, 1450.00, 'Fully Furnished', 35000.00, 100000.00,
  '2025-02-01',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 1
),
(
  'prop-0002-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001', 1,
  '2 BHK Modern Flat in Satellite', 'Apartment', 'rent', 'active',
  'C-201, Green Meadows, Satellite', 'Satellite', 'Ahmedabad', 'Gujarat', '380015',
  23.0300, 72.5200, 2, 2, 1100.00, 'Semi-Furnished', 22000.00, 66000.00,
  '2025-01-15',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 1
),
(
  'prop-0003-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001', 2,
  'Spacious 4 BHK Villa in Vesu', 'Villa', 'sale', 'active',
  '12, Palm Avenue, Vesu', 'Vesu', 'Surat', 'Gujarat', '395007',
  21.1702, 72.7856, 4, 4, 2800.00, 'Fully Furnished', 8500000.00, 0,
  '2025-03-01',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 1
);

-- Amenities for sample properties
INSERT IGNORE INTO `nivaas_property_amenities` (`property_id`, `amenity_id`) VALUES
  ('prop-0001-0000-0000-0000-000000000001', 1),
  ('prop-0001-0000-0000-0000-000000000001', 2),
  ('prop-0001-0000-0000-0000-000000000001', 3),
  ('prop-0001-0000-0000-0000-000000000001', 7),
  ('prop-0001-0000-0000-0000-000000000001', 8),
  ('prop-0001-0000-0000-0000-000000000001', 11),
  ('prop-0002-0000-0000-0000-000000000002', 1),
  ('prop-0002-0000-0000-0000-000000000002', 3),
  ('prop-0002-0000-0000-0000-000000000002', 7),
  ('prop-0003-0000-0000-0000-000000000003', 3),
  ('prop-0003-0000-0000-0000-000000000003', 11),
  ('prop-0003-0000-0000-0000-000000000003', 12),
  ('prop-0003-0000-0000-0000-000000000003', 20);

SET FOREIGN_KEY_CHECKS = 1;


-- =====================================================================
-- PHASE 1 ENHANCEMENT — NEW TABLES
-- Run these ALTER/CREATE statements on your existing nivaas database
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_property_visits
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_property_visits` (
  `id`             CHAR(36)   NOT NULL DEFAULT (UUID()),
  `property_id`    CHAR(36)   NOT NULL,
  `customer_id`    CHAR(36)   NOT NULL,
  `owner_id`       CHAR(36)   NOT NULL,
  `visit_date`     DATE       NOT NULL,
  `visit_time`     TIME       NOT NULL,
  `visit_type`     ENUM('in_person','video_call') NOT NULL DEFAULT 'in_person',
  `status`         ENUM('pending','confirmed','completed','cancelled','rescheduled') NOT NULL DEFAULT 'pending',
  `notes`          TEXT       DEFAULT NULL,
  `cancel_reason`  TEXT       DEFAULT NULL,
  `created_at`     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_visit_property`  (`property_id`),
  KEY `idx_visit_customer`  (`customer_id`),
  KEY `idx_visit_owner`     (`owner_id`),
  CONSTRAINT `fk_visit_property` FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_visit_customer` FOREIGN KEY (`customer_id`) REFERENCES `nivaas_users`(`id`)      ON DELETE CASCADE,
  CONSTRAINT `fk_visit_owner`    FOREIGN KEY (`owner_id`)    REFERENCES `nivaas_users`(`id`)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_complaints
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_complaints` (
  `id`             CHAR(36)     NOT NULL DEFAULT (UUID()),
  `property_id`    CHAR(36)     DEFAULT NULL,
  `reporter_id`    CHAR(36)     NOT NULL,
  `reported_user_id` CHAR(36)  DEFAULT NULL,
  `category`       ENUM('fake_listing','fraud','wrong_information','owner_misbehavior','payment_issue','other') NOT NULL DEFAULT 'other',
  `subject`        VARCHAR(255) NOT NULL,
  `description`    TEXT         NOT NULL,
  `status`         ENUM('open','in_review','resolved','dismissed') NOT NULL DEFAULT 'open',
  `admin_notes`    TEXT         DEFAULT NULL,
  `resolved_at`    TIMESTAMP    DEFAULT NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_complaint_reporter`   (`reporter_id`),
  KEY `idx_complaint_property`   (`property_id`),
  KEY `idx_complaint_status`     (`status`),
  CONSTRAINT `fk_complaint_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `nivaas_users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_complaint_prop`     FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_documents
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_documents` (
  `id`           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `owner_id`     CHAR(36)      NOT NULL,
  `property_id`  CHAR(36)      DEFAULT NULL,
  `doc_type`     ENUM('sale_deed','tax_receipt','electricity_bill','noc','society_letter','occupancy_certificate','rental_agreement','identity_proof','other') NOT NULL DEFAULT 'other',
  `title`        VARCHAR(255)  NOT NULL,
  `file_url`     VARCHAR(1000) NOT NULL,
  `file_name`    VARCHAR(255)  DEFAULT NULL,
  `file_size`    INT UNSIGNED  DEFAULT NULL,
  `is_verified`  TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_owner`    (`owner_id`),
  KEY `idx_doc_property` (`property_id`),
  CONSTRAINT `fk_doc_owner`    FOREIGN KEY (`owner_id`)    REFERENCES `nivaas_users`(`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_doc_property` FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_notifications
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_notifications` (
  `id`          CHAR(36)      NOT NULL DEFAULT (UUID()),
  `user_id`     CHAR(36)      NOT NULL,
  `type`        VARCHAR(50)   NOT NULL,
  `title`       VARCHAR(255)  NOT NULL,
  `body`        TEXT          NOT NULL,
  `link`        VARCHAR(500)  DEFAULT NULL,
  `is_read`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`),
  KEY `idx_notif_read` (`is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `nivaas_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_verification_logs
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_verification_logs` (
  `id`           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `property_id`  CHAR(36)      NOT NULL,
  `verifier_id`  CHAR(36)      NOT NULL,
  `action`       ENUM('submitted','approved','rejected','inspection_done') NOT NULL,
  `notes`        TEXT          DEFAULT NULL,
  `report_url`   VARCHAR(1000) DEFAULT NULL,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vlog_property` (`property_id`),
  CONSTRAINT `fk_vlog_property` FOREIGN KEY (`property_id`) REFERENCES `nivaas_properties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vlog_verifier` FOREIGN KEY (`verifier_id`) REFERENCES `nivaas_users`(`id`)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_audit_logs
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_audit_logs` (
  `id`         CHAR(36)      NOT NULL DEFAULT (UUID()),
  `actor_id`   CHAR(36)      NOT NULL,
  `action`     VARCHAR(100)  NOT NULL,
  `entity`     VARCHAR(50)   DEFAULT NULL,
  `entity_id`  CHAR(36)      DEFAULT NULL,
  `details`    JSON          DEFAULT NULL,
  `ip`         VARCHAR(45)   DEFAULT NULL,
  `created_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor`  (`actor_id`),
  KEY `idx_audit_entity` (`entity`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE: nivaas_pricing_suggestions
-- (AI pricing cache — store computed suggestions so same property
--  doesn't recompute on every load)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `nivaas_pricing_suggestions` (
  `id`                CHAR(36)      NOT NULL DEFAULT (UUID()),
  `property_id`       CHAR(36)      DEFAULT NULL,
  `city`              VARCHAR(100)  NOT NULL,
  `locality`          VARCHAR(255)  DEFAULT NULL,
  `property_type`     VARCHAR(50)   NOT NULL,
  `listing_type`      VARCHAR(20)   NOT NULL,
  `bedrooms`          TINYINT UNSIGNED DEFAULT NULL,
  `area_sqft`         DECIMAL(10,2) DEFAULT NULL,
  `suggested_min`     DECIMAL(14,2) NOT NULL,
  `suggested_max`     DECIMAL(14,2) NOT NULL,
  `suggested_optimal` DECIMAL(14,2) NOT NULL,
  `basis`             JSON          DEFAULT NULL,
  `created_at`        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pricing_city` (`city`, `property_type`, `listing_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────
-- ALTER: add agent/broker role + kyc columns to nivaas_users
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE `nivaas_users`
  MODIFY COLUMN `role` ENUM('customer','owner','admin','agent','verification_team') NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS `kyc_status` ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none' AFTER `is_verified`,
  ADD COLUMN IF NOT EXISTS `aadhaar_number` VARCHAR(12) DEFAULT NULL AFTER `kyc_status`;


-- ─────────────────────────────────────────────────────────────────────
-- ALTER: add rent_due_day and grace_period to nivaas_agreements
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE `nivaas_agreements`
  ADD COLUMN IF NOT EXISTS `rent_due_day`      TINYINT UNSIGNED NOT NULL DEFAULT 1  AFTER `security_deposit`,
  ADD COLUMN IF NOT EXISTS `grace_period_days` TINYINT UNSIGNED NOT NULL DEFAULT 5  AFTER `rent_due_day`,
  ADD COLUMN IF NOT EXISTS `late_fee_amount`   DECIMAL(10,2)    NOT NULL DEFAULT 0  AFTER `grace_period_days`,
  ADD COLUMN IF NOT EXISTS `signed_at`         TIMESTAMP        DEFAULT NULL       AFTER `late_fee_amount`;


-- ─────────────────────────────────────────────────────────────────────
-- ALTER: add Hostel to property_type enum
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE `nivaas_properties`
  MODIFY COLUMN `property_type` ENUM('Apartment','Villa','PG','Hostel','Office Space','Plot','Warehouse','Farm House','Commercial') NOT NULL DEFAULT 'Apartment',
  ADD COLUMN IF NOT EXISTS `verification_status` ENUM('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified' AFTER `verified`,
  ADD COLUMN IF NOT EXISTS `qr_code_url` VARCHAR(1000) DEFAULT NULL AFTER `rera_id`;
