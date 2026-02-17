-- Migration: 004_migrate_to_supabase_auth.sql
-- Description: Migrate from Google OAuth direct to Supabase Auth
-- 
-- ⚠️ RUN THIS AFTER setting up Google provider in Supabase Dashboard
-- 
-- This migration:
-- 1. Drops unsafe views that expose all data
-- 2. Adds auth_id column to link with Supabase Auth
-- 3. Creates secure RLS policies using auth.uid()

-- ============================================================
-- STEP 1: DROP UNSAFE VIEWS
-- These views bypass RLS and expose all data
-- ============================================================
DROP VIEW IF EXISTS admin_leaderboard;
DROP VIEW IF EXISTS admin_newsletter_subscribers;
DROP VIEW IF EXISTS admin_stats_summary;
DROP VIEW IF EXISTS admin_user_overview;

-- ============================================================
-- STEP 2: ADD SUPABASE AUTH LINK TO USERS TABLE
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- ============================================================
-- STEP 3: DROP OLD PERMISSIVE POLICIES
-- ============================================================
-- Users table
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow read users" ON users;
DROP POLICY IF EXISTS "Allow insert users" ON users;
DROP POLICY IF EXISTS "Allow update users" ON users;

-- Game stats table
DROP POLICY IF EXISTS "Users can view own stats" ON game_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON game_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON game_stats;
DROP POLICY IF EXISTS "Allow read game_stats" ON game_stats;
DROP POLICY IF EXISTS "Allow insert game_stats" ON game_stats;
DROP POLICY IF EXISTS "Allow update game_stats" ON game_stats;

-- Newsletter table
DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Users can view own subscription" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Users can unsubscribe" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow insert newsletter" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow read newsletter" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Allow update newsletter" ON newsletter_subscribers;

-- Admin policies (if they exist)
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can view all subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Admins can view all stats" ON game_stats;

-- ============================================================
-- STEP 4: CREATE SECURE RLS POLICIES
-- These use auth.uid() for proper user verification
-- ============================================================

-- USERS TABLE POLICIES --

-- Users can only read their own profile
CREATE POLICY "Users read own profile" ON users
    FOR SELECT USING (auth.uid() = auth_id);

-- Users can insert their profile on first sign-in
CREATE POLICY "Users insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = auth_id);

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON users
    FOR UPDATE USING (auth.uid() = auth_id)
    WITH CHECK (auth.uid() = auth_id);

-- Admins can read all users
CREATE POLICY "Admins read all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() AND u.is_admin = true
        )
    );

-- GAME STATS TABLE POLICIES --

-- Users can only read their own stats
CREATE POLICY "Users read own stats" ON game_stats
    FOR SELECT USING (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Users can insert their own stats
CREATE POLICY "Users insert own stats" ON game_stats
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Users can update their own stats
CREATE POLICY "Users update own stats" ON game_stats
    FOR UPDATE USING (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    ) WITH CHECK (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Admins can read all stats
CREATE POLICY "Admins read all stats" ON game_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() AND u.is_admin = true
        )
    );

-- NEWSLETTER SUBSCRIBERS TABLE POLICIES --

-- Users can only read their own subscription
CREATE POLICY "Users read own subscription" ON newsletter_subscribers
    FOR SELECT USING (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Authenticated users can subscribe
CREATE POLICY "Users can subscribe" ON newsletter_subscribers
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Users can update (unsubscribe) their own subscription
CREATE POLICY "Users update own subscription" ON newsletter_subscribers
    FOR UPDATE USING (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    ) WITH CHECK (
        user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Admins can read all subscriptions
CREATE POLICY "Admins read all subscriptions" ON newsletter_subscribers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() AND u.is_admin = true
        )
    );

-- ============================================================
-- STEP 5: CREATE SECURE ADMIN FUNCTIONS
-- These are Postgres functions that check admin status
-- ============================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE auth_id = auth.uid() AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin stats (only callable by admins)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM users),
        'total_games_played', (SELECT COALESCE(SUM(games_played), 0) FROM game_stats),
        'active_subscribers', (SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true),
        'new_users_7d', (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'),
        'highest_score', (SELECT COALESCE(MAX(best_score), 0) FROM game_stats),
        'highest_streak', (SELECT COALESCE(MAX(best_streak), 0) FROM game_stats)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users (admin only)
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    picture TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    best_score INTEGER,
    games_played INTEGER,
    newsletter_active BOOLEAN
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.name,
        u.picture,
        u.is_admin,
        u.created_at,
        COALESCE(gs.best_score, 0),
        COALESCE(gs.games_played, 0),
        COALESCE(ns.is_active, false)
    FROM users u
    LEFT JOIN game_stats gs ON gs.user_id = u.id
    LEFT JOIN newsletter_subscribers ns ON ns.user_id = u.id
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get newsletter subscribers (admin only)
CREATE OR REPLACE FUNCTION get_admin_subscribers()
RETURNS TABLE (
    id UUID,
    email TEXT,
    user_name TEXT,
    consented_at TIMESTAMPTZ,
    is_active BOOLEAN
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    RETURN QUERY
    SELECT 
        ns.id,
        ns.email,
        u.name,
        ns.consented_at,
        ns.is_active
    FROM newsletter_subscribers ns
    LEFT JOIN users u ON u.id = ns.user_id
    ORDER BY ns.consented_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard (admin only)
CREATE OR REPLACE FUNCTION get_admin_leaderboard()
RETURNS TABLE (
    rank BIGINT,
    name TEXT,
    email TEXT,
    best_score INTEGER,
    best_streak INTEGER,
    games_played INTEGER
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY gs.best_score DESC, gs.best_streak DESC),
        u.name,
        u.email,
        gs.best_score,
        gs.best_streak,
        gs.games_played
    FROM game_stats gs
    JOIN users u ON u.id = gs.user_id
    WHERE gs.games_played > 0
    ORDER BY gs.best_score DESC, gs.best_streak DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 004 completed successfully!';
    RAISE NOTICE '✅ Unsafe views dropped';
    RAISE NOTICE '✅ Secure RLS policies created using auth.uid()';
    RAISE NOTICE '✅ Admin functions created with proper access control';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ NEXT STEPS:';
    RAISE NOTICE '1. Enable Google provider in Supabase Auth settings';
    RAISE NOTICE '2. Update your frontend code to use Supabase Auth';
    RAISE NOTICE '3. Grant yourself admin: UPDATE users SET is_admin = true WHERE email = ''your@email.com'';';
END $$;
