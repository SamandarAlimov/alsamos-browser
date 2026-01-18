-- Enable required extensions for scheduled tasks
create extension if not exists pg_cron;
create extension if not exists pg_net;