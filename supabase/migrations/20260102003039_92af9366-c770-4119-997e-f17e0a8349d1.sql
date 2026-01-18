-- Create bookmark folders table
CREATE TABLE public.bookmark_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.bookmark_folders(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id and tags to bookmarked_results
ALTER TABLE public.bookmarked_results 
  ADD COLUMN folder_id UUID REFERENCES public.bookmark_folders(id) ON DELETE SET NULL,
  ADD COLUMN tags TEXT[] DEFAULT '{}',
  ADD COLUMN favicon_url TEXT;

-- Enable RLS on bookmark_folders
ALTER TABLE public.bookmark_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for bookmark_folders
CREATE POLICY "Users can manage their own folders" 
ON public.bookmark_folders 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_bookmarked_results_folder ON public.bookmarked_results(folder_id);
CREATE INDEX idx_bookmarked_results_tags ON public.bookmarked_results USING GIN(tags);
CREATE INDEX idx_bookmark_folders_user ON public.bookmark_folders(user_id);
CREATE INDEX idx_bookmark_folders_parent ON public.bookmark_folders(parent_id);

-- Trigger for updated_at
CREATE TRIGGER update_bookmark_folders_updated_at
BEFORE UPDATE ON public.bookmark_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();