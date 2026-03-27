-- ucli-server PostgreSQL initialization script
-- PostgreSQL 13+
--
-- Usage:
--   psql -U <user> -d <database> -f init.postgres.sql
--
-- Or create the database first:
--   psql -U <user> -c "CREATE DATABASE oas_gateway;"
--   psql -U <user> -d oas_gateway -f init.postgres.sql
--
-- Note: In development (NODE_ENV != production), TypeORM synchronize=true
--       auto-creates tables. This file is intended for production deployments.

-- ──────────────────────────────────────────────────────────────────────────────
-- Helper: auto-update updated_at on every UPDATE
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- groups
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          UUID          NOT NULL DEFAULT gen_random_uuid(),
  name        VARCHAR(100)  NOT NULL,
  description TEXT          NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_groups_name UNIQUE (name)
);

CREATE OR REPLACE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- tokens
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
  id          UUID          NOT NULL DEFAULT gen_random_uuid(),
  group_id    UUID          NOT NULL,
  name        VARCHAR(200)  NOT NULL,
  jti         VARCHAR(64)   NOT NULL,
  scopes      TEXT          NOT NULL DEFAULT '',
  expires_at  TIMESTAMPTZ            DEFAULT NULL,
  revoked_at  TIMESTAMPTZ            DEFAULT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_tokens_jti UNIQUE (jti),
  CONSTRAINT fk_tokens_group_id
    FOREIGN KEY (group_id) REFERENCES groups (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_group_id ON tokens (group_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- oas_entries
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oas_entries (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),
  group_id      UUID          NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  description   TEXT          NOT NULL DEFAULT '',
  remote_url    VARCHAR(2048) NOT NULL,
  base_endpoint VARCHAR(2048)          DEFAULT NULL,
  auth_type     VARCHAR(20)   NOT NULL,
  auth_config   TEXT          NOT NULL,
  cache_ttl     INT           NOT NULL DEFAULT 3600,
  enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_oas_entries_group_name UNIQUE (group_id, name),
  CONSTRAINT fk_oas_entries_group_id
    FOREIGN KEY (group_id) REFERENCES groups (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oas_entries_group_id ON oas_entries (group_id);

CREATE OR REPLACE TRIGGER trg_oas_entries_updated_at
  BEFORE UPDATE ON oas_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- mcp_entries
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_entries (
  id          UUID          NOT NULL DEFAULT gen_random_uuid(),
  group_id    UUID          NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  description TEXT          NOT NULL DEFAULT '',
  transport   VARCHAR(10)   NOT NULL,
  server_url  VARCHAR(2048)          DEFAULT NULL,
  command     TEXT                   DEFAULT NULL,
  auth_config TEXT          NOT NULL,
  enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_mcp_entries_group_name UNIQUE (group_id, name),
  CONSTRAINT fk_mcp_entries_group_id
    FOREIGN KEY (group_id) REFERENCES groups (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_entries_group_id ON mcp_entries (group_id);

CREATE OR REPLACE TRIGGER trg_mcp_entries_updated_at
  BEFORE UPDATE ON mcp_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
