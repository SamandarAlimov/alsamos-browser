-- Fix security warnings by setting search_path for functions

-- Recreate update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

-- Recreate extract_domain function with proper search_path
CREATE OR REPLACE FUNCTION public.extract_domain(url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(
    regexp_replace(url, '^https?://(www\.)?', ''),
    '/.*$',
    ''
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = public;