// ============================================================
// DID KANYE TWEET THIS? - Main Application
// Using Supabase Auth for secure authentication
// ============================================================

// ============================================================
// SUPABASE DATABASE MODULE
// ============================================================
const Database = {
    // Check if Supabase is available
    isAvailable() {
        return supabaseClient !== null;
    },

    // Get or create user profile after Supabase Auth sign-in
    async syncUserProfile(authUser) {
        if (!this.isAvailable() || !authUser) return null;

        try {
            // First try to get existing user by auth_id
            let { data: existingUser, error: fetchError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('auth_id', authUser.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (existingUser) {
                // Update existing user
                const { data, error } = await supabaseClient
                    .from('users')
                    .update({
                        email: authUser.email,
                        name: authUser.user_metadata?.full_name || authUser.email,
                        picture: authUser.user_metadata?.avatar_url,
                        updated_at: new Date().toISOString()
                    })
                    .eq('auth_id', authUser.id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                // Insert new user
                const { data, error } = await supabaseClient
                    .from('users')
                    .insert({
                        auth_id: authUser.id,
                        google_id: authUser.user_metadata?.provider_id || authUser.id,
                        email: authUser.email,
                        name: authUser.user_metadata?.full_name || authUser.email,
                        picture: authUser.user_metadata?.avatar_url,
                        is_admin: false
                    })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        } catch (err) {
            console.error('Failed to sync user profile:', err);
            return null;
        }
    },

    // Get game stats for user
    async getGameStats(userId) {
        if (!this.isAvailable()) return null;

        try {
            const { data, error } = await supabaseClient
                .from('game_stats')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (err) {
            console.error('Failed to get game stats:', err);
            return null;
        }
    },

    // Update game stats
    async updateGameStats(userId, stats) {
        if (!this.isAvailable()) return null;

        try {
            const { data, error } = await supabaseClient
                .from('game_stats')
                .upsert({
                    user_id: userId,
                    best_score: stats.bestScore,
                    games_played: stats.gamesPlayed,
                    best_streak: stats.bestStreak,
                    favorites: stats.favorites || [],
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Failed to update game stats:', err);
            return null;
        }
    },

    // Subscribe to newsletter
    async subscribeNewsletter(email, userId) {
        if (!this.isAvailable()) return false;

        try {
            const { error } = await supabaseClient
                .from('newsletter_subscribers')
                .upsert({
                    email: email,
                    user_id: userId,
                    source: 'signup',
                    is_active: true,
                    consented_at: new Date().toISOString()
                }, {
                    onConflict: 'email',
                    ignoreDuplicates: false
                });

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Failed to subscribe:', err);
            return false;
        }
    }
};

// ============================================================
// AUTH MODULE - Using Supabase Auth
// ============================================================
const Auth = {
    currentUser: null,      // Supabase auth user
    dbUser: null,           // Our users table profile
    pendingNewsletterConsent: false,

    // Sign in with Google via Supabase Auth
    async signInWithGoogle() {
        if (!supabaseClient) {
            alert('Authentication service not available');
            return;
        }

        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) {
            console.error('Sign-in error:', error);
            alert('Failed to sign in. Please try again.');
        }
    },

    // Sign out
    async signOut() {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        Auth.currentUser = null;
        Auth.dbUser = null;
        localStorage.removeItem('kanye_user');
        document.getElementById('login-prompt').classList.remove('hidden');
        document.getElementById('main-container').classList.add('hidden');
        // Reset newsletter checkbox for next sign-in
        const checkbox = document.getElementById('newsletter-consent');
        if (checkbox) checkbox.checked = false;
    },

    // Handle auth state changes
    async handleAuthChange(event, session) {
        console.log('Auth state changed:', event);

        if (session?.user) {
            Auth.currentUser = session.user;
            
            // Sync user profile to our database
            Auth.dbUser = await Database.syncUserProfile(session.user);
            
            if (Auth.dbUser) {
                // Load stats from database
                const dbStats = await Database.getGameStats(Auth.dbUser.id);
                if (dbStats) {
                    const localData = {
                        bestScore: dbStats.best_score,
                        gamesPlayed: dbStats.games_played,
                        bestStreak: dbStats.best_streak,
                        favorites: dbStats.favorites || []
                    };
                    localStorage.setItem(Storage.getUserDataKey(), JSON.stringify(localData));
                }
            }

            // Store basic user info for offline access
            const userInfo = {
                id: session.user.id,
                name: session.user.user_metadata?.full_name || session.user.email,
                email: session.user.email,
                picture: session.user.user_metadata?.avatar_url
            };
            localStorage.setItem('kanye_user', JSON.stringify(userInfo));

            UI.showMainApp();
        } else {
            // Not signed in
            Auth.currentUser = null;
            Auth.dbUser = null;
            document.getElementById('login-prompt').classList.remove('hidden');
            document.getElementById('main-container').classList.add('hidden');
        }
    },

    // Check for existing session on page load
    async checkExistingSession() {
        if (!supabaseClient) {
            // Fallback to localStorage if Supabase is not configured
            const savedUser = localStorage.getItem('kanye_user');
            if (savedUser) {
                Auth.currentUser = JSON.parse(savedUser);
                UI.showMainApp();
                return true;
            }
            return false;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            await Auth.handleAuthChange('INITIAL_SESSION', session);
            return true;
        }
        return false;
    },

    isAuthenticated() {
        return Auth.currentUser !== null;
    },

    // Get user display info
    getUserInfo() {
        if (!Auth.currentUser) return null;
        
        return {
            id: Auth.currentUser.id,
            name: Auth.currentUser.user_metadata?.full_name || Auth.currentUser.email,
            email: Auth.currentUser.email,
            picture: Auth.currentUser.user_metadata?.avatar_url
        };
    }
};

// ============================================================
// DATA PERSISTENCE MODULE
// ============================================================
const Storage = {
    getUserDataKey() {
        const userId = Auth.dbUser?.id || Auth.currentUser?.id || 'anonymous';
        return `kanye_data_${userId}`;
    },

    loadUserData() {
        const data = localStorage.getItem(Storage.getUserDataKey());
        return data ? JSON.parse(data) : {
            bestScore: 0,
            gamesPlayed: 0,
            bestStreak: 0,
            favorites: []
        };
    },

    saveUserData(data) {
        localStorage.setItem(Storage.getUserDataKey(), JSON.stringify(data));
        
        // Sync to Supabase if available
        if (Database.isAvailable() && Auth.dbUser) {
            Database.updateGameStats(Auth.dbUser.id, data);
        }
    },

    async updateStats(finalScore, maxStreak) {
        if (!Auth.isAuthenticated()) return;
        
        const data = Storage.loadUserData();
        data.gamesPlayed++;
        if (finalScore > data.bestScore) {
            data.bestScore = finalScore;
        }
        if (maxStreak > data.bestStreak) {
            data.bestStreak = maxStreak;
        }
        Storage.saveUserData(data);
    }
};

// ============================================================
// FAVORITES MODULE
// ============================================================
const Favorites = {
    toggle() {
        if (!Auth.isAuthenticated()) {
            alert('Please sign in to save favorite tweets!');
            return;
        }

        const tweet = Game.getCurrentTweet();
        const data = Storage.loadUserData();
        const tweetId = tweet.text.substring(0, 50);
        
        const existingIndex = data.favorites.findIndex(f => f.id === tweetId);
        
        if (existingIndex >= 0) {
            data.favorites.splice(existingIndex, 1);
            UI.updateFavoriteButton(false);
        } else {
            data.favorites.push({
                id: tweetId,
                text: tweet.text,
                isKanye: tweet.isKanye,
                author: tweet.isKanye ? 'Kanye West' : tweet.realAuthor,
                date: tweet.date
            });
            UI.updateFavoriteButton(true);
        }
        
        Storage.saveUserData(data);
    },

    checkIfFavorited() {
        if (!Auth.isAuthenticated()) {
            UI.updateFavoriteButton(false);
            return;
        }

        const tweet = Game.getCurrentTweet();
        if (!tweet) return;
        
        const data = Storage.loadUserData();
        const tweetId = tweet.text.substring(0, 50);
        const isFavorited = data.favorites.some(f => f.id === tweetId);
        UI.updateFavoriteButton(isFavorited);
    },

    remove(tweetId) {
        const data = Storage.loadUserData();
        data.favorites = data.favorites.filter(f => f.id !== tweetId);
        Storage.saveUserData(data);
        UI.renderFavorites();
    }
};

// ============================================================
// GAME MODULE
// ============================================================
const Game = {
    shuffledTweets: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,

    shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    },

    init() {
        Game.shuffledTweets = Game.shuffle(TWEETS);
        Game.currentIndex = 0;
        Game.score = 0;
        Game.streak = 0;
        Game.maxStreak = 0;
        UI.updateScoreboard();
        UI.showTweet();
        UI.showGame();
    },

    getCurrentTweet() {
        return Game.shuffledTweets[Game.currentIndex];
    },

    getTotalTweets() {
        return TWEETS.length;
    },

    guess(guessedKanye) {
        const tweet = Game.getCurrentTweet();
        const correct = guessedKanye === tweet.isKanye;

        if (correct) {
            Game.score++;
            Game.streak++;
            if (Game.streak > Game.maxStreak) {
                Game.maxStreak = Game.streak;
            }
        } else {
            Game.streak = 0;
        }

        UI.showResult(correct, tweet);
        UI.updateScoreboard();
    },

    nextTweet() {
        UI.hideResult();
        Game.currentIndex++;

        if (Game.currentIndex >= Game.shuffledTweets.length) {
            Storage.updateStats(Game.score, Game.maxStreak);
            UI.showGameOver();
        } else {
            UI.updateScoreboard();
            UI.showTweet();
        }
    },

    restart() {
        Game.init();
    }
};

// ============================================================
// UI MODULE
// ============================================================
const UI = {
    showMainApp() {
        document.getElementById('login-prompt').classList.add('hidden');
        document.getElementById('main-container').classList.remove('hidden');
        
        const userInfo = Auth.getUserInfo();
        if (userInfo) {
            document.getElementById('user-name').textContent = userInfo.name;
            document.getElementById('stats-user-name').textContent = userInfo.name;
            
            if (userInfo.picture) {
                document.getElementById('user-avatar').src = userInfo.picture;
                document.getElementById('user-avatar').style.display = 'block';
            } else {
                document.getElementById('user-avatar').style.display = 'none';
            }
        }

        Game.init();
    },

    showGame() {
        document.getElementById('nav-play').classList.add('active');
        document.getElementById('nav-stats').classList.remove('active');
        document.getElementById('stats-panel').classList.add('hidden');
        document.getElementById('score-board').classList.remove('hidden');
        document.getElementById('tweet-card').classList.remove('hidden');
        document.getElementById('game-buttons').classList.remove('hidden');
        document.getElementById('game-over').classList.add('hidden');
    },

    showStats() {
        document.getElementById('nav-stats').classList.add('active');
        document.getElementById('nav-play').classList.remove('active');
        document.getElementById('stats-panel').classList.remove('hidden');
        document.getElementById('score-board').classList.add('hidden');
        document.getElementById('tweet-card').classList.add('hidden');
        document.getElementById('game-buttons').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        
        const data = Storage.loadUserData();
        document.getElementById('stat-best').textContent = data.bestScore;
        document.getElementById('stat-games').textContent = data.gamesPlayed;
        document.getElementById('stat-streak').textContent = data.bestStreak;
        
        UI.renderFavorites();
    },

    showTweet() {
        const tweet = Game.getCurrentTweet();
        document.getElementById('tweet-text').textContent = tweet.text;
        document.getElementById('tweet-date').textContent = tweet.date;
        document.getElementById('avatar').textContent = '?';
        Favorites.checkIfFavorited();
    },

    updateScoreboard() {
        document.getElementById('score').textContent = Game.score;
        document.getElementById('current').textContent = Game.currentIndex + 1;
        document.getElementById('streak').textContent = Game.streak;
    },

    showResult(correct, tweet) {
        const overlay = document.getElementById('result-overlay');
        const emoji = document.getElementById('result-emoji');
        const resultText = document.getElementById('result-text');
        const resultInfo = document.getElementById('result-info');

        if (correct) {
            emoji.textContent = Game.streak >= 3 ? '🔥' : '🎉';
            resultText.textContent = Game.streak >= 3 ? `${Game.streak} in a row!` : 'Correct!';
            resultText.className = 'result-text correct';
            
            if (tweet.isKanye) {
                resultInfo.textContent = "That was indeed Kanye West! 🎤";
            } else {
                resultInfo.textContent = `Not Kanye! That was ${tweet.realAuthor}`;
            }
        } else {
            emoji.textContent = '😅';
            resultText.textContent = 'Wrong!';
            resultText.className = 'result-text wrong';
            
            if (tweet.isKanye) {
                resultInfo.textContent = "That was actually Kanye! Classic Ye 🐻";
            } else {
                resultInfo.textContent = `That was ${tweet.realAuthor}, not Kanye!`;
            }
        }

        document.getElementById('avatar').textContent = tweet.isKanye ? '🐻' : '👤';
        overlay.classList.add('show');
    },

    hideResult() {
        document.getElementById('result-overlay').classList.remove('show');
    },

    showGameOver() {
        document.getElementById('tweet-card').classList.add('hidden');
        document.getElementById('game-buttons').classList.add('hidden');
        document.getElementById('game-over').classList.remove('hidden');

        const percentage = (Game.score / Game.getTotalTweets()) * 100;
        document.getElementById('final-score').textContent = `${Game.score}/${Game.getTotalTweets()}`;

        let message;
        if (percentage >= 90) {
            message = "🏆 You're a Kanye Expert! You really know your Ye!";
        } else if (percentage >= 70) {
            message = "🔥 Great job! You've got that Kanye intuition!";
        } else if (percentage >= 50) {
            message = "😎 Not bad! You know some Kanye energy!";
        } else if (percentage >= 30) {
            message = "🤔 Keep studying those tweets!";
        } else {
            message = "😅 Maybe listen to more Kanye interviews?";
        }

        document.getElementById('final-message').textContent = message;
    },

    updateFavoriteButton(isFavorited) {
        const favBtn = document.getElementById('fav-btn');
        const favText = document.getElementById('fav-text');
        
        if (isFavorited) {
            favBtn.classList.add('favorited');
            favText.textContent = 'Saved';
        } else {
            favBtn.classList.remove('favorited');
            favText.textContent = 'Save';
        }
    },

    renderFavorites() {
        const container = document.getElementById('favorites-list');
        const data = Storage.loadUserData();
        
        if (data.favorites.length === 0) {
            container.innerHTML = '<p class="no-favorites">No favorite tweets yet. Save tweets while playing!</p>';
            return;
        }

        container.innerHTML = data.favorites.map(fav => `
            <div class="favorite-tweet">
                <p>"${fav.text}"</p>
                <div class="favorite-meta">
                    <span class="favorite-author">${fav.isKanye ? '🐻' : '👤'} ${fav.author} • ${fav.date}</span>
                    <button class="remove-fav-btn" onclick="Favorites.remove('${fav.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    },

    showPrivacyPolicy() {
        const modal = document.createElement('div');
        modal.className = 'privacy-modal';
        modal.innerHTML = `
            <div class="privacy-modal-content">
                <h2>Privacy Policy</h2>
                <div class="privacy-body">
                    <h3>Data We Collect</h3>
                    <p>When you sign in with Google, we collect:</p>
                    <ul>
                        <li>Your name and email address</li>
                        <li>Your profile picture (if available)</li>
                        <li>Game statistics (scores, streaks)</li>
                    </ul>
                    
                    <h3>How We Use Your Data</h3>
                    <ul>
                        <li>To save your game progress across sessions</li>
                        <li>To display your profile in the app</li>
                        <li>To send newsletters (only if you opt-in)</li>
                    </ul>
                    
                    <h3>Data Security</h3>
                    <p>Your data is protected using:</p>
                    <ul>
                        <li>Supabase Auth for secure authentication</li>
                        <li>Row Level Security (RLS) to isolate user data</li>
                        <li>HTTPS encryption for all communications</li>
                    </ul>
                    
                    <h3>Newsletter</h3>
                    <p>If you check the newsletter box, we'll occasionally send updates about new features. You can unsubscribe at any time.</p>
                    
                    <h3>Your Rights</h3>
                    <p>You can request deletion of your data at any time by contacting us.</p>
                </div>
                <button class="btn-close-privacy" onclick="this.closest('.privacy-modal').remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async handleNewsletterConsent(checked) {
        if (!Auth.isAuthenticated() || !Auth.dbUser) {
            console.log('User not authenticated, cannot save newsletter preference');
            return;
        }

        if (checked) {
            const success = await Database.subscribeNewsletter(Auth.dbUser.email, Auth.dbUser.id);
            if (success) {
                console.log('Subscribed to newsletter');
            }
        } else {
            // Optionally handle unsubscribe
            console.log('Newsletter unchecked');
        }
    },

    updateNewsletterCheckbox() {
        // This would check if user is already subscribed and update checkbox
        // For now, just leave it unchecked by default
        const checkbox = document.getElementById('newsletter-consent');
        if (checkbox) {
            checkbox.checked = false;
        }
    }
};

// ============================================================
// INITIALIZATION
// ============================================================
window.onload = async function() {
    // Set up auth state listener
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            Auth.handleAuthChange(event, session);
        });
    }

    // Check for existing session
    await Auth.checkExistingSession();
};
