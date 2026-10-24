create table if not exists public.itwd_cms_content (
  type text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.itwd_cms_content enable row level security;
grant all on table public.itwd_cms_content to service_role;
