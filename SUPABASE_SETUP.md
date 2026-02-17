# Supabase Backend Setup Guide

This guide walks you through setting up Supabase as the backend for "Did Kanye Tweet This?" app with **Supabase Auth** for maximum security.

## Prerequisites

- A Supabase project (create one at [supabase.com](https://supabase.com))
- Your app deployed on Vercel
- Google Cloud OAuth credentials

---

## Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (safe to use in frontend)

---

## Step 2: Enable Google Provider in Supabase Auth

This is the key step that enables database-level security:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to expand
4. Toggle **Enable Sign in with Google**
5. Enter your Google OAuth credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
6. Copy the **Callback URL** shown (e.g., `https://xxxxx.supabase.co/auth/v1/callback`)
7. Click **Save**

---

## Step 3: Update Google Cloud OAuth

Now configure Google Cloud to work with Supabase Auth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized JavaScript origins**, add:
   - `https://your-app.vercel.app`
   - `https://xxxxx.supabase.co` (your Supabase project URL)
6. Under **Authorized redirect URIs**, add:
   - `https://xxxxx.supabase.co/auth/v1/callback` (the callback URL from Step 2)
   - `https://your-app.vercel.app` (for redirect after auth)
7. Click **Save**

> ⚠️ Changes may take 5 minutes to propagate.

---

## Step 4: Run Database Migrations

Run migrations **in order**:

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Run these migrations in sequence:

| Migration | Purpose |
|-----------|---------|
| `001_create_tables.sql` | Creates users, game_stats, newsletter_subscribers tables |
| `002_enable_rls.sql` | Initial RLS policies (will be replaced) |
| `003_admin_views.sql` | Admin views (will be replaced with secure functions) |
| `004_migrate_to_supabase_auth.sql` | **⚠️ IMPORTANT** - Secure migration with `auth.uid()` |

> **Note**: Migration 004 drops insecure views and creates proper RLS policies using Supabase Auth's `auth.uid()`. This ensures data is protected at the database level.

---

## Step 5: Verify Security Configuration

After running migration 004, verify everything is secure:

### Check RLS Policies
1. Go to **Table Editor** in Supabase
2. Click on `users` table → **RLS** tab
3. Verify you see these policies:
   - `Users can read own profile`
   - `Users can create own profile`
   - `Users can update own profile`

### Check Secure Functions Exist
1. Go to **SQL Editor**
2. Run: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';`
3. You should see:
   - `is_admin`
   - `get_admin_stats`
   - `get_admin_users`
   - `get_admin_subscribers`
   - `get_admin_leaderboard`

---

## Step 6: Configure Your Credentials

### Update config.js

Edit `config.js` with your credentials:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    GOOGLE_CLIENT_ID: 'your-google-client-id.apps.googleusercontent.com',
    USE_SUPABASE: true
};
```

### Understanding Key Security

> ⚠️ **Important**: The `anon` key and Google Client ID are **designed to be public**.

**Why is this safe?**
- The `anon` key only allows operations permitted by Row Level Security (RLS)
- RLS policies use `auth.uid()` to verify the authenticated user
- Users can ONLY access their own data
- Admin functions use `SECURITY DEFINER` with admin checks
- The `service_role` key (which bypasses RLS) should **NEVER** be in frontend code

---

## Step 7: Set Up Admin Access

The admin page uses secure RPC functions that verify admin status. To grant yourself admin access:

1. **First, sign into the app** using Google Sign-In (this creates your user record)
2. Go to Supabase **SQL Editor**
3. Run this query (replace with your email):

```sql
UPDATE users 
SET is_admin = true 
WHERE email = 'your-email@gmail.com';
```

Or find your Supabase Auth user ID:
1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Find your user and copy the `id` (UUID)
3. Run:
```sql
UPDATE users 
SET is_admin = true 
WHERE auth_id = 'your-supabase-auth-uuid';
```

---

## Database Schema Overview

### `users` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| auth_id | uuid | **Supabase Auth user ID** (links to `auth.users`) |
| google_id | text | Google OAuth sub ID (legacy, for migration) |
| email | text | User's email |
| name | text | Display name |
| picture | text | Profile picture URL |
| is_admin | boolean | Admin access flag |
| created_at | timestamp | Registration date |
| updated_at | timestamp | Last update |

### `game_stats` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users |
| best_score | integer | Highest score achieved |
| games_played | integer | Total games played |
| best_streak | integer | Longest correct streak |
| favorites | jsonb | Saved tweet IDs |
| updated_at | timestamp | Last update |

### `newsletter_subscribers` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users (nullable) |
| email | text | Subscriber email |
| consented_at | timestamp | When consent was given |
| is_active | boolean | Subscription status |

---

## Secure Admin Functions

The admin page uses these **secure** PostgreSQL functions (created in migration 004):

| Function | Description | Security |
|----------|-------------|----------|
| `is_admin()` | Checks if current user is admin | Uses `auth.uid()` |
| `get_admin_stats()` | Returns dashboard statistics | Admin only, `SECURITY DEFINER` |
| `get_admin_users()` | Returns all users with stats | Admin only, `SECURITY DEFINER` |
| `get_admin_subscribers()` | Returns newsletter subscribers | Admin only, `SECURITY DEFINER` |
| `get_admin_leaderboard()` | Returns top 50 players | Admin only, `SECURITY DEFINER` |

These functions are called via Supabase RPC:
```javascript
const { data } = await supabase.rpc('get_admin_stats');
```

---

## App API Functions

The app uses these Supabase functions in `app.js`:

### Authentication (via Supabase Auth)
```javascript
// Sign in with Google
await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
});

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {...});
```

### User Management
- `Database.syncUserProfile(user)` - Create/update user on sign-in
- Users are linked via `auth_id` column

### Game Stats
- `Database.getGameStats(userId)` - Get user's game statistics
- `Database.updateGameStats(userId, stats)` - Update after game

### Newsletter
- `Database.subscribeNewsletter(email, userId)` - Add subscriber
- `Database.unsubscribeNewsletter(email)` - Remove subscriber

---

## Troubleshooting

### "Invalid API key" error
- Double-check you're using the **anon** key, not the **service_role** key
- Verify the key in your config matches Supabase dashboard

### "Permission denied" errors
- Check RLS policies are correctly set up
- Ensure the user is authenticated via Supabase Auth
- Run migration 004 if you haven't already

### Google Sign-In redirects but doesn't complete
- Verify the Supabase callback URL is in Google Cloud authorized redirect URIs
- Check that Google provider is enabled in Supabase Auth dashboard
- Ensure redirect URL in app matches your deployed URL

### Admin page shows "Access Denied"
- Sign into the main app first (to create your user record)
- Run the SQL to grant admin access (Step 7)
- Sign out and sign back in to get a fresh session
- Check browser console for specific errors

### Auth popup blocked
- Try clicking the sign-in button directly (not programmatically)
- Check browser popup blocker settings

---

## Security Architecture

### How Supabase Auth Protects Your Data

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR APP                             │
│  ┌─────────┐      ┌──────────────┐                      │
│  │ User    │──────│ Supabase JS  │                      │
│  │ Browser │      │ Client       │                      │
│  └─────────┘      └──────┬───────┘                      │
└─────────────────────────│───────────────────────────────┘
                          │ anon key + JWT
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE                               │
│  ┌──────────────┐      ┌──────────────┐                 │
│  │ Auth Service │──────│ PostgreSQL   │                 │
│  │ (Google)     │      │ + RLS        │                 │
│  └──────────────┘      └──────────────┘                 │
│          │                    │                         │
│          │   auth.uid()       │                         │
│          └────────────────────┘                         │
│                                                         │
│  RLS Policy Example:                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │ SELECT * FROM users                         │        │
│  │ WHERE auth_id = auth.uid()  ← Only own data │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Security Layers

1. **Supabase Auth** - Handles Google OAuth, issues JWTs
2. **Row Level Security (RLS)** - Database enforces access rules
3. **`auth.uid()`** - Built-in function returns authenticated user's ID
4. **SECURITY DEFINER functions** - Admin queries run with elevated privileges, but check `is_admin()` first

### What's Safe to Expose (Public)
- ✅ **Supabase `anon` key** - Designed for frontend use, protected by RLS
- ✅ **Supabase Project URL** - Just identifies your project
- ✅ **Google Client ID** - Always visible in HTML, that's expected

### What Must NEVER Be Exposed
- ❌ **Supabase `service_role` key** - Bypasses all RLS
- ❌ **Google Client Secret** - Only in Supabase dashboard, never in code
- ❌ **JWT secrets** - Managed by Supabase

---

## Migration from Direct Google OAuth

If you were previously using Google OAuth directly (not via Supabase Auth):

1. The `auth_id` column links users to Supabase Auth
2. The `google_id` column is preserved for reference
3. Existing users will need to sign in again to link their accounts
4. Their data will be matched by email address

---

## Next Steps

After setup is complete:

1. ✅ Enable Google provider in Supabase Auth
2. ✅ Update Google Cloud OAuth redirect URIs  
3. ✅ Run all migrations (especially 004)
4. ✅ Test sign-in flow
5. ✅ Grant yourself admin access
6. ✅ Test admin dashboard
7. 🔲 Optional: Set up Supabase email triggers for newsletters
