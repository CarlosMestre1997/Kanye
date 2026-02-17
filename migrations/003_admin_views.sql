-- Migration: 003_admin_views.sql
-- Description: Create views for admin dashboard
-- Run this AFTER 002_enable_rls.sql

-- ============================================================
-- ADMIN DASHBOARD VIEW - User Overview
-- ============================================================
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.picture,
    u.is_admin,
    u.created_at AS registered_at,
    gs.best_score,
    gs.games_played,
    gs.best_streak,
    jsonb_array_length(COALESCE(gs.favorites, '[]'::jsonb)) AS favorites_count,
    ns.consented_at AS newsletter_subscribed_at,
    ns.is_active AS newsletter_active
FROM users u
LEFT JOIN game_stats gs ON gs.user_id = u.id
LEFT JOIN newsletter_subscribers ns ON ns.user_id = u.id AND ns.is_active = true
ORDER BY u.created_at DESC;

-- ============================================================
-- ADMIN DASHBOARD VIEW - Newsletter Subscribers
-- ============================================================
CREATE OR REPLACE VIEW admin_newsletter_subscribers AS
SELECT 
    ns.id,
    ns.email,
    u.name AS user_name,
    ns.source,
    ns.consented_at,
    ns.is_active,
    ns.unsubscribed_at,
    ns.created_at
FROM newsletter_subscribers ns
LEFT JOIN users u ON u.id = ns.user_id
ORDER BY ns.consented_at DESC;

-- ============================================================
-- ADMIN DASHBOARD VIEW - Game Statistics Summary
-- ============================================================
CREATE OR REPLACE VIEW admin_stats_summary AS
SELECT 
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT gs.user_id) AS users_with_stats,
    COALESCE(SUM(gs.games_played), 0) AS total_games_played,
    COALESCE(MAX(gs.best_score), 0) AS highest_score_ever,
    COALESCE(MAX(gs.best_streak), 0) AS highest_streak_ever,
    COALESCE(ROUND(AVG(gs.best_score), 2), 0) AS avg_best_score,
    COUNT(DISTINCT CASE WHEN ns.is_active THEN ns.id END) AS active_subscribers,
    COUNT(DISTINCT CASE WHEN u.created_at > NOW() - INTERVAL '7 days' THEN u.id END) AS new_users_7d,
    COUNT(DISTINCT CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN u.id END) AS new_users_30d
FROM users u
LEFT JOIN game_stats gs ON gs.user_id = u.id
LEFT JOIN newsletter_subscribers ns ON ns.email = u.email;

-- ============================================================
-- ADMIN DASHBOARD VIEW - Leaderboard
-- ============================================================
CREATE OR REPLACE VIEW admin_leaderboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY gs.best_score DESC, gs.best_streak DESC) AS rank,
    u.name,
    u.email,
    u.picture,
    gs.best_score,
    gs.best_streak,
    gs.games_played,
    gs.updated_at AS last_played
FROM game_stats gs
JOIN users u ON u.id = gs.user_id
WHERE gs.games_played > 0
ORDER BY gs.best_score DESC, gs.best_streak DESC
LIMIT 100;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 003_admin_views completed successfully!';
END $$;
