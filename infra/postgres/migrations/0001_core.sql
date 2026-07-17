BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE record_status AS ENUM ('draft', 'review', 'published', 'superseded', 'withdrawn');
CREATE TYPE confidence_tier AS ENUM ('high', 'medium', 'limited', 'unknown');
CREATE TYPE source_status AS ENUM ('active', 'blocked');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'amended', 'rejected', 'escalated');

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  website_domain text,
  hq_country_code char(2),
  industry text,
  status record_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (website_domain)
);
CREATE INDEX companies_name_trgm_idx ON companies USING gin (canonical_name gin_trgm_ops);

CREATE TABLE company_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  alias text NOT NULL,
  alias_type text NOT NULL CHECK (alias_type IN ('brand', 'former_name', 'ats', 'abbreviation', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, alias)
);
CREATE INDEX company_aliases_alias_trgm_idx ON company_aliases USING gin (alias gin_trgm_ops);

CREATE TABLE legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  legal_name text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'IN',
  registration_identifier text,
  status record_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, registration_identifier)
);

CREATE TABLE cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  state_name text NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'IN',
  slug text NOT NULL UNIQUE,
  UNIQUE (canonical_name, state_name, country_code)
);

CREATE TABLE city_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities(id),
  alias text NOT NULL,
  UNIQUE (city_id, alias)
);

CREATE TABLE gcc_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id),
  primary_legal_entity_id uuid REFERENCES legal_entities(id),
  launch_date date,
  mandate_summary text,
  headcount_min integer CHECK (headcount_min IS NULL OR headcount_min >= 0),
  headcount_max integer CHECK (headcount_max IS NULL OR headcount_max >= headcount_min),
  workplace_model text CHECK (workplace_model IN ('remote', 'hybrid', 'on_site', 'flexible', 'unknown')),
  status record_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gcc_profile_id uuid NOT NULL REFERENCES gcc_profiles(id),
  city_id uuid NOT NULL REFERENCES cities(id),
  address_text text,
  opened_on date,
  closed_on date,
  is_primary boolean NOT NULL DEFAULT false,
  status record_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closed_on IS NULL OR opened_on IS NULL OR closed_on >= opened_on)
);
CREATE INDEX offices_city_idx ON offices(city_id) WHERE closed_on IS NULL;

CREATE TABLE source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  source_type text NOT NULL,
  permitted_method text NOT NULL,
  robots_status text NOT NULL,
  terms_review_status text NOT NULL,
  rate_limit_per_minute integer NOT NULL CHECK (rate_limit_per_minute > 0),
  attribution_requirement text,
  retention_rule text NOT NULL,
  allowed_fields text[] NOT NULL DEFAULT '{}',
  last_legal_reviewed_at timestamptz,
  status source_status NOT NULL DEFAULT 'blocked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, source_type)
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL REFERENCES source_registry(id),
  canonical_url text NOT NULL UNIQUE,
  publisher text NOT NULL,
  title text,
  publication_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id),
  fetched_at timestamptz NOT NULL,
  content_hash char(64) NOT NULL,
  object_key text NOT NULL,
  http_status integer NOT NULL,
  parser_version text,
  retained_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, content_hash)
);
CREATE INDEX source_snapshots_latest_idx ON source_snapshots(source_id, fetched_at DESC);

CREATE TABLE company_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  city_id uuid REFERENCES cities(id),
  event_type text NOT NULL CHECK (event_type IN ('launch', 'expansion', 'leadership', 'hiring', 'contraction', 'closure', 'other')),
  event_date date,
  title text NOT NULL,
  summary text,
  status record_status NOT NULL DEFAULT 'draft',
  confidence confidence_tier NOT NULL DEFAULT 'unknown',
  confidence_reason text NOT NULL,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_events_company_date_idx ON company_events(company_id, event_date DESC);
CREATE INDEX company_events_city_date_idx ON company_events(city_id, event_date DESC);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  city_id uuid REFERENCES cities(id),
  external_id text NOT NULL,
  source_id uuid NOT NULL REFERENCES sources(id),
  raw_title text NOT NULL,
  normalized_title text,
  role_family text,
  career_level text,
  workplace_type text,
  published_at timestamptz,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  closed_at timestamptz,
  description_hash char(64),
  application_url text NOT NULL,
  confidence confidence_tier NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id),
  CHECK (last_seen_at >= first_seen_at),
  CHECK (closed_at IS NULL OR closed_at >= first_seen_at)
);
CREATE INDEX jobs_active_company_idx ON jobs(company_id, last_seen_at DESC) WHERE closed_at IS NULL;
CREATE INDEX jobs_active_city_idx ON jobs(city_id, last_seen_at DESC) WHERE closed_at IS NULL;

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  extracted_value jsonb NOT NULL,
  source_id uuid NOT NULL REFERENCES sources(id),
  source_snapshot_id uuid REFERENCES source_snapshots(id),
  evidence_snippet text,
  extraction_method text NOT NULL,
  extraction_confidence numeric(5,4) CHECK (extraction_confidence BETWEEN 0 AND 1),
  review_status review_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  reviewed_at timestamptz,
  last_verified_at timestamptz,
  model_version text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_entity_field_idx ON evidence(entity_type, entity_id, field_name);
CREATE INDEX evidence_review_queue_idx ON evidence(review_status, created_at) WHERE review_status IN ('pending', 'escalated');

CREATE TABLE entity_merge_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  surviving_entity_id uuid NOT NULL,
  merged_entity_id uuid NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  reason text NOT NULL,
  actor_id uuid NOT NULL,
  reversed_at timestamptz,
  reversed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);

INSERT INTO cities (canonical_name, state_name, slug) VALUES
  ('Bengaluru', 'Karnataka', 'bengaluru'),
  ('Hyderabad', 'Telangana', 'hyderabad'),
  ('Pune', 'Maharashtra', 'pune');

COMMIT;
