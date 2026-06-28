/**
 * ذكرياتنا V3.0 - Challenges & Achievements Module
 */

const Challenges = {
    init() {
        this.renderChallengesPage();
        this.checkDailyChallenges();
    },

    renderChallengesPage() {
        const container = document.getElementById('challenges-container');
        if (!container) return;

        container.innerHTML = `
            <div class="challenges-header">
                <h2>🏆 التحديات والإنجازات</h2>
            </div>

            <div class="level-progress-section">
                ${this.renderLevelProgress()}
            </div>

            <div class="daily-challenges-section">
                <h3>التحديات اليومية</h3>
                <div class="daily-challenges-grid">
                    ${this.renderDailyChallenges()}
                </div>
            </div>

            <div class="achievements-section">
                <h3>الإنجازات</h3>
                <div class="achievements-grid">
                    ${this.renderAchievements()}
                </div>
            </div>

            <div class="leaderboard-section">
                <h3>لوحة المتصدرين</h3>
                ${this.renderLeaderboard()}
            </div>
        `;
    },

    renderLevelProgress() {
        const user = Auth.getCurrentUser();
        const points = user?.points || 0;
        const currentLevel = this.getCurrentLevel(points);
        const nextLevel = CONSTANTS.LEVELS.find(l => l.id === currentLevel.id + 1);
        const progress = nextLevel ? ((points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100 : 100;

        return `
            <div class="level-card">
                <div class="level-icon">${currentLevel.icon}</div>
                <div class="level-info">
                    <h3>المستوى: ${currentLevel.name}</h3>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <p>${points} نقطة ${nextLevel ? `/ ${nextLevel.minPoints} للمستوى التالي` : '(الحد الأقصى)'}</p>
                </div>
            </div>
        `;
    },

    getCurrentLevel(points) {
        return CONSTANTS.LEVELS.slice().reverse().find(l => points >= l.minPoints) || CONSTANTS.LEVELS[0];
    },

    renderDailyChallenges() {
        const today = new Date().toDateString();
        let dailyChallenges = Storage.load('daily_challenges', null, 'couple');

        if (!dailyChallenges || dailyChallenges.date !== today) {
            const shuffled = [...CONSTANTS.DAILY_CHALLENGES].sort(() => 0.5 - Math.random());
            dailyChallenges = {
                date: today,
                challenges: shuffled.slice(0, 4).map(c => ({ ...c, completed: false }))
            };
            Storage.save('daily_challenges', dailyChallenges, 'couple');
        }

        const progress = Storage.getDailyProgress();

        return dailyChallenges.challenges.map(c => {
            const isCompleted = progress[`${today}_${c.id}`] || false;
            return `
                <div class="challenge-card ${isCompleted ? 'completed' : ''}">
                    <div class="challenge-icon">${c.icon}</div>
                    <h4>${c.title}</h4>
                    <p>${c.description}</p>
                    <div class="challenge-reward">+${c.points} نقطة</div>
                    ${!isCompleted ? `
                        <button class="btn-complete" onclick="Challenges.completeChallenge('${c.id}', ${c.points})">أكملت التحدي</button>
                    ` : `
                        <span class="completed-badge">✅ مكتمل</span>
                    `}
                </div>
            `;
        }).join('');
    },

    async completeChallenge(challengeId, points) {
        const today = new Date().toDateString();
        const progress = Storage.getDailyProgress();

        if (progress[`${today}_${challengeId}`]) return;

        progress[`${today}_${challengeId}`] = true;
        Storage.saveDailyProgress(progress);

        await this.addPoints(points);

        Notifications.show(`أحسنت! ربحت ${points} نقطة 🎉`, 'success');

        const completedToday = Object.keys(progress).filter(k => k.startsWith(today)).length;
        if (completedToday >= 4) {
            this.unlock('ach008');
        }

        this.renderChallengesPage();
    },

    async addPoints(points) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const newPoints = (user.points || 0) + points;
        await Auth.updateProfile({ points: newPoints });

        const newLevel = this.getCurrentLevel(newPoints);
        const oldLevel = this.getCurrentLevel(user.points || 0);

        if (newLevel.id > oldLevel.id) {
            Notifications.show(`مبروك! وصلت لمستوى ${newLevel.name} ${newLevel.icon}`, 'achievement');
            this.unlock('ach022');

            if (newLevel.id === 3) this.unlock('ach023');
            if (newLevel.id === 4) this.unlock('ach024');
            if (newLevel.id === 5) this.unlock('ach025');
        }
    },

    renderAchievements() {
        const userAchievements = Storage.getUserAchievements();
        const unlockedIds = userAchievements.map(a => a.achievement_id);

        return CONSTANTS.ACHIEVEMENTS.map(ach => {
            const isUnlocked = unlockedIds.includes(ach.id);
            return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">${isUnlocked ? ach.icon : '🔒'}</div>
                    <h4>${ach.title}</h4>
                    <p>${ach.description}</p>
                    <div class="achievement-points">${ach.points} نقطة</div>
                    ${isUnlocked ? `<span class="unlocked-date">${new Date(userAchievements.find(a => a.achievement_id === ach.id)?.unlocked_at).toLocaleDateString('ar')}</span>` : ''}
                </div>
            `;
        }).join('');
    },

    renderLeaderboard() {
        const user = Auth.getCurrentUser();
        const partner = Auth.getCurrentPartner();

        const userPoints = user?.points || 0;
        const partnerPoints = partner?.points || 0;

        const players = [
            { name: 'أنت', avatar: user?.avatar || '👤', points: userPoints, isMe: true },
            { name: partner?.name || 'شريكك', avatar: partner?.avatar || '👤', points: partnerPoints, isMe: false }
        ].sort((a, b) => b.points - a.points);

        return `
            <div class="leaderboard">
                ${players.map((p, i) => `
                    <div class="leaderboard-item ${p.isMe ? 'me' : ''} ${i === 0 ? 'first' : ''}">
                        <span class="rank">${i === 0 ? '🥇' : '🥈'}</span>
                        <span class="avatar">${p.avatar}</span>
                        <span class="name">${p.name}</span>
                        <span class="points">${p.points} نقطة</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async unlock(achievementId) {
        const achievements = Storage.getUserAchievements();

        if (achievements.some(a => a.achievement_id === achievementId)) return;

        const achievement = CONSTANTS.ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return;

        achievements.push({
            user_id: Auth.getCurrentUser()?.id,
            achievement_id: achievementId,
            unlocked_at: new Date().toISOString()
        });

        Storage.saveUserAchievements(achievements);

        await this.addPoints(achievement.points);

        Notifications.show(`إنجاز جديد! ${achievement.icon} ${achievement.title} (+${achievement.points} نقطة)`, 'achievement');

        if (achievements.length >= CONSTANTS.ACHIEVEMENTS.length) {
            this.unlock('ach031');
        }
    },

    checkDailyChallenges() {
        const events = Storage.getEvents();
        const diary = Storage.getDiaryEntries();
        const qa = Storage.getQuestionsAnswers();

        if (events.length >= 1) this.unlock('ach002');
        if (events.length >= 50) this.unlock('ach016');

        const eventsWithPhotos = events.filter(e => e.photos && e.photos.length > 0).length;
        if (eventsWithPhotos >= 5) this.unlock('ach003');
        if (eventsWithPhotos >= 100) this.unlock('ach017');

        if (diary.length >= 10) this.unlock('ach004');
        if (diary.length >= 50) this.unlock('ach018');

        const relationshipDuration = Profile.getRelationshipDuration ? Profile.getRelationshipDuration() : null;
        if (relationshipDuration) {
            if (relationshipDuration.totalDays >= 1) this.unlock('ach012');
            if (relationshipDuration.totalDays >= 7) this.unlock('ach013');
            if (relationshipDuration.totalDays >= 30) this.unlock('ach014');
            if (relationshipDuration.totalDays >= 365) this.unlock('ach015');
        }
    }
};

const Achievements = Challenges;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Challenges;
}
