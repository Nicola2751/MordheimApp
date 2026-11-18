-- Cronache di Mordheim: schema online.
-- Incollalo nell'SQL Editor di Supabase e premi Run. Si può rieseguire senza danni.
-- Poi abilita Authentication > Sign In / Providers > "Allow anonymous sign-ins".

create extension if not exists pgcrypto;

-- ---------- tabelle ----------
create table if not exists public.mordheim_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Campagna',
  owner uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.mordheim_members (
  campaign_id uuid not null references public.mordheim_campaigns(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

-- Codici d'invito: li legge solo chi ha creato la campagna.
create table if not exists public.mordheim_codes (
  campaign_id uuid primary key references public.mordheim_campaigns(id) on delete cascade,
  code text not null unique,       -- chi lo usa può modificare
  view_code text not null unique   -- chi lo usa può solo guardare
);

-- Una riga per banda, battaglia, tabella, voce di diario e una per i dati generali.
create table if not exists public.mordheim_docs (
  campaign_id uuid not null references public.mordheim_campaigns(id) on delete cascade,
  kind text not null check (kind in ('meta', 'band', 'match', 'table', 'log')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, kind, id)
);
create index if not exists mordheim_docs_updated on public.mordheim_docs (campaign_id, updated_at);

-- ---------- funzioni di appoggio ----------
-- security definer: leggono mordheim_members senza passare dalle sue stesse regole (evita ricorsioni).
create or replace function public.mordheim_role(p_campaign uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.mordheim_members where campaign_id = p_campaign and user_id = auth.uid()
$$;

create or replace function public.mordheim_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists mordheim_docs_touch on public.mordheim_docs;
create trigger mordheim_docs_touch before update on public.mordheim_docs
  for each row execute function public.mordheim_touch();

-- Chi crea una campagna ne diventa proprietario.
create or replace function public.mordheim_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mordheim_members (campaign_id, user_id, role) values (new.id, new.owner, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists mordheim_campaigns_owner on public.mordheim_campaigns;
create trigger mordheim_campaigns_owner after insert on public.mordheim_campaigns
  for each row execute function public.mordheim_owner_member();

-- Entra in una campagna con un codice. Restituisce id, nome e ruolo.
create or replace function public.join_campaign(p_code text)
returns table (id uuid, name text, role text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  c record;
  r text;
  existing text;
begin
  if auth.uid() is null then
    raise exception 'Accesso necessario';
  end if;
  select k.campaign_id, (k.code = upper(trim(p_code))) as is_edit
    into c
    from public.mordheim_codes k
   where k.code = upper(trim(p_code)) or k.view_code = upper(trim(p_code));
  if not found then
    raise exception 'Codice non valido';
  end if;
  r := case when c.is_edit then 'editor' else 'viewer' end;
  select m.role into existing from public.mordheim_members m where m.campaign_id = c.campaign_id and m.user_id = auth.uid();
  if existing = 'owner' then
    r := 'owner';
  elsif existing = 'editor' then
    r := 'editor'; -- non si torna indietro a sola lettura
  else
    insert into public.mordheim_members (campaign_id, user_id, role) values (c.campaign_id, auth.uid(), r)
    on conflict (campaign_id, user_id) do update set role = excluded.role;
  end if;
  return query select cm.id, cm.name, r from public.mordheim_campaigns cm where cm.id = c.campaign_id;
end $$;

revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;
grant execute on function public.mordheim_role(uuid) to authenticated;

-- ---------- sicurezza per riga ----------
alter table public.mordheim_campaigns enable row level security;
alter table public.mordheim_members enable row level security;
alter table public.mordheim_codes enable row level security;
alter table public.mordheim_docs enable row level security;

drop policy if exists campaigns_select on public.mordheim_campaigns;
create policy campaigns_select on public.mordheim_campaigns for select to authenticated
  using (owner = auth.uid() or public.mordheim_role(id) is not null);

drop policy if exists campaigns_insert on public.mordheim_campaigns;
create policy campaigns_insert on public.mordheim_campaigns for insert to authenticated
  with check (owner = auth.uid());

drop policy if exists campaigns_update on public.mordheim_campaigns;
create policy campaigns_update on public.mordheim_campaigns for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists campaigns_delete on public.mordheim_campaigns;
create policy campaigns_delete on public.mordheim_campaigns for delete to authenticated
  using (owner = auth.uid());

drop policy if exists members_select on public.mordheim_members;
create policy members_select on public.mordheim_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists codes_owner on public.mordheim_codes;
create policy codes_owner on public.mordheim_codes for all to authenticated
  using (exists (select 1 from public.mordheim_campaigns c where c.id = campaign_id and c.owner = auth.uid()))
  with check (exists (select 1 from public.mordheim_campaigns c where c.id = campaign_id and c.owner = auth.uid()));

drop policy if exists docs_select on public.mordheim_docs;
create policy docs_select on public.mordheim_docs for select to authenticated
  using (public.mordheim_role(campaign_id) is not null);

drop policy if exists docs_insert on public.mordheim_docs;
create policy docs_insert on public.mordheim_docs for insert to authenticated
  with check (public.mordheim_role(campaign_id) in ('owner', 'editor'));

drop policy if exists docs_update on public.mordheim_docs;
create policy docs_update on public.mordheim_docs for update to authenticated
  using (public.mordheim_role(campaign_id) in ('owner', 'editor'))
  with check (public.mordheim_role(campaign_id) in ('owner', 'editor'));

-- Nessuna policy di delete su mordheim_docs: le cancellazioni sono "deleted = true",
-- così gli altri dispositivi le ricevono in tempo reale.

grant select, insert, update, delete on public.mordheim_campaigns, public.mordheim_codes, public.mordheim_docs to authenticated;
grant select on public.mordheim_members to authenticated;

-- ---------- tempo reale ----------
do $$
begin
  alter publication supabase_realtime add table public.mordheim_docs;
exception when duplicate_object then null;
end $$;
alter table public.mordheim_docs replica identity full;
