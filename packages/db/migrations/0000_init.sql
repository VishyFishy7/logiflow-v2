-- LogiFlow v2 — initial schema (PRD §6.1)
-- Engine: SQLite. Every identifier is text (cuid2) so the schema ports to
-- Postgres without touching the repositories. Money is integer paise;
-- timestamps are integer UTC milliseconds.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  company_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  tracking_prefix TEXT NOT NULL,
  support_email TEXT NOT NULL DEFAULT '',
  theme_primary TEXT NOT NULL DEFAULT '#0ea5e9',
  theme_primary_dark TEXT NOT NULL DEFAULT '#38bdf8',
  theme_accent TEXT NOT NULL DEFAULT '#0ea5e9',
  theme_sidebar_bg TEXT NOT NULL DEFAULT '#fafafa',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency TEXT NOT NULL DEFAULT 'INR',
  plan TEXT NOT NULL DEFAULT 'trial',
  mask_policy TEXT NOT NULL DEFAULT 'last2',
  public_tracking_enabled INTEGER NOT NULL DEFAULT 1,
  delay_reasons TEXT NOT NULL,
  lead_sources TEXT NOT NULL,
  invite_only INTEGER NOT NULL DEFAULT 0,
  audit_retention_months INTEGER NOT NULL DEFAULT 24,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uq ON tenants (slug);

CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  year INTEGER NOT NULL,
  value INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS sequences_tenant_key_year_uq ON sequences (tenant_id, key, year);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_body TEXT,
  status_code INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_tenant_key_uq ON idempotency_keys (tenant_id, key);
CREATE INDEX IF NOT EXISTS idempotency_expires_idx ON idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  blocked_until INTEGER,
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_bucket_uq ON rate_limits (bucket);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER,
  invited_by TEXT,
  theme_pref TEXT,
  notification_prefs TEXT,
  sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_uq ON users (tenant_id, email);
CREATE INDEX IF NOT EXISTS users_tenant_role_idx ON users (tenant_id, role);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  expires_at INTEGER NOT NULL,
  absolute_expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_uq ON sessions (token);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_uq ON accounts (provider, provider_account_id);

CREATE TABLE IF NOT EXISTS invite_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL,
  role TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS invite_tokens_token_uq ON invite_tokens (token);
CREATE INDEX IF NOT EXISTS invite_tokens_user_idx ON invite_tokens (user_id);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  credit_terms_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_name_uq ON clients (tenant_id, name);
CREATE INDEX IF NOT EXISTS clients_tenant_active_idx ON clients (tenant_id, active);

CREATE TABLE IF NOT EXISTS carriers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'mock',
  tracking_url_template TEXT,
  webhook_secret_ref TEXT,
  webhook_secret TEXT,
  supports_webhook INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS carriers_tenant_code_uq ON carriers (tenant_id, code);
CREATE INDEX IF NOT EXISTS carriers_tenant_active_idx ON carriers (tenant_id, active);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  tracking_id TEXT NOT NULL,
  carrier_tracking_id TEXT,
  carrier_tracking_id_set_at INTEGER,
  client_id TEXT NOT NULL REFERENCES clients(id),
  carrier_id TEXT NOT NULL REFERENCES carriers(id),
  reference_number TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  origin_pincode TEXT,
  destination_pincode TEXT,
  invoice_number TEXT,
  packages INTEGER NOT NULL DEFAULT 1,
  weight_grams INTEGER NOT NULL DEFAULT 0,
  declared_value_paise INTEGER,
  service_level TEXT NOT NULL DEFAULT 'surface',
  payment_mode TEXT NOT NULL DEFAULT 'prepaid',
  status TEXT NOT NULL DEFAULT 'pickup',
  assigned_to TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expected_delivery INTEGER NOT NULL,
  delivered_at INTEGER,
  delay_reason TEXT,
  notes TEXT,
  last_synced_at INTEGER,
  sync_state TEXT NOT NULL DEFAULT 'manual',
  sync_failures INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  deleted_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS shipments_tenant_tracking_uq ON shipments (tenant_id, tracking_id);
CREATE INDEX IF NOT EXISTS shipments_tenant_created_idx ON shipments (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS shipments_tenant_status_idx ON shipments (tenant_id, status);
CREATE INDEX IF NOT EXISTS shipments_tenant_carrier_idx ON shipments (tenant_id, carrier_id);
CREATE INDEX IF NOT EXISTS shipments_tenant_client_idx ON shipments (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS shipments_tenant_assigned_idx ON shipments (tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS shipments_tenant_carrier_tracking_idx ON shipments (tenant_id, carrier_tracking_id);
CREATE INDEX IF NOT EXISTS shipments_deleted_idx ON shipments (deleted_at);

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  status TEXT NOT NULL,
  label TEXT NOT NULL,
  location TEXT,
  note TEXT,
  delay_reason TEXT,
  occurred_at INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  by_user_id TEXT,
  by_user_name TEXT,
  raw_status TEXT,
  raw_payload TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS checkpoints_shipment_occurred_idx ON checkpoints (shipment_id, occurred_at);
CREATE INDEX IF NOT EXISTS checkpoints_tenant_idx ON checkpoints (tenant_id);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  next_follow_up INTEGER,
  expected_value_paise INTEGER,
  converted_client_id TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_tenant_status_idx ON leads (tenant_id, status);
CREATE INDEX IF NOT EXISTS leads_tenant_assigned_idx ON leads (tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS leads_next_follow_up_idx ON leads (tenant_id, next_follow_up);

CREATE TABLE IF NOT EXISTS lead_activities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  kind TEXT NOT NULL DEFAULT 'note',
  text TEXT NOT NULL,
  by_user_id TEXT,
  by_user_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON lead_activities (lead_id, created_at);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  number TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_paise INTEGER NOT NULL DEFAULT 0,
  tax_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  issue_date INTEGER NOT NULL,
  due_date INTEGER NOT NULL,
  paid_at INTEGER,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_number_uq ON invoices (tenant_id, number);
CREATE INDEX IF NOT EXISTS invoices_tenant_status_idx ON invoices (tenant_id, status);
CREATE INDEX IF NOT EXISTS invoices_tenant_due_idx ON invoices (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS invoices_tenant_client_idx ON invoices (tenant_id, client_id);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  shipment_id TEXT REFERENCES shipments(id),
  description TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  tax_rate_bp INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_lines_shipment_idx ON invoice_lines (shipment_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  shipment_id TEXT,
  invoice_id TEXT,
  read_at INTEGER,
  channels_sent TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_tenant_created_idx ON notifications (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (tenant_id, user_id, read_at);

-- Append-only. The triggers below are the enforcement, not a convention.
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  occurred_at INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  actor_avatar_url TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  summary TEXT NOT NULL,
  changes TEXT,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web'
);
CREATE INDEX IF NOT EXISTS audit_tenant_occurred_idx ON audit_events (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS audit_tenant_actor_idx ON audit_events (tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS audit_tenant_entity_idx ON audit_events (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_tenant_action_idx ON audit_events (tenant_id, action);
CREATE INDEX IF NOT EXISTS audit_tenant_severity_idx ON audit_events (tenant_id, severity);

CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is rejected');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is rejected');
END;

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments (tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL,
  payload TEXT,
  natural_key TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  locked_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_natural_key_uq ON jobs (natural_key);
CREATE INDEX IF NOT EXISTS jobs_status_run_at_idx ON jobs (status, run_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  notification_id TEXT NOT NULL REFERENCES notifications(id),
  channel TEXT NOT NULL,
  to_address TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  detail TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notification_deliveries_notification_idx ON notification_deliveries (notification_id);
