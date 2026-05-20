CREATE TABLE IF NOT EXISTS fantasyiq_customers (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    access_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'paid_needs_setup',
    stripe_customer_id TEXT NOT NULL DEFAULT '',
    subscription_status TEXT NOT NULL DEFAULT '',
    included_league_limit INTEGER NOT NULL DEFAULT 3,
    additional_league_count INTEGER NOT NULL DEFAULT 0,
    default_league_key TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fantasyiq_customers_email_unique
    ON fantasyiq_customers (lower(email))
    WHERE email <> '';

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
