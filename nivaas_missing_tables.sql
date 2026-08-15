-- =====================================================================
-- NIVAAS — Missing tables for Supabase (PostgreSQL)
-- Run this in Supabase Dashboard → SQL Editor AFTER nivaas_supabase.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 15. nivaas_notifications
-- ---------------------------------------------------------------------
create table if not exists nivaas_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references nivaas_users(id) on delete cascade,
  type        varchar(50) not null,
  title       varchar(255) not null,
  body        text,
  link        varchar(500),
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notif_user   on nivaas_notifications (user_id);
create index if not exists idx_notif_read   on nivaas_notifications (user_id, is_read);

alter table nivaas_notifications enable row level security;
create policy "allow all - nivaas_notifications"
  on nivaas_notifications for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- 16. nivaas_complaints
-- ---------------------------------------------------------------------
create table if not exists nivaas_complaints (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid references nivaas_properties(id) on delete set null,
  reporter_id       uuid not null references nivaas_users(id) on delete cascade,
  reported_user_id  uuid references nivaas_users(id) on delete set null,
  category          varchar(50) not null default 'other',
  subject           varchar(255) not null,
  description       text not null,
  status            varchar(20) not null default 'open'
                      check (status in ('open','in_progress','resolved','closed')),
  admin_notes       text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_complaint_reporter  on nivaas_complaints (reporter_id);
create index if not exists idx_complaint_property  on nivaas_complaints (property_id);

create trigger trg_complaints_updated_at
  before update on nivaas_complaints
  for each row execute function set_updated_at();

alter table nivaas_complaints enable row level security;
create policy "allow all - nivaas_complaints"
  on nivaas_complaints for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- 17. nivaas_documents
-- ---------------------------------------------------------------------
create table if not exists nivaas_documents (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references nivaas_users(id) on delete cascade,
  property_id  uuid references nivaas_properties(id) on delete set null,
  doc_type     varchar(50) not null default 'other',
  title        varchar(255) not null,
  file_url     varchar(1000) not null,
  file_name    varchar(255),
  file_size    integer,
  is_verified  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_doc_owner    on nivaas_documents (owner_id);
create index if not exists idx_doc_property on nivaas_documents (property_id);

create trigger trg_documents_updated_at
  before update on nivaas_documents
  for each row execute function set_updated_at();

alter table nivaas_documents enable row level security;
create policy "allow all - nivaas_documents"
  on nivaas_documents for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- 18. nivaas_audit_logs
-- ---------------------------------------------------------------------
create table if not exists nivaas_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references nivaas_users(id) on delete set null,
  action      varchar(100) not null,
  entity      varchar(50),
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_actor  on nivaas_audit_logs (actor_id);
create index if not exists idx_audit_entity on nivaas_audit_logs (entity, entity_id);

alter table nivaas_audit_logs enable row level security;
create policy "allow all - nivaas_audit_logs"
  on nivaas_audit_logs for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- 19. nivaas_pricing_suggestions  (cache / non-critical)
-- ---------------------------------------------------------------------
create table if not exists nivaas_pricing_suggestions (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid references nivaas_properties(id) on delete set null,
  city               varchar(100) not null,
  locality           varchar(255),
  property_type      varchar(50) not null,
  listing_type       varchar(10) not null,
  bedrooms           smallint,
  area_sqft          numeric(10,2),
  suggested_min      numeric(14,2),
  suggested_max      numeric(14,2),
  suggested_optimal  numeric(14,2),
  basis              jsonb,
  created_at         timestamptz not null default now()
);

alter table nivaas_pricing_suggestions enable row level security;
create policy "allow all - nivaas_pricing_suggestions"
  on nivaas_pricing_suggestions for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- 20. nivaas_verification_logs
-- ---------------------------------------------------------------------
create table if not exists nivaas_verification_logs (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references nivaas_properties(id) on delete cascade,
  verifier_id  uuid not null references nivaas_users(id) on delete cascade,
  action       varchar(50) not null,
  notes        text,
  report_url   varchar(1000),
  created_at   timestamptz not null default now()
);

create index if not exists idx_vlog_property on nivaas_verification_logs (property_id);

alter table nivaas_verification_logs enable row level security;
create policy "allow all - nivaas_verification_logs"
  on nivaas_verification_logs for all using (true) with check (true);
