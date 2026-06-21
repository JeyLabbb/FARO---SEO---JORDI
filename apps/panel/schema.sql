-- ============================================================================
-- Faro · Panel de cliente — esquema Supabase (multi-tenant con RLS)
-- ----------------------------------------------------------------------------
-- Cada cliente (negocio) tiene su ficha. Los usuarios (dueños) entran con su
-- email+password y SOLO ven los datos de su(s) negocio(s) gracias a RLS.
-- Los datos los escribe el pipeline (cron) con la SERVICE KEY (salta RLS).
-- ============================================================================

-- 1) Negocios -----------------------------------------------------------------
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,           -- p.ej. "auraa"
  name            text not null,
  city            text,
  website         text,
  google_place_id text,
  brand           text default 'Faro',
  active          boolean default true,
  created_at      timestamptz default now()
);

-- 2) Qué usuario puede ver qué negocio ---------------------------------------
create table if not exists public.client_users (
  client_id uuid references public.clients(id) on delete cascade,
  user_id   uuid references auth.users(id)     on delete cascade,
  role      text default 'owner',
  primary key (client_id, user_id)
);

-- 3) Snapshot semanal de métricas (= histórico real) --------------------------
create table if not exists public.snapshots (
  id          bigint generated always as identity primary key,
  client_id   uuid references public.clients(id) on delete cascade,
  captured_at date not null default current_date,
  visibility  int,
  reviews     int,
  rating      numeric(2,1),
  avg_pos     numeric(4,1),
  est_calls   int,
  est_clicks  int,
  est_views   int,
  est_routes  int,
  unique (client_id, captured_at)
);

-- 4) Posición por keyword en el tiempo ---------------------------------------
create table if not exists public.rankings (
  id          bigint generated always as identity primary key,
  client_id   uuid references public.clients(id) on delete cascade,
  captured_at date not null default current_date,
  keyword     text not null,
  position    int
);
create index if not exists rankings_client_kw on public.rankings (client_id, keyword, captured_at);

-- 5) Reseñas (muestra) --------------------------------------------------------
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  client_id   uuid references public.clients(id) on delete cascade,
  author      text,
  rating      int,
  body        text,
  review_when text,
  captured_at date default current_date
);

-- 6) Competidores (muestra) ---------------------------------------------------
create table if not exists public.competitors (
  id          bigint generated always as identity primary key,
  client_id   uuid references public.clients(id) on delete cascade,
  name        text,
  reviews     int,
  rating      numeric(2,1),
  captured_at date default current_date
);

-- 7) Feed de actividad (lo que trabaja Faro) ---------------------------------
create table if not exists public.activity (
  id          bigint generated always as identity primary key,
  client_id   uuid references public.clients(id) on delete cascade,
  happened_at timestamptz default now(),
  kind        text,            -- reseñas | post | fotos | web | ficha
  body        text
);

-- 8) Plan de trabajo ----------------------------------------------------------
create table if not exists public.plan_items (
  id        bigint generated always as identity primary key,
  client_id uuid references public.clients(id) on delete cascade,
  title     text,
  done      boolean default false,
  sort      int default 0
);

-- ============================================================================
-- RLS: el cliente solo LEE lo suyo. La escritura la hace el pipeline (service).
-- ============================================================================
alter table public.clients      enable row level security;
alter table public.client_users enable row level security;
alter table public.snapshots    enable row level security;
alter table public.rankings     enable row level security;
alter table public.reviews      enable row level security;
alter table public.competitors  enable row level security;
alter table public.activity     enable row level security;
alter table public.plan_items   enable row level security;

-- Helper: ¿el usuario actual pertenece a este negocio?
create or replace function public.is_member(c uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.client_users cu
                 where cu.client_id = c and cu.user_id = auth.uid());
$$;

create policy "ver mi negocio" on public.clients
  for select to authenticated using (public.is_member(id));
create policy "ver mi pertenencia" on public.client_users
  for select to authenticated using (user_id = auth.uid());

-- Mismo patrón de lectura para las tablas hijas:
create policy "leer snapshots"   on public.snapshots   for select to authenticated using (public.is_member(client_id));
create policy "leer rankings"    on public.rankings    for select to authenticated using (public.is_member(client_id));
create policy "leer reviews"     on public.reviews     for select to authenticated using (public.is_member(client_id));
create policy "leer competitors" on public.competitors for select to authenticated using (public.is_member(client_id));
create policy "leer activity"    on public.activity    for select to authenticated using (public.is_member(client_id));
create policy "leer plan"        on public.plan_items  for select to authenticated using (public.is_member(client_id));
-- (Sin policies de INSERT/UPDATE/DELETE → solo la service key puede escribir.)
