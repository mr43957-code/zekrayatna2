/**
 * ذكرياتنا V3.0 - Storage Module
 * Local Storage management with partner awareness
 */

const Storage = {
    // Prefix for all keys to avoid conflicts
    PREFIX: 'zekrayatna_',

    // Get current user ID
    getCurrentUserId() {
        const user = Auth.getCurrentUser();
        return user ? user.id : null;
    },

    // Get current couple ID
    getCurrentCoupleId() {
        const user = Auth.getCurrentUser();
        return user ? user.couple_id : null;
    },

    // Generate storage key with user/couple context
    generateKey(key, scope = 'user') {
        const userId = this.getCurrentUserId();
        const coupleId = this.getCurrentCoupleId();

        if (scope === 'couple' && coupleId) {
            return `${this.PREFIX}couple_${coupleId}_${key}`;
        }
        if (scope === 'user' && userId) {
            return `${this.PREFIX}user_${userId}_${key}`;
        }
        return `${this.PREFIX}global_${key}`;
    },

    // Save data to localStorage
    save(key, data, scope = 'user') {
        try {
            const storageKey = this.generateKey(key, scope);
            const serialized = JSON.stringify({
                data: data,
                timestamp: new Date().toISOString(),
                version: CONSTANTS.APP_VERSION
            });
            localStorage.setItem(storageKey, serialized);
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            Notifications.show('خطأ في حفظ البيانات المحلية', 'error');
            return false;
        }
    },

    // Load data from localStorage
    load(key, defaultValue = null, scope = 'user') {
        try {
            const storageKey = this.generateKey(key, scope);
            const item = localStorage.getItem(storageKey);

            if (!item) return defaultValue;

            const parsed = JSON.parse(item);
            return parsed.data !== undefined ? parsed.data : defaultValue;
        } catch (error) {
            console.error('Storage load error:', error);
            return defaultValue;
        }
    },

    // Remove data from localStorage
    remove(key, scope = 'user') {
        try {
            const storageKey = this.generateKey(key, scope);
            localStorage.removeItem(storageKey);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    // Get all keys for current user/couple
    getAllKeys(scope = 'user') {
        const keys = [];
        const prefix = scope === 'couple' 
            ? `${this.PREFIX}couple_${this.getCurrentCoupleId()}_`
            : `${this.PREFIX}user_${this.getCurrentUserId()}_`;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key.replace(prefix, ''));
            }
        }
        return keys;
    },

    // Clear all data for current user
    clearUserData() {
        const prefix = `${this.PREFIX}user_${this.getCurrentUserId()}_`;
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    // Clear all couple data
    clearCoupleData() {
        const prefix = `${this.PREFIX}couple_${this.getCurrentCoupleId()}_`;
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    // Export all data as JSON
    exportData() {
        const data = {
            version: CONSTANTS.APP_VERSION,
            exportDate: new Date().toISOString(),
            user: this.getCurrentUserId(),
            couple: this.getCurrentCoupleId(),
            data: {}
        };

        const userPrefix = `${this.PREFIX}user_${this.getCurrentUserId()}_`;
        const couplePrefix = `${this.PREFIX}couple_${this.getCurrentCoupleId()}_`;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(userPrefix) || key.startsWith(couplePrefix))) {
                try {
                    data.data[key] = JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    data.data[key] = localStorage.getItem(key);
                }
            }
        }

        return JSON.stringify(data, null, 2);
    },

    // Import data from JSON
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (!data.data || typeof data.data !== 'object') {
                throw new Error('Invalid data format');
            }

            Object.entries(data.data).forEach(([key, value]) => {
                if (typeof value === 'object') {
                    localStorage.setItem(key, JSON.stringify(value));
                } else {
                    localStorage.setItem(key, value);
                }
            });

            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    },

    // Get storage usage info
    getUsage() {
        let total = 0;
        let count = 0;
        const userPrefix = `${this.PREFIX}user_${this.getCurrentUserId()}_`;
        const couplePrefix = `${this.PREFIX}couple_${this.getCurrentCoupleId()}_`;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(userPrefix) || key.startsWith(couplePrefix))) {
                total += localStorage.getItem(key).length * 2; // UTF-16 = 2 bytes per char
                count++;
            }
        }

        return {
            items: count,
            bytes: total,
            kb: (total / 1024).toFixed(2),
            mb: (total / (1024 * 1024)).toFixed(2)
        };
    },

    // Specific data helpers
    getEvents() {
        return this.load('events', [], 'couple');
    },

    saveEvents(events) {
        return this.save('events', events, 'couple');
    },

    getCapsules() {
        return this.load('capsules', [], 'couple');
    },

    saveCapsules(capsules) {
        return this.save('capsules', capsules, 'couple');
    },

    getDiaryEntries() {
        return this.load('diary', [], 'user');
    },

    saveDiaryEntries(entries) {
        return this.save('diary', entries, 'user');
    },

    getQuestionsAnswers() {
        return this.load('qa', [], 'couple');
    },

    saveQuestionsAnswers(qa) {
        return this.save('qa', qa, 'couple');
    },

    getUserAchievements() {
        return this.load('achievements', [], 'user');
    },

    saveUserAchievements(achievements) {
        return this.save('achievements', achievements, 'user');
    },

    getDailyProgress() {
        return this.load('daily_progress', {}, 'user');
    },

    saveDailyProgress(progress) {
        return this.save('daily_progress', progress, 'user');
    },

    getSettings() {
        return this.load('settings', {}, 'user');
    },

    saveSettings(settings) {
        return this.save('settings', settings, 'user');
    },

    getGameHistory() {
        return this.load('game_history', [], 'couple');
    },

    saveGameHistory(history) {
        return this.save('game_history', history, 'couple');
    },

    getChatHistory() {
        return this.load('chat_history', [], 'user');
    },

    saveChatHistory(history) {
        return this.save('chat_history', history, 'user');
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
