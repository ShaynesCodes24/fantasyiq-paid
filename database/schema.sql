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

CREATE TABLE IF NOT EXISTS fantasyiq_espn_sync_snapshots (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    league_id BIGINT,
    season INTEGER,
    sync_type TEXT NOT NULL DEFAULT 'league',
    source TEXT NOT NULL DEFAULT 'espn_public_api',
    payload_hash TEXT NOT NULL DEFAULT '',
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    fallback_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_espn_sync_snapshots_league_idx
    ON fantasyiq_espn_sync_snapshots (customer_slug, league_key, synced_at DESC);

CREATE INDEX IF NOT EXISTS fantasyiq_espn_sync_snapshots_hash_idx
    ON fantasyiq_espn_sync_snapshots (payload_hash)
    WHERE payload_hash <> '';

CREATE TABLE IF NOT EXISTS fantasyiq_normalized_league_settings (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    league_id BIGINT,
    season INTEGER,
    scoring_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    starting_slots JSONB NOT NULL DEFAULT '{}'::jsonb,
    bench_size INTEGER,
    total_teams INTEGER,
    waiver_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    trade_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    draft_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_snapshot_id BIGINT REFERENCES fantasyiq_espn_sync_snapshots(id) ON DELETE SET NULL,
    normalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season)
);

CREATE INDEX IF NOT EXISTS fantasyiq_normalized_league_settings_lookup_idx
    ON fantasyiq_normalized_league_settings (customer_slug, league_key);

CREATE TABLE IF NOT EXISTS fantasyiq_normalized_players (
    id BIGSERIAL PRIMARY KEY,
    season INTEGER NOT NULL,
    espn_player_id BIGINT,
    player_key TEXT NOT NULL,
    player_name TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    pro_team TEXT NOT NULL DEFAULT '',
    normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (season, player_key)
);

CREATE INDEX IF NOT EXISTS fantasyiq_normalized_players_espn_idx
    ON fantasyiq_normalized_players (season, espn_player_id)
    WHERE espn_player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS fantasyiq_normalized_players_position_idx
    ON fantasyiq_normalized_players (season, position);

CREATE TABLE IF NOT EXISTS fantasyiq_normalized_rosters (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    league_id BIGINT,
    season INTEGER,
    fantasy_team_id INTEGER,
    fantasy_team_name TEXT NOT NULL DEFAULT '',
    manager_name TEXT NOT NULL DEFAULT '',
    roster JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_snapshot_id BIGINT REFERENCES fantasyiq_espn_sync_snapshots(id) ON DELETE SET NULL,
    normalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, fantasy_team_id)
);

CREATE INDEX IF NOT EXISTS fantasyiq_normalized_rosters_league_idx
    ON fantasyiq_normalized_rosters (customer_slug, league_key, season);

CREATE TABLE IF NOT EXISTS fantasyiq_weekly_projections (
    id BIGSERIAL PRIMARY KEY,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL DEFAULT 0,
    player_key TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    projected_points NUMERIC(8, 3),
    floor_points NUMERIC(8, 3),
    ceiling_points NUMERIC(8, 3),
    projection_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (season, week, player_key, source)
);

CREATE INDEX IF NOT EXISTS fantasyiq_weekly_projections_player_idx
    ON fantasyiq_weekly_projections (season, player_key, week);

CREATE TABLE IF NOT EXISTS fantasyiq_player_signals (
    id BIGSERIAL PRIMARY KEY,
    season INTEGER NOT NULL,
    player_key TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    signal_type TEXT NOT NULL DEFAULT '',
    signal_score NUMERIC(8, 3),
    confidence NUMERIC(5, 2),
    signal_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (season, player_key, source, signal_type)
);

CREATE INDEX IF NOT EXISTS fantasyiq_player_signals_lookup_idx
    ON fantasyiq_player_signals (season, player_key, observed_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_recommendation_snapshots (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    phase TEXT NOT NULL DEFAULT '',
    recommendation_type TEXT NOT NULL DEFAULT '',
    main_move TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    player_key TEXT NOT NULL DEFAULT '',
    confidence_score NUMERIC(5, 2),
    recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_freshness_status TEXT NOT NULL DEFAULT '',
    source_snapshot_id BIGINT REFERENCES fantasyiq_espn_sync_snapshots(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_recommendation_snapshots_lookup_idx
    ON fantasyiq_recommendation_snapshots (customer_slug, league_key, phase, generated_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_waiver_recommendations (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    add_player_key TEXT NOT NULL DEFAULT '',
    drop_player_key TEXT NOT NULL DEFAULT '',
    recommendation_class TEXT NOT NULL DEFAULT '',
    projected_vor_gain NUMERIC(8, 3),
    faab_min INTEGER,
    faab_max INTEGER,
    confidence_score NUMERIC(5, 2),
    recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_waiver_recommendations_lookup_idx
    ON fantasyiq_waiver_recommendations (customer_slug, league_key, season, week, generated_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_trade_recommendations (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    user_sends JSONB NOT NULL DEFAULT '[]'::jsonb,
    user_receives JSONB NOT NULL DEFAULT '[]'::jsonb,
    opponent_team_id TEXT NOT NULL DEFAULT '',
    user_lineup_gain NUMERIC(8, 3),
    opponent_balance_gain NUMERIC(8, 3),
    confidence_score NUMERIC(5, 2),
    recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_trade_recommendations_lookup_idx
    ON fantasyiq_trade_recommendations (customer_slug, league_key, season, generated_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_manager_tendencies (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    fantasy_team_id TEXT NOT NULL DEFAULT '',
    manager_name TEXT NOT NULL DEFAULT '',
    persona TEXT NOT NULL DEFAULT '',
    tendency_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_size INTEGER NOT NULL DEFAULT 0,
    confidence_score NUMERIC(5, 2),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, fantasy_team_id)
);

CREATE INDEX IF NOT EXISTS fantasyiq_manager_tendencies_persona_idx
    ON fantasyiq_manager_tendencies (customer_slug, league_key, persona);

CREATE TABLE IF NOT EXISTS fantasyiq_draft_pick_history (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    league_id BIGINT,
    season INTEGER,
    draft_id TEXT NOT NULL DEFAULT '',
    overall_pick INTEGER,
    round_number INTEGER,
    round_pick INTEGER,
    fantasy_team_id TEXT NOT NULL DEFAULT '',
    player_key TEXT NOT NULL DEFAULT '',
    player_name TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    pick_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    picked_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, overall_pick)
);

CREATE INDEX IF NOT EXISTS fantasyiq_draft_pick_history_team_idx
    ON fantasyiq_draft_pick_history (customer_slug, league_key, season, fantasy_team_id, overall_pick);

CREATE TABLE IF NOT EXISTS fantasyiq_opponent_behavior_events (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    fantasy_team_id TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL DEFAULT '',
    player_key TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_opponent_behavior_events_lookup_idx
    ON fantasyiq_opponent_behavior_events (customer_slug, league_key, season, fantasy_team_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_data_freshness (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    source_scope TEXT NOT NULL DEFAULT '',
    last_success_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    max_age_seconds INTEGER,
    is_stale BOOLEAN NOT NULL DEFAULT false,
    warning TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, source, source_scope)
);

CREATE INDEX IF NOT EXISTS fantasyiq_data_freshness_stale_idx
    ON fantasyiq_data_freshness (is_stale, updated_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_weekly_matchups (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    user_team_id TEXT NOT NULL DEFAULT '',
    opponent_team_id TEXT NOT NULL DEFAULT '',
    user_projected_points NUMERIC(8, 3),
    opponent_projected_points NUMERIC(8, 3),
    win_probability NUMERIC(5, 4),
    matchup_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_snapshot_id BIGINT REFERENCES fantasyiq_espn_sync_snapshots(id) ON DELETE SET NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, week, user_team_id)
);

CREATE INDEX IF NOT EXISTS fantasyiq_weekly_matchups_lookup_idx
    ON fantasyiq_weekly_matchups (customer_slug, league_key, season, week);

CREATE TABLE IF NOT EXISTS fantasyiq_weekly_lineup_states (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    fantasy_team_id TEXT NOT NULL DEFAULT '',
    optimal_lineup JSONB NOT NULL DEFAULT '[]'::jsonb,
    bench_state JSONB NOT NULL DEFAULT '[]'::jsonb,
    lineup_projection NUMERIC(8, 3),
    bench_vor NUMERIC(8, 3),
    risk_score NUMERIC(5, 2),
    missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, week, fantasy_team_id)
);

CREATE INDEX IF NOT EXISTS fantasyiq_weekly_lineup_states_lookup_idx
    ON fantasyiq_weekly_lineup_states (customer_slug, league_key, season, week, evaluated_at DESC);

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS weekly_point_gain NUMERIC(8, 3);

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS rest_of_season_gain NUMERIC(8, 3);

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS roster_construction_impact NUMERIC(8, 3);

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS waiver_priority_aggression TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS main_move TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS risk_warning TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS alternative_path TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS supporting_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS data_freshness_status TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fantasyiq_waiver_recommendations
    ADD COLUMN IF NOT EXISTS fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS fantasyiq_free_agent_snapshots (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    league_id BIGINT,
    season INTEGER,
    week INTEGER,
    player_key TEXT NOT NULL DEFAULT '',
    player_name TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    projected_points NUMERIC(8, 3),
    rest_of_season_value NUMERIC(8, 3),
    rostered_percent NUMERIC(6, 3),
    start_percent NUMERIC(6, 3),
    availability_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signal_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_snapshot_id BIGINT REFERENCES fantasyiq_espn_sync_snapshots(id) ON DELETE SET NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, week, player_key)
);

CREATE INDEX IF NOT EXISTS fantasyiq_free_agent_snapshots_lookup_idx
    ON fantasyiq_free_agent_snapshots (customer_slug, league_key, season, week, position);

CREATE TABLE IF NOT EXISTS fantasyiq_waiver_sniper_runs (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    top_recommendation_id BIGINT REFERENCES fantasyiq_waiver_recommendations(id) ON DELETE SET NULL,
    do_nothing_comparison TEXT NOT NULL DEFAULT '',
    replacement_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendation_count INTEGER NOT NULL DEFAULT 0,
    missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_waiver_sniper_runs_lookup_idx
    ON fantasyiq_waiver_sniper_runs (customer_slug, league_key, season, week, generated_at DESC);

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS main_move TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS why_other_manager_may_accept TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS buy_low_score NUMERIC(6, 4);

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS sell_high_score NUMERIC(6, 4);

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS acceptance_probability NUMERIC(6, 4);

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS risk_warning TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS negotiation_angle TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS alternative_path TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS supporting_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS data_freshness_status TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fantasyiq_trade_recommendations
    ADD COLUMN IF NOT EXISTS fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS fantasyiq_trade_finder_runs (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    top_recommendation_id BIGINT REFERENCES fantasyiq_trade_recommendations(id) ON DELETE SET NULL,
    proposal_count INTEGER NOT NULL DEFAULT 0,
    buy_low_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    sell_high_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_trade_finder_runs_lookup_idx
    ON fantasyiq_trade_finder_runs (customer_slug, league_key, season, week, generated_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_value_depression_signals (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    player_key TEXT NOT NULL DEFAULT '',
    player_name TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    value_depression_score NUMERIC(6, 4),
    sell_high_score NUMERIC(6, 4),
    recent_fantasy_points NUMERIC(8, 3),
    expected_fantasy_points NUMERIC(8, 3),
    utilization_score NUMERIC(6, 3),
    touchdown_delta NUMERIC(8, 3),
    signal_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, week, player_key)
);

CREATE INDEX IF NOT EXISTS fantasyiq_value_depression_signals_lookup_idx
    ON fantasyiq_value_depression_signals (customer_slug, league_key, season, week, value_depression_score DESC);

ALTER TABLE fantasyiq_manager_tendencies
    ADD COLUMN IF NOT EXISTS primary_persona TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_manager_tendencies
    ADD COLUMN IF NOT EXISTS secondary_personas JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fantasyiq_manager_tendencies
    ADD COLUMN IF NOT EXISTS draft_non_return_pressure JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE fantasyiq_manager_tendencies
    ADD COLUMN IF NOT EXISTS waiver_competition_pressure JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE fantasyiq_manager_tendencies
    ADD COLUMN IF NOT EXISTS trade_acceptance_modifier NUMERIC(6, 4);

ALTER TABLE fantasyiq_manager_tendencies
    ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fantasyiq_opponent_behavior_events
    ADD COLUMN IF NOT EXISTS manager_name TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_opponent_behavior_events
    ADD COLUMN IF NOT EXISTS event_score NUMERIC(8, 3);

ALTER TABLE fantasyiq_opponent_behavior_events
    ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT '';

ALTER TABLE fantasyiq_opponent_behavior_events
    ADD COLUMN IF NOT EXISTS transaction_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS fantasyiq_opponent_intelligence_runs (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    manager_count INTEGER NOT NULL DEFAULT 0,
    strongest_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_data_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_logic_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_freshness_status TEXT NOT NULL DEFAULT '',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fantasyiq_opponent_intelligence_runs_lookup_idx
    ON fantasyiq_opponent_intelligence_runs (customer_slug, league_key, season, week, generated_at DESC);

CREATE TABLE IF NOT EXISTS fantasyiq_manager_persona_history (
    id BIGSERIAL PRIMARY KEY,
    customer_slug TEXT NOT NULL DEFAULT '',
    league_key TEXT NOT NULL DEFAULT '',
    season INTEGER,
    week INTEGER,
    fantasy_team_id TEXT NOT NULL DEFAULT '',
    manager_name TEXT NOT NULL DEFAULT '',
    primary_persona TEXT NOT NULL DEFAULT '',
    confidence_score NUMERIC(5, 2),
    tendency_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_slug, league_key, season, week, fantasy_team_id)
);

CREATE INDEX IF NOT EXISTS fantasyiq_manager_persona_history_lookup_idx
    ON fantasyiq_manager_persona_history (customer_slug, league_key, season, fantasy_team_id, generated_at DESC);
