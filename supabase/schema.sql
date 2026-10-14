-- Horserace Catalog schema
-- Run this in the Supabase SQL editor of your project.

-- Products catalog
create table if not exists public.products (
  sku text primary key,
  description text not null default '',
  collection text not null default '',
  location text not null default '',
  unit text not null default '',
  category text not null default '',
  subcategory text not null default '',
  note text not null default '',
  image_url text not null default '',
  keyword text not null default '',
  length numeric not null default 0,
  width numeric not null default 0,
  height numeric not null default 0,
  weight numeric not null default 0,
  carton_qty numeric not null default 0,
  inner_qty numeric not null default 0,
  carton_l numeric not null default 0,
  carton_w numeric not null default 0,
  carton_h numeric not null default 0,
  fob_price numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- User profiles (admin flag)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

-- Create a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.products enable row level security;
alter table public.profiles enable row level security;

-- Any signed-in user can read the catalog
create policy "authenticated users can read products"
  on public.products for select
  to authenticated
  using (true);

-- Only admins can modify the catalog
create policy "admins can insert products"
  on public.products for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "admins can update products"
  on public.products for update
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "admins can delete products"
  on public.products for delete
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Users can read their own profile only
create policy "users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());
