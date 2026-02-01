-- Supabase Database Setup Script for LLMShield
-- Run this in your Supabase SQL Editor

-- 1. Create emails table for email queue
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  html_content TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create indexes for emails table
CREATE INDEX IF NOT EXISTS idx_emails_to_email ON emails(to_email);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);

-- 2. Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email_verifications table
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- 3. Enable Row Level Security (RLS) - Optional but recommended
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for service role access (allows backend to access)
-- Note: These policies allow full access via service role key
CREATE POLICY IF NOT EXISTS "Service role can insert emails"
  ON emails FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can select emails"
  ON emails FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can update emails"
  ON emails FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can insert verifications"
  ON email_verifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can select verifications"
  ON email_verifications FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can update verifications"
  ON email_verifications FOR UPDATE
  TO service_role
  USING (true);

-- 5. Create a function to clean up expired tokens (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM email_verifications
  WHERE expires_at < NOW() AND used = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a scheduled job to clean up expired tokens (optional)
-- Note: This requires pg_cron extension
-- Enable it first: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then schedule: SELECT cron.schedule('cleanup-expired-verifications', '0 * * * *', 'SELECT cleanup_expired_verifications();');

COMMENT ON TABLE emails IS 'Stores queued emails for sending via Supabase';
COMMENT ON TABLE email_verifications IS 'Stores email verification tokens';
