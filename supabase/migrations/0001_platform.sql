create extension if not exists pgcrypto;

create type public.account_role as enum ('customer', 'supervisor', 'owner');
create type public.application_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  discord_user_id text unique,
  discord_username text,
  github_username text,
  huggingface_username text,
  stripe_customer_id text unique,
  role public.account_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  billing_interval text not null check (billing_interval in ('month', 'lifetime')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  stripe_price_id text not null unique,
  discord_role_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discord_roles (
  role_id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  stripe_event_id text not null unique,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  position text not null,
  answers jsonb not null default '{}'::jsonb,
  status public.application_status not null default 'pending',
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 5 and 2000),
  visible boolean not null default true,
  moderator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index payments_user_created_idx on public.payments(user_id, created_at desc);
create index applications_user_created_idx on public.applications(user_id, created_at desc);
create index activity_logs_created_idx on public.activity_logs(created_at desc);

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.create_profile_for_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'plans', 'subscriptions', 'applications', 'application_positions', 'reviews'] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.discord_roles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.applications enable row level security;
alter table public.application_positions enable row level security;
alter table public.reviews enable row level security;
alter table public.activity_logs enable row level security;

create policy "Profiles are visible to their owner" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Anyone can view active plans" on public.plans
  for select to anon, authenticated using (active = true);
create policy "Signed-in staff can view managed Discord roles" on public.discord_roles
  for select to authenticated using (active = true);
create policy "Customers can view their subscriptions" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Customers can view their payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Customers can view their applications" on public.applications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Customers can submit applications" on public.applications
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Customers can view active positions" on public.application_positions
  for select to authenticated using (active = true);
create policy "Customers can submit their review" on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Anyone can view visible reviews" on public.reviews
  for select to anon, authenticated using (visible = true or user_id = (select auth.uid()));

-- Privileged writes use the service-role client only after a server-side role check.

insert into public.application_positions (name, description, questions)
values
  ('Trial Moderator', 'Help maintain a welcoming and constructive AbdlyAI community.', '[{"id":"experience","label":"What experience do you have moderating online communities?","required":true},{"id":"approach","label":"How would you handle a disagreement between community members?","required":true}]'::jsonb),
  ('Promoter', 'Help more people discover the AbdlyAI community.', '[{"id":"experience","label":"How would you introduce AbdlyAI to a new audience?","required":true},{"id":"ideas","label":"What promotion ideas would you like to try?","required":true}]'::jsonb)
on conflict (name) do nothing;

create function public.owner_payment_analytics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'active_subscriptions', (select count(*) from public.subscriptions where stripe_subscription_id is not null and status in ('active', 'trialing')),
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object('currency', totals.currency, 'amount_cents', totals.amount_cents, 'payment_count', totals.payment_count))
      from (
        select currency, sum(amount_cents) as amount_cents, count(*) as payment_count
        from public.payments where status = 'succeeded' group by currency
      ) totals
    ), '[]'::jsonb),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(months.month, 'YYYY-MM'), 'currency', months.currency, 'amount_cents', months.amount_cents))
      from (
        select date_trunc('month', created_at) as month, currency, sum(amount_cents) as amount_cents
        from public.payments
        where status = 'succeeded'
          and created_at >= date_trunc('month', now()) - interval '5 months'
        group by date_trunc('month', created_at), currency
      ) months
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.owner_payment_analytics() from public, anon, authenticated;
grant execute on function public.owner_payment_analytics() to service_role;
