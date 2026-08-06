CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(80) NULL,
    marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) NOT NULL PRIMARY KEY,
    member_id BIGINT UNSIGNED NULL,
    display_name VARCHAR(80) NOT NULL,
    age TINYINT UNSIGNED NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Acompanhante',
    city VARCHAR(120) NOT NULL,
    neighborhood VARCHAR(120) NULL,
    price_label VARCHAR(80) NOT NULL,
    contact_phone VARCHAR(40) NULL,
    availability VARCHAR(160) NULL,
    moderation_note TEXT NULL,
    services JSON NULL,
    service_for JSON NULL,
    meeting_places JSON NULL,
    payment_methods JSON NULL,
    description TEXT NULL,
    tags JSON NOT NULL,
    status ENUM('pending', 'active', 'rejected', 'archived') NOT NULL DEFAULT 'pending',
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    auto_approved TINYINT(1) NOT NULL DEFAULT 0,
    submitted_ip_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX profiles_public_index (status, is_featured, created_at),
    INDEX profiles_city_index (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_photos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    path VARCHAR(255) NOT NULL,
    position TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT profile_photos_profile_id_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    INDEX profile_photos_profile_index (profile_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submission_limits (
    ip_hash CHAR(64) NOT NULL PRIMARY KEY,
    last_submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_creators (
    id CHAR(36) NOT NULL PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    profile_id CHAR(36) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    bio VARCHAR(1000) NULL,
    monthly_price_cents INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('pending', 'active', 'paused', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY club_creators_profile_unique (profile_id),
    KEY club_creators_member_index (member_id, created_at),
    KEY club_creators_status_index (status, created_at),
    CONSTRAINT club_creators_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT club_creators_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_posts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    creator_id CHAR(36) NOT NULL,
    caption VARCHAR(2200) NOT NULL,
    visibility ENUM('public', 'subscribers', 'ppv') NOT NULL DEFAULT 'subscribers',
    price_cents INT UNSIGNED NOT NULL DEFAULT 0,
    media JSON NOT NULL,
    status ENUM('draft', 'pending', 'published', 'archived') NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY club_posts_feed_index (status, visibility, published_at),
    KEY club_posts_creator_index (creator_id, created_at),
    CONSTRAINT club_posts_creator_fk FOREIGN KEY (creator_id) REFERENCES club_creators(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_subscriptions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    creator_id CHAR(36) NOT NULL,
    status ENUM('pending', 'active', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
    amount_cents INT UNSIGNED NOT NULL,
    started_at TIMESTAMP NULL,
    ends_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY club_subscriptions_member_index (member_id, status),
    KEY club_subscriptions_creator_index (creator_id, status),
    CONSTRAINT club_subscriptions_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT club_subscriptions_creator_fk FOREIGN KEY (creator_id) REFERENCES club_creators(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_orders (
    id CHAR(36) NOT NULL PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    creator_id CHAR(36) NOT NULL,
    post_id CHAR(36) NULL,
    kind ENUM('subscription', 'ppv', 'tip') NOT NULL,
    amount_cents INT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    gateway_reference VARCHAR(120) NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY club_orders_member_index (member_id, created_at),
    KEY club_orders_creator_index (creator_id, created_at),
    KEY club_orders_status_index (status, created_at),
    CONSTRAINT club_orders_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT club_orders_creator_fk FOREIGN KEY (creator_id) REFERENCES club_creators(id) ON DELETE CASCADE,
    CONSTRAINT club_orders_post_fk FOREIGN KEY (post_id) REFERENCES club_posts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    creator_id CHAR(36) NULL,
    post_id CHAR(36) NULL,
    member_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(48) NOT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY club_events_creator_index (creator_id, created_at),
    KEY club_events_post_index (post_id, created_at),
    KEY club_events_type_index (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(80) NOT NULL,
    target_profile_id CHAR(36) NULL,
    details JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT admin_audit_logs_admin_id_fk FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    CONSTRAINT admin_audit_logs_profile_id_fk FOREIGN KEY (target_profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    INDEX admin_audit_logs_created_index (created_at),
    INDEX admin_audit_logs_profile_index (target_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
