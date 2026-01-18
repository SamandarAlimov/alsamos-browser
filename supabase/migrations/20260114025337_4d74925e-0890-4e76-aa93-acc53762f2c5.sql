-- Create browser_sessions table to persist browser state
CREATE TABLE public.browser_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tabs JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_tab_id TEXT,
  extensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  extension_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  extension_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  downloads JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_tabs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT browser_sessions_user_id_unique UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.browser_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own session
CREATE POLICY "Users can view their own browser session"
ON public.browser_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own browser session"
ON public.browser_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own browser session"
ON public.browser_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own browser session"
ON public.browser_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_browser_sessions_updated_at
BEFORE UPDATE ON public.browser_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();