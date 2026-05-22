CREATE TABLE IF NOT EXISTS fantasyiq_customers (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    access_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'paid_needs_setup',
    stripe_customer_id TEXT NOT NULL DEFAULT '',
    subscription_status TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    password_created_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    included_league_limit INTEGER NOT NULL DEFAULT 3,
    additional_league_count INTEGER NOT NULL DEFAULT 0,
    default_league_key TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fantasyiq_customers_email_unique
    ON fantasyiq_customers (lower(email))
    WHERE email <> '';

ALTER TABLE fantasyiq_customers
    ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_customers
    ADD COLUMN IF NOT EXISTS password_created_at TIMESTAMPTZ;

ALTER TABLE fantasyiq_customers
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS fantasyiq_sessions (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL REFERENCES fantasyiq_customers(slug) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fantasyiq_sessions_customer_idx
    ON fantasyiq_sessions (customer_slug, expires_at DESC);

CREATE INDEX IF NOT EXISTS fantasyiq_sessions_active_idx
    ON fantasyiq_sessions (token_hash, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS fantasyiq_leagues (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL REFERENCES fantasyiq_customers(slug) ON DELETE CASCADE,
    league_key TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    league_name TEXT NOT NULL DEFAULT '',
    league_id BIGINT,
    team_id INTEGER,
    team_name TEXT NOT NULL DEFAULT '',
    season INTEGER,
    league_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'configured',
    source TEXT NOT NULL DEFAULT 'setup_validator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key)
);

CREATE INDEX IF NOT EXISTS fantasyiq_leagues_customer_idx
    ON fantasyiq_leagues (customer_slug);

CREATE TABLE IF NOT EXISTS fantasyiq_payment_events (
    id BIGSERIAL PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL DEFAULT '',
    stripe_object_id TEXT NOT NULL DEFAULT '',
    customer_slug TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    amount_total INTEGER,
    currency TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_payment_events_customer_idx
    ON fantasyiq_payment_events (customer_slug);

CREATE INDEX IF NOT EXISTS fantasyiq_payment_events_email_idx
    ON fantasyiq_payment_events (lower(email))
    WHERE email <> '';

CREATE TABLE IF NOT EXISTS fantasyiq_ops_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'info',
    source TEXT NOT NULL DEFAULT '',
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_ops_events_created_idx
    ON fantasyiq_ops_events (created_at DESC);

CREATE INDEX IF NOT EXISTS fantasyiq_ops_events_customer_idx
    ON fantasyiq_ops_events (customer_slug, created_at DESC)
    WHERE customer_slug <> '';

CREATE INDEX IF NOT EXISTS fantasyiq_ops_events_severity_idx
    ON fantasyiq_ops_events (severity, created_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_rate_limits_expires_idx
    ON fantasyiq_rate_limits (expires_at);
