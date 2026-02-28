-- Supabase Users Table for LLMShield
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  hashed_password TEXT,
  username VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) DEFAULT '',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  
  -- Google OAuth fields
  google_id VARCHAR(255) UNIQUE,
  profile_picture TEXT,
  
  -- Email verification
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  
  -- MFA fields
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  recovery_codes TEXT[], -- Array of recovery codes
  trusted_devices JSONB DEFAULT '[]'::jsonb,
  mfa_setup_complete BOOLEAN DEFAULT FALSE,
  
  -- Subscription fields
  subscription_id UUID,
  current_subscription_tier VARCHAR(50) DEFAULT 'premium',
  subscription_status VARCHAR(50) DEFAULT 'active'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (allows backend to access)
CREATE POLICY IF NOT EXISTS "Service role can insert users"
  ON users FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can select users"
  ON users FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can update users"
  ON users FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can delete users"
  ON users FOR DELETE
  TO service_role
  USING (true);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE users IS 'User accounts for LLMShield - Primary database (Supabase)';
COMMENT ON COLUMN users.hashed_password IS 'Bcrypt hashed password (NULL for Google OAuth users)';
COMMENT ON COLUMN users.google_id IS 'Google OAuth subject ID';
COMMENT ON COLUMN users.recovery_codes IS 'Array of MFA recovery codes';
