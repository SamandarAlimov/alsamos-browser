-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- User roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'user',
  created_at timestamp with time zone default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer function to check roles
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins can manage all roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- Search history
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  query text not null,
  results_count integer,
  created_at timestamp with time zone default now()
);

alter table public.search_history enable row level security;

create policy "Users can view their own search history"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own search history"
  on public.search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own search history"
  on public.search_history for delete
  using (auth.uid() = user_id);

-- Saved searches
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  query text not null,
  name text,
  created_at timestamp with time zone default now(),
  unique (user_id, query)
);

alter table public.saved_searches enable row level security;

create policy "Users can manage their own saved searches"
  on public.saved_searches for all
  using (auth.uid() = user_id);

-- Bookmarked results
create table public.bookmarked_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  url text not null,
  title text,
  description text,
  domain text,
  created_at timestamp with time zone default now(),
  unique (user_id, url)
);

alter table public.bookmarked_results enable row level security;

create policy "Users can manage their own bookmarks"
  on public.bookmarked_results for all
  using (auth.uid() = user_id);

-- Domain management
create table public.domain_whitelist (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  added_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

alter table public.domain_whitelist enable row level security;

create policy "Anyone can view whitelisted domains"
  on public.domain_whitelist for select
  using (true);

create policy "Admins can manage whitelist"
  on public.domain_whitelist for all
  using (public.has_role(auth.uid(), 'admin'));

create table public.domain_blacklist (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  reason text,
  added_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

alter table public.domain_blacklist enable row level security;

create policy "Admins can view blacklist"
  on public.domain_blacklist for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage blacklist"
  on public.domain_blacklist for all
  using (public.has_role(auth.uid(), 'admin'));

-- API keys and rate limiting
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null unique,
  name text,
  tier text not null default 'free',
  requests_per_minute integer not null default 10,
  created_at timestamp with time zone default now(),
  last_used_at timestamp with time zone,
  is_active boolean default true
);

alter table public.api_keys enable row level security;

create policy "Users can view their own API keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

create policy "Users can create their own API keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own API keys"
  on public.api_keys for update
  using (auth.uid() = user_id);

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references public.api_keys(id) on delete cascade not null,
  endpoint text not null,
  created_at timestamp with time zone default now()
);

alter table public.api_usage enable row level security;

create policy "Service role can manage usage"
  on public.api_usage for all
  using (auth.jwt()->>'role' = 'service_role');

-- Add embeddings column to indexed_pages
alter table public.indexed_pages add column if not exists embedding vector(768);

-- Create index for vector similarity search
create index if not exists indexed_pages_embedding_idx on public.indexed_pages 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Update trigger for profiles
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();