
## table accounts  (export accounts)
- id :: SQLiteText NOT NULL PK
- user_id :: SQLiteText NOT NULL
- provider :: SQLiteText NOT NULL
- provider_account_id :: SQLiteText NOT NULL
- access_token :: SQLiteText null
- refresh_token :: SQLiteText null
- expires_at :: SQLiteInteger null
- created_at :: SQLiteInteger NOT NULL

## table attachments  (export attachments)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- entity_type :: SQLiteText NOT NULL
- entity_id :: SQLiteText NOT NULL
- filename :: SQLiteText NOT NULL
- mime :: SQLiteText NOT NULL
- size :: SQLiteInteger NOT NULL
- storage_key :: SQLiteText NOT NULL
- uploaded_by :: SQLiteText null
- created_at :: SQLiteInteger NOT NULL

## table audit_events  (export auditEvents)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- occurred_at :: SQLiteInteger NOT NULL
- actor_type :: SQLiteText NOT NULL
- actor_id :: SQLiteText null
- actor_name :: SQLiteText NOT NULL
- actor_avatar_url :: SQLiteText null
- action :: SQLiteText NOT NULL
- entity_type :: SQLiteText NOT NULL
- entity_id :: SQLiteText NOT NULL
- entity_label :: SQLiteText NOT NULL
- severity :: SQLiteText NOT NULL default
- summary :: SQLiteText NOT NULL
- changes :: SQLiteTextJson null
- ip :: SQLiteText null
- user_agent :: SQLiteText null
- request_id :: SQLiteText NOT NULL
- source :: SQLiteText NOT NULL default

## table carriers  (export carriers)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- code :: SQLiteText NOT NULL
- name :: SQLiteText NOT NULL
- adapter :: SQLiteText NOT NULL default
- tracking_url_template :: SQLiteText null
- webhook_secret_ref :: SQLiteText null
- webhook_secret :: SQLiteText null
- supports_webhook :: SQLiteBoolean NOT NULL default
- active :: SQLiteBoolean NOT NULL default
- priority :: SQLiteInteger NOT NULL default
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL

## table checkpoints  (export checkpoints)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- shipment_id :: SQLiteText NOT NULL
- status :: SQLiteText NOT NULL
- label :: SQLiteText NOT NULL
- location :: SQLiteText null
- note :: SQLiteText null
- delay_reason :: SQLiteText null
- occurred_at :: SQLiteInteger NOT NULL
- recorded_at :: SQLiteInteger NOT NULL
- source :: SQLiteText NOT NULL default
- by_user_id :: SQLiteText null
- by_user_name :: SQLiteText null
- raw_status :: SQLiteText null
- raw_payload :: SQLiteTextJson null
- created_at :: SQLiteInteger NOT NULL

## table clients  (export clients)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- name :: SQLiteText NOT NULL
- contact_name :: SQLiteText null
- email :: SQLiteText null
- phone :: SQLiteText null
- gstin :: SQLiteText null
- address_line1 :: SQLiteText null
- address_line2 :: SQLiteText null
- city :: SQLiteText null
- state :: SQLiteText null
- pincode :: SQLiteText null
- credit_terms_days :: SQLiteInteger null
- active :: SQLiteBoolean NOT NULL default
- created_by :: SQLiteText null
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL

## table idempotency_keys  (export idempotencyKeys)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- key :: SQLiteText NOT NULL
- route :: SQLiteText NOT NULL
- request_hash :: SQLiteText NOT NULL
- response_body :: SQLiteText null
- status_code :: SQLiteInteger null
- expires_at :: SQLiteInteger NOT NULL
- created_at :: SQLiteInteger NOT NULL

## table invite_tokens  (export inviteTokens)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- user_id :: SQLiteText NOT NULL
- token :: SQLiteText NOT NULL
- role :: SQLiteText NOT NULL
- invited_by :: SQLiteText NOT NULL
- expires_at :: SQLiteInteger NOT NULL
- accepted_at :: SQLiteInteger null
- created_at :: SQLiteInteger NOT NULL

## table invoice_lines  (export invoiceLines)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- invoice_id :: SQLiteText NOT NULL
- shipment_id :: SQLiteText null
- description :: SQLiteText NOT NULL
- amount_paise :: SQLiteInteger NOT NULL
- tax_rate_bp :: SQLiteInteger NOT NULL default
- created_at :: SQLiteInteger NOT NULL

## table invoices  (export invoices)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- number :: SQLiteText NOT NULL
- client_id :: SQLiteText NOT NULL
- status :: SQLiteText NOT NULL default
- subtotal_paise :: SQLiteInteger NOT NULL default
- tax_paise :: SQLiteInteger NOT NULL default
- total_paise :: SQLiteInteger NOT NULL default
- currency :: SQLiteText NOT NULL default
- issue_date :: SQLiteInteger NOT NULL
- due_date :: SQLiteInteger NOT NULL
- paid_at :: SQLiteInteger null
- notes :: SQLiteText null
- created_by :: SQLiteText NOT NULL
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL

## table jobs  (export jobs)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- type :: SQLiteText NOT NULL
- payload :: SQLiteTextJson null
- natural_key :: SQLiteText NOT NULL
- run_at :: SQLiteInteger NOT NULL
- attempts :: SQLiteInteger NOT NULL default
- last_error :: SQLiteText null
- status :: SQLiteText NOT NULL default
- locked_at :: SQLiteInteger null
- finished_at :: SQLiteInteger null
- created_at :: SQLiteInteger NOT NULL

## table lead_activities  (export leadActivities)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- lead_id :: SQLiteText NOT NULL
- kind :: SQLiteText NOT NULL default
- text :: SQLiteText NOT NULL
- by_user_id :: SQLiteText null
- by_user_name :: SQLiteText null
- created_at :: SQLiteInteger NOT NULL

## table leads  (export leads)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- name :: SQLiteText NOT NULL
- company :: SQLiteText NOT NULL
- email :: SQLiteText null
- phone :: SQLiteText null
- source :: SQLiteText NOT NULL
- status :: SQLiteText NOT NULL default
- assigned_to :: SQLiteText null
- notes :: SQLiteText null
- next_follow_up :: SQLiteInteger null
- expected_value_paise :: SQLiteInteger null
- converted_client_id :: SQLiteText null
- created_by :: SQLiteText NOT NULL
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL

## table notification_deliveries  (export notificationDeliveries)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- notification_id :: SQLiteText NOT NULL
- channel :: SQLiteText NOT NULL
- to_address :: SQLiteText null
- status :: SQLiteText NOT NULL default
- detail :: SQLiteText null
- created_at :: SQLiteInteger NOT NULL

## table notifications  (export notifications)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- user_id :: SQLiteText null
- type :: SQLiteText NOT NULL
- title :: SQLiteText NOT NULL
- message :: SQLiteText NOT NULL
- shipment_id :: SQLiteText null
- invoice_id :: SQLiteText null
- read_at :: SQLiteInteger null
- channels_sent :: SQLiteTextJson NOT NULL
- created_at :: SQLiteInteger NOT NULL

## table rate_limits  (export rateLimits)
- id :: SQLiteText NOT NULL PK
- bucket :: SQLiteText NOT NULL
- count :: SQLiteInteger NOT NULL default
- window_start :: SQLiteInteger NOT NULL
- blocked_until :: SQLiteInteger null
- failures :: SQLiteInteger NOT NULL default

## table sequences  (export sequences)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- key :: SQLiteText NOT NULL
- year :: SQLiteInteger NOT NULL
- value :: SQLiteInteger NOT NULL default

## table sessions  (export sessions)
- id :: SQLiteText NOT NULL PK
- token :: SQLiteText NOT NULL
- user_id :: SQLiteText NOT NULL
- tenant_id :: SQLiteText NOT NULL
- role :: SQLiteText NOT NULL
- user_agent :: SQLiteText null
- ip :: SQLiteText null
- expires_at :: SQLiteInteger NOT NULL
- absolute_expires_at :: SQLiteInteger NOT NULL
- revoked_at :: SQLiteInteger null
- created_at :: SQLiteInteger NOT NULL
- last_seen_at :: SQLiteInteger NOT NULL

## table shipments  (export shipments)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- tracking_id :: SQLiteText NOT NULL
- carrier_tracking_id :: SQLiteText null
- carrier_tracking_id_set_at :: SQLiteInteger null
- client_id :: SQLiteText NOT NULL
- carrier_id :: SQLiteText NOT NULL
- reference_number :: SQLiteText null
- origin :: SQLiteText NOT NULL
- destination :: SQLiteText NOT NULL
- origin_pincode :: SQLiteText null
- destination_pincode :: SQLiteText null
- invoice_number :: SQLiteText null
- packages :: SQLiteInteger NOT NULL default
- weight_grams :: SQLiteInteger NOT NULL default
- declared_value_paise :: SQLiteInteger null
- service_level :: SQLiteText NOT NULL default
- payment_mode :: SQLiteText NOT NULL default
- status :: SQLiteText NOT NULL default
- assigned_to :: SQLiteText null
- created_by :: SQLiteText NOT NULL
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL
- expected_delivery :: SQLiteInteger NOT NULL
- delivered_at :: SQLiteInteger null
- delay_reason :: SQLiteText null
- notes :: SQLiteText null
- last_synced_at :: SQLiteInteger null
- sync_state :: SQLiteText NOT NULL default
- sync_failures :: SQLiteInteger NOT NULL default
- deleted_at :: SQLiteInteger null
- deleted_by :: SQLiteText null

## table tenants  (export tenants)
- id :: SQLiteText NOT NULL PK
- slug :: SQLiteText NOT NULL
- company_name :: SQLiteText NOT NULL
- product_name :: SQLiteText NOT NULL
- tagline :: SQLiteText NOT NULL default
- tracking_prefix :: SQLiteText NOT NULL
- support_email :: SQLiteText NOT NULL default
- theme_primary :: SQLiteText NOT NULL default
- theme_primary_dark :: SQLiteText NOT NULL default
- theme_accent :: SQLiteText NOT NULL default
- theme_sidebar_bg :: SQLiteText NOT NULL default
- timezone :: SQLiteText NOT NULL default
- currency :: SQLiteText NOT NULL default
- plan :: SQLiteText NOT NULL default
- mask_policy :: SQLiteText NOT NULL default
- public_tracking_enabled :: SQLiteBoolean NOT NULL default
- delay_reasons :: SQLiteTextJson NOT NULL
- lead_sources :: SQLiteTextJson NOT NULL
- invite_only :: SQLiteBoolean NOT NULL default
- audit_retention_months :: SQLiteInteger NOT NULL default
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL

## table users  (export users)
- id :: SQLiteText NOT NULL PK
- tenant_id :: SQLiteText NOT NULL
- name :: SQLiteText NOT NULL
- email :: SQLiteText NOT NULL
- phone :: SQLiteText null
- role :: SQLiteText NOT NULL
- avatar_url :: SQLiteText null
- password_hash :: SQLiteText NOT NULL
- active :: SQLiteBoolean NOT NULL default
- last_login_at :: SQLiteInteger null
- invited_by :: SQLiteText null
- theme_pref :: SQLiteText null
- notification_prefs :: SQLiteTextJson null
- sidebar_collapsed :: SQLiteBoolean NOT NULL default
- failed_logins :: SQLiteInteger NOT NULL default
- locked_until :: SQLiteInteger null
- created_at :: SQLiteInteger NOT NULL
- updated_at :: SQLiteInteger NOT NULL
