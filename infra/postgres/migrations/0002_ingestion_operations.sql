BEGIN;

ALTER TYPE source_status ADD VALUE IF NOT EXISTS 'manual_only';

CREATE TYPE ingestion_run_status AS ENUM (
  'scheduled',
  'running',
  'succeeded',
  'not_modified',
  'partially_succeeded',
  'failed',
  'dead_lettered'
);

CREATE TYPE ingestion_item_status AS ENUM (
  'parsed',
  'normalised',
  'review',
  'accepted',
  'rejected',
  'failed'
);

ALTER TABLE source_registry
  ADD COLUMN compliance_version integer NOT NULL DEFAULT 1 CHECK (compliance_version > 0),
  ADD COLUMN legal_review_expires_at timestamptz,
  ADD COLUMN freshness_interval interval NOT NULL DEFAULT interval '24 hours',
  ADD COLUMN adapter_key text,
  ADD COLUMN adapter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN parser_version text;

ALTER TABLE source_registry
  ADD CONSTRAINT source_registry_legal_review_window_check
  CHECK (
    legal_review_expires_at IS NULL
    OR last_legal_reviewed_at IS NULL
    OR legal_review_expires_at >= last_legal_reviewed_at
  );

CREATE TABLE source_compliance_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL REFERENCES source_registry(id),
  compliance_version integer NOT NULL CHECK (compliance_version > 0),
  policy_snapshot jsonb NOT NULL,
  changed_by uuid,
  change_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registry_id, compliance_version)
);

CREATE TABLE source_fetch_state (
  source_id uuid PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  etag text,
  last_modified text,
  last_attempted_at timestamptz,
  last_succeeded_at timestamptz,
  next_eligible_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_content_hash char(64),
  lease_owner text,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX source_fetch_state_due_idx
  ON source_fetch_state(next_eligible_at)
  WHERE lease_owner IS NULL;

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id),
  registry_id uuid NOT NULL REFERENCES source_registry(id),
  compliance_version integer NOT NULL CHECK (compliance_version > 0),
  compliance_snapshot jsonb NOT NULL,
  adapter_key text NOT NULL,
  parser_version text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  status ingestion_run_status NOT NULL DEFAULT 'scheduled',
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  correlation_id text NOT NULL,
  request_etag text,
  request_last_modified text,
  response_http_status integer CHECK (response_http_status BETWEEN 100 AND 599),
  source_snapshot_id uuid REFERENCES source_snapshots(id),
  fetched_bytes integer CHECK (fetched_bytes IS NULL OR fetched_bytes >= 0),
  discovered_count integer NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  error_category text,
  error_detail text,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
  UNIQUE (source_id, scheduled_for, attempt_number),
  UNIQUE (correlation_id)
);
CREATE INDEX ingestion_runs_source_started_idx
  ON ingestion_runs(source_id, started_at DESC);
CREATE INDEX ingestion_runs_retry_idx
  ON ingestion_runs(next_retry_at)
  WHERE status IN ('failed', 'partially_succeeded');

CREATE TABLE ingestion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_item_key text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('job', 'company_event')),
  status ingestion_item_status NOT NULL DEFAULT 'parsed',
  content_hash char(64) NOT NULL,
  raw_payload jsonb NOT NULL,
  normalised_payload jsonb,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  resulting_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingestion_run_id, source_item_key)
);
CREATE INDEX ingestion_items_review_idx
  ON ingestion_items(status, created_at)
  WHERE status IN ('review', 'failed');

CREATE TABLE ingestion_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid REFERENCES ingestion_runs(id),
  source_id uuid NOT NULL REFERENCES sources(id),
  source_item_key text,
  error_category text NOT NULL,
  error_detail text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  payload_reference text,
  payload_excerpt text,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  CHECK (last_failed_at >= first_failed_at)
);
CREATE INDEX ingestion_dead_letters_open_idx
  ON ingestion_dead_letters(next_retry_at, last_failed_at)
  WHERE resolved_at IS NULL;

ALTER TABLE jobs
  ADD COLUMN missing_observation_count integer NOT NULL DEFAULT 0
    CHECK (missing_observation_count >= 0);

CREATE TABLE job_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ingestion_run_id uuid REFERENCES ingestion_runs(id),
  source_snapshot_id uuid REFERENCES source_snapshots(id),
  observed_at timestamptz NOT NULL,
  observation_type text NOT NULL CHECK (
    observation_type IN ('discovered', 'seen', 'changed', 'missing', 'closed', 'reopened')
  ),
  content_hash char(64),
  observed_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, ingestion_run_id, observation_type)
);
CREATE INDEX job_observations_job_time_idx
  ON job_observations(job_id, observed_at DESC);

COMMIT;
