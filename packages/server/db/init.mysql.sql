-- ucli-server MySQL initialization script
-- MySQL 5.7+ / MariaDB 10.3+
--
-- Usage:
--   mysql -u<user> -p<password> <database> < init.mysql.sql
--
-- Or create the database first:
--   mysql -u<user> -p<password> -e "CREATE DATABASE IF NOT EXISTS oas_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
--   mysql -u<user> -p<password> oas_gateway < init.mysql.sql
--
-- Note: In development (NODE_ENV != production), TypeORM synchronize=true
--       auto-creates tables. This file is intended for production deployments.

-- ──────────────────────────────────────────────────────────────────────────────
-- groups
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `groups` (
  `id`          CHAR(36)      NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `description` TEXT          NOT NULL DEFAULT '',
  `created_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_groups_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────────────
-- tokens
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tokens` (
  `id`          CHAR(36)      NOT NULL,
  `group_id`    CHAR(36)      NOT NULL,
  `name`        VARCHAR(200)  NOT NULL,
  `jti`         VARCHAR(64)   NOT NULL,
  `scopes`      TEXT          NOT NULL DEFAULT '',
  `expires_at`  DATETIME(3)            DEFAULT NULL,
  `revoked_at`  DATETIME(3)            DEFAULT NULL,
  `created_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_tokens_jti` (`jti`),
  KEY `IDX_tokens_group_id` (`group_id`),
  CONSTRAINT `FK_tokens_group_id`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────────────
-- oas_entries
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `oas_entries` (
  `id`            CHAR(36)      NOT NULL,
  `group_id`      CHAR(36)      NOT NULL,
  `name`          VARCHAR(100)  NOT NULL,
  `description`   TEXT          NOT NULL DEFAULT '',
  `remote_url`    VARCHAR(2048) NOT NULL,
  `base_endpoint` VARCHAR(2048)          DEFAULT NULL,
  `auth_type`     VARCHAR(20)   NOT NULL,
  `auth_config`   TEXT          NOT NULL,
  `cache_ttl`     INT           NOT NULL DEFAULT 3600,
  `enabled`       TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_oas_entries_group_name` (`group_id`, `name`),
  KEY `IDX_oas_entries_group_id` (`group_id`),
  CONSTRAINT `FK_oas_entries_group_id`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────────────
-- mcp_entries
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `mcp_entries` (
  `id`          CHAR(36)      NOT NULL,
  `group_id`    CHAR(36)      NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `description` TEXT          NOT NULL DEFAULT '',
  `transport`   VARCHAR(10)   NOT NULL,
  `server_url`  VARCHAR(2048)          DEFAULT NULL,
  `command`     TEXT                   DEFAULT NULL,
  `auth_config` TEXT          NOT NULL,
  `enabled`     TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_mcp_entries_group_name` (`group_id`, `name`),
  KEY `IDX_mcp_entries_group_id` (`group_id`),
  CONSTRAINT `FK_mcp_entries_group_id`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
