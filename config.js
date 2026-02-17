// ============================================================
// CONFIG - Replace these values with your own
// ============================================================
// 
// SECURITY NOTE: These keys are SAFE to commit to git:
// - SUPABASE_ANON_KEY: Designed for frontend use, protected by RLS
// - GOOGLE_CLIENT_ID: Always visible in HTML source, that's expected
//
// NEVER put these in frontend code:
// - Supabase service_role key (bypasses RLS)
// - Any server-side secrets
//
// ============================================================
const CONFIG = {
    // Supabase settings
    SUPABASE_URL: 'https://mttemkcuvkeyxrfaxdin.supabase.co',           // e.g., https://xxxxx.supabase.co
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dGVta2N1dmtleXhyZmF4ZGluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzg1NzksImV4cCI6MjA4NjkxNDU3OX0.Utd_YqHZctH_nYinuSOR6l-3Jft4Yzek1xaT5R0CpHs', // anon/public key from Supabase dashboard
    
    // Google OAuth
    GOOGLE_CLIENT_ID: '1071629753810-n7p5fp7j5d82oc1jrncf9jupdoia5t45.apps.googleusercontent.com',
    
    // Feature flags
    USE_SUPABASE: true,  // Set to false to use localStorage only (offline mode)
};

// Initialize Supabase client (only if configured)
let supabase = null;
if (CONFIG.USE_SUPABASE && CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabase = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}
