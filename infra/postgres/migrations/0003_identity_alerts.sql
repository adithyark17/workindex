BEGIN;

CREATE TYPE user_account_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE identity_provider AS ENUM ('clerk', 'fixture');
CREATE TYPE workindex_user_role AS ENUM ('candidate', 'moderator', 'admin');
CREATE TYPE consent_state AS ENUM ('granted', 'withdrawn');
CREATE TYPE alert_kind AS ENUM ('company_updates', 'new_jobs', 'gcc_launches', 'gcc_expansions');
CREATE TYPE alert_frequency AS ENUM ('instant', 'daily', 'weekly');
CREATE TYPE alert_status AS ENUM ('active', 'paused', 'deleted');
CREATE TYPE notification_channel AS ENUM ('email');
CREATE TYPE notification_delivery_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'delayed',
  'bounced',
  'complained',
  'failed',
  'suppressed'
);
CREATE TYPE webhook_processing_status AS ENUM ('processing', 'processed', 'failed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email text,
  display_name text,
  status user_account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (primary_email IS NULL OR primary_email = lower(trim(primary_email))),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX users_primary_email_unique_idx
  ON users (lower(primary_email))
  WHERE primary_email IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider identity_provider NOT NULL,
  provider_subject text NOT NULL,
  provider_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  CHECK (provider_email IS NULL OR provider_email = lower(trim(provider_email)))
);
CREATE INDEX user_identities_user_idx ON user_identities(user_id);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role workindex_user_role NOT NULL,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, role),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX user_roles_active_idx ON user_roles(role, user_id) WHERE revoked_at IS NULL;

CREATE TABLE company_saves (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX company_saves_company_idx ON company_saves(company_id, created_at DESC);

-- Append-only consent history. Current consent is the newest event for a
-- user/purpose pair; policy_version preserves the exact text accepted.
CREATE TABLE consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('terms', 'privacy', 'alerts', 'newsletter', 'product_updates')),
  state consent_state NOT NULL,
  policy_version text NOT NULL,
  captured_via text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX consent_events_current_idx ON consent_events(user_id, purpose, occurred_at DESC);

CREATE TABLE notification_preferences (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (topic IN ('alerts', 'newsletter', 'product_updates')),
  channel notification_channel NOT NULL DEFAULT 'email',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic, channel)
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  kind alert_kind NOT NULL,
  criteria jsonb NOT NULL,
  frequency alert_frequency NOT NULL DEFAULT 'weekly',
  channel notification_channel NOT NULL DEFAULT 'email',
  status alert_status NOT NULL DEFAULT 'active',
  last_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (jsonb_typeof(criteria) = 'object'),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);
CREATE INDEX alerts_active_user_idx ON alerts(user_id, created_at DESC) WHERE status <> 'deleted';
CREATE INDEX alerts_due_idx ON alerts(frequency, last_evaluated_at) WHERE status = 'active';
CREATE INDEX alerts_criteria_gin_idx ON alerts USING gin(criteria);

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES alerts(id) ON DELETE SET NULL,
  message_kind text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('resend', 'fixture')),
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  status notification_delivery_status NOT NULL DEFAULT 'queued',
  recipient_hash char(64) NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider, provider_message_id),
  CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX notification_deliveries_user_idx ON notification_deliveries(user_id, queued_at DESC);
CREATE INDEX notification_deliveries_alert_idx ON notification_deliveries(alert_id, queued_at DESC)
  WHERE alert_id IS NOT NULL;

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('clerk', 'resend')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash char(64) NOT NULL,
  status webhook_processing_status NOT NULL DEFAULT 'processing',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_code text,
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX webhook_events_failed_idx ON webhook_events(provider, received_at)
  WHERE status = 'failed';

COMMIT;
