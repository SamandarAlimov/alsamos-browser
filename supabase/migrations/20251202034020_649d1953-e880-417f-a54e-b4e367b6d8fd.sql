-- Fix search path for match_pages function
create or replace function match_pages(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  url text,
  title text,
  description text,
  content text,
  domain text,
  similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select
    indexed_pages.id,
    indexed_pages.url,
    indexed_pages.title,
    indexed_pages.description,
    indexed_pages.content,
    indexed_pages.domain,
    1 - (indexed_pages.embedding <=> query_embedding) as similarity
  from indexed_pages
  where indexed_pages.embedding is not null
    and 1 - (indexed_pages.embedding <=> query_embedding) > match_threshold
  order by indexed_pages.embedding <=> query_embedding
  limit match_count;
$$;