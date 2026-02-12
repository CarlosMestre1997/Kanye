// ============================================================
// CONFIG - Replace with your Google Client ID
// ============================================================
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// ============================================================
// AUTH MODULE
// ============================================================
const Auth = {
    currentUser: null,

    // Google Sign-In callback (called by Google's library)
    handleGoogleSignIn(response) {
        const payload = Auth.parseJwt(response.credential);
        Auth.currentUser = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            picture: payload.picture
        };
        localStorage.setItem('kanye_user', JSON.stringify(Auth.currentUser));
        UI.showMainApp();
    },

    parseJwt(token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    },

    signOut() {
        Auth.currentUser = null;
        localStorage.removeItem('kanye_user');
        document.getElementById('login-prompt').classList.remove('hidden');
        document.getElementById('main-container').classList.add('hidden');
    },

    checkExistingSession() {
        const savedUser = localStorage.getItem('kanye_user');
        if (savedUser) {
            Auth.currentUser = JSON.parse(savedUser);
            UI.showMainApp();
            return true;
        }
        return false;
    },

    isAuthenticated() {
        return Auth.currentUser !== null;
    }
};

// Make handleGoogleSignIn available globally for Google's callback
window.handleGoogleSignIn = (response) => Auth.handleGoogleSignIn(response);

// ============================================================
// DATA PERSISTENCE MODULE
// ============================================================
const Storage = {
    getUserDataKey() {
        return `kanye_data_${Auth.currentUser?.id || 'anonymous'}`;
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
    },

    updateStats(finalScore, maxStreak) {
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
        
        document.getElementById('user-name').textContent = Auth.currentUser.name;
        document.getElementById('stats-user-name').textContent = Auth.currentUser.name;
        
        if (Auth.currentUser.picture) {
            document.getElementById('user-avatar').src = Auth.currentUser.picture;
            document.getElementById('user-avatar').style.display = 'block';
        } else {
            document.getElementById('user-avatar').style.display = 'none';
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
    }
};

// ============================================================
// INITIALIZATION
// ============================================================
window.onload = function() {
    Auth.checkExistingSession();
};
