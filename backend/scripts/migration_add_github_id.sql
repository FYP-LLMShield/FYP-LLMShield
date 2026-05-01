-- Run in Supabase SQL Editor (once) so GitHub OAuth users can store provider subject id.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS github_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_github_id ON public.users(github_id);
