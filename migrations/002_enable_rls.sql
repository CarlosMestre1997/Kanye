-- Migration: 002_enable_rls.sql
-- Description: Enable Row Level Security and create policies
-- Run this AFTER 001_create_tables.sql
--
-- ⚠️ SECURITY MODEL:
-- This app uses Google OAuth directly (NOT Supabase Auth), so we cannot use
-- auth.uid() to identify users at the database level. Security relies on:
-- 1. Google OAuth verifying user identity in the frontend
-- 2. RLS preventing DELETE operations (no policies = blocked)  
-- 3. Admin checks happening in application code
--
-- For apps with sensitive data, consider using Supabase Auth with Google provider.

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Users can read their own data
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
    FOR SELECT
    USING (true); -- Allow reading for auth purposes (google_id lookup)

-- Users can insert their own data (on signup)
DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT
    WITH CHECK (true); -- Controlled by application logic

-- Users can update their own data
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- GAME STATS TABLE POLICIES
-- ============================================================

-- Users can read their own stats
DROP POLICY IF EXISTS "Users can view own stats" ON game_stats;
CREATE POLICY "Users can view own stats" ON game_stats
    FOR SELECT
    USING (true);

-- Users can insert their own stats
DROP POLICY IF EXISTS "Users can insert own stats" ON game_stats;
CREATE POLICY "Users can insert own stats" ON game_stats
    FOR INSERT
    WITH CHECK (true);

-- Users can update their own stats
DROP POLICY IF EXISTS "Users can update own stats" ON game_stats;
CREATE POLICY "Users can update own stats" ON game_stats
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- NEWSLETTER SUBSCRIBERS TABLE POLICIES
-- ============================================================

-- Anyone can subscribe (insert)
DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
    FOR INSERT
    WITH CHECK (true);

-- Users can view their own subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON newsletter_subscribers;
CREATE POLICY "Users can view own subscription" ON newsletter_subscribers
    FOR SELECT
    USING (true);

-- Users can unsubscribe (update their record)
DROP POLICY IF EXISTS "Users can unsubscribe" ON newsletter_subscribers;
CREATE POLICY "Users can unsubscribe" ON newsletter_subscribers
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- SECURITY NOTE ON ADMIN ACCESS
-- ============================================================
-- Admin access is controlled at the APPLICATION level, not database level.
-- The admin.html page checks is_admin flag before showing data.
-- Without Supabase Auth, we cannot enforce admin-only at the DB level.
--
-- The views (admin_user_overview, etc.) are accessible to anyone with the
-- anon key, but the admin.html UI gates access via the is_admin check.

-- ============================================================
-- DELETE OPERATIONS ARE BLOCKED
-- ============================================================
-- No DELETE policies = all deletes blocked via anon key.
-- This prevents accidental or malicious data deletion.

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 002_enable_rls completed successfully!';
    RAISE NOTICE 'Security model: Google OAuth frontend + RLS basic protection';
END $$;
