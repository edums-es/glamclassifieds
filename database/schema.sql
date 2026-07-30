CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) NOT NULL PRIMARY KEY,
    display_name VARCHAR(80) NOT NULL,
    age TINYINT UNSIGNED NOT NULL,
    city VARCHAR(120) NOT NULL,
    price_label VARCHAR(80) NOT NULL,
    description TEXT NULL,
    tags JSON NOT NULL,
    status ENUM('pending', 'active', 'rejected', 'archived') NOT NULL DEFAULT 'pending',
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
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
