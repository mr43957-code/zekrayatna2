// ============================================================
// fixes.js — إصلاح شامل لتطبيق ذكرياتنا
// يُحمَّل بعد supabase-config.js و app.js
// ============================================================

'use strict';

/* ============================================================
   1. إصلاح مفاتيح STORAGE المفقودة
   ============================================================ */
(function fixStorageKeys() {
    if (typeof STORAGE === 'undefined') {
        console.error('STORAGE not defined yet — fixing deferred');
        return;
    }

    const missing = {
        GAMIFICATION:        'romantic_gamification_v4',
        GAMES_DATA:          'romantic_games_v4',
        GAMES_HISTORY:       'romantic_games_history_v4',
        QUESTIONS_ANSWERS:   'romantic_questions_answers_v4',
        CUSTOM_QUESTIONS:    'romantic_custom_questions_v4',
        QUESTION_OF_THE_DAY:'romantic_question_of_the_day',
        SHARED_RESULTS:      'romantic_shared_game_results_v4',
    };

    Object.entries(missing).forEach(([k, v]) => {
        if (!STORAGE[k]) STORAGE[k] = v;
    });

    // تأكد من وجود مفاتيح الشريكين
    const perPartner = {
        GAMIFICATION_P1:       'romantic_gamification_v4_p1',
        GAMIFICATION_P2:       'romantic_gamification_v4_p2',
        QUESTIONS_ANSWERS_P1:  'romantic_questions_answers_v4_p1',
        QUESTIONS_ANSWERS_P2:  'romantic_questions_answers_v4_p2',
        GAMES_DATA_P1:         'romantic_games_v4_p1',
        GAMES_DATA_P2:         'romantic_games_v4_p2',
        GAMES_HISTORY_P1:      'romantic_games_history_v4_p1',
        GAMES_HISTORY_P2:      'romantic_games_history_v4_p2',
        CUSTOM_QUESTIONS_P1:   'romantic_custom_questions_v4_p1',
        CUSTOM_QUESTIONS_P2:   'romantic_custom_questions_v4_p2',
    };

    Object.entries(perPartner).forEach(([k, v]) => {
        if (!STORAGE[k]) STORAGE[k] = v;
    });

    console.log('✅ STORAGE keys fixed:', Object.keys(STORAGE).length, 'keys');
})();


/* ============================================================
   2. متغير modernCurrentPartner آمن
   ============================================================ */
if (typeof window.modernCurrentPartner === 'undefined') {
    window.modernCurrentPartner = null;
}
// اقرأ من localStorage مباشرة عند التحميل
(function restorePartner() {
    const saved = localStorage.getItem('modern_partner');
    if (saved) window.modernCurrentPartner = parseInt(saved);
})();


/* ============================================================
   3. دوال مساعدة آمنة للشريك الحالي
   ============================================================ */
function _partnerKey(base) {
    const p = window.modernCurrentPartner || 1;
    return `${base}_p${p}`;
}

function _getJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function _setJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        // مزامنة مؤجلة مع Supabase
        _scheduleSyncItem(key, value);
        return true;
    } catch (e) {
        console.error('Storage write error:', e);
        return false;
    }
}

/* ============================================================
   4. نظام مزامنة محسن مع Supabase
   ============================================================ */
const _syncPending = new Map();

function _scheduleSyncItem(key, data) {
    if (!window.supabaseAvailable || !window.modernCurrentPartner) return;
    _syncPending.set(key, data);
    clearTimeout(window._syncTimer);
    window._syncTimer = setTimeout(_flushSync, 800);
}

async function _flushSync() {
    if (!window.supabaseAvailable || !window.modernCurrentPartner || !supabaseClient) return;
    const entries = Array.from(_syncPending.entries());
    _syncPending.clear();

    for (const [key, data] of entries) {
        try {
            await supabaseClient.from(key).upsert({
                partner_id: window.modernCurrentPartner,
                data: data,
                updated_at: new Date().toISOString()
            }, { onConflict: 'partner_id' });
        } catch (e) {
            // أضف للطابور للمحاولة لاحقاً
            if (Array.isArray(window.syncQueue)) {
                window.syncQueue.push({ table: key, data, timestamp: Date.now() });
            }
        }
    }
}

// معالجة الطابور عند استعادة الاتصال
window.addEventListener('online', async () => {
    if (!Array.isArray(window.syncQueue) || !window.syncQueue.length) return;
    const queue = [...window.syncQueue];
    window.syncQueue = [];
    for (const item of queue) {
        await _scheduleSyncItem(item.table, item.data);
    }
    await _flushSync();
});


/* ============================================================
   5. Gamification — دوال آمنة للشريك الحالي
   ============================================================ */
function _defaultGamification() {
    return {
        points: 0,
        level: 1,
        achievements: [],
        completedChallenges: [],
        loginStreak: 0,
        lastLoginDate: null,
        dailyChallenges: [],
        challengesCompletedToday: 0,
        unlockedRewards: ['romantic-dark'],
        lastUpdated: new Date().toISOString()
    };
}

// override دوال Gamification الأصلية بأخرى تعمل
window.getGamificationData = function () {
    const key = _partnerKey('romantic_gamification_v4');
    return _getJSON(key, _defaultGamification());
};

window.setGamificationData = function (data) {
    const key = _partnerKey('romantic_gamification_v4');
    data.lastUpdated = new Date().toISOString();
    return _setJSON(key, data);
};

window.defaultGamificationData = _defaultGamification;


/* ============================================================
   6. Games — دوال آمنة
   ============================================================ */
function _defaultGames() {
    return {
        totalGames: 0,
        gamesPlayed: { know_your_partner: 0, who_is_more: 0, back_to_first: 0, build_home: 0 },
        scores: {
            know_your_partner: { correct: 0, total: 0 },
            who_is_more: { correct: 0, total: 0 },
            back_to_first: { correct: 0, total: 0 },
            build_home: { matches: 0, total: 0 }
        },
        lastPlayed: null
    };
}

window.getGamesData = function () {
    const key = _partnerKey('romantic_games_v4');
    return _getJSON(key, _defaultGames());
};

window.setGamesData = function (data) {
    const key = _partnerKey('romantic_games_v4');
    return _setJSON(key, data);
};

window.getGamesHistory = function () {
    const key = _partnerKey('romantic_games_history_v4');
    return _getJSON(key, []);
};

window.setGamesHistory = function (history) {
    const key = _partnerKey('romantic_games_history_v4');
    return _setJSON(key, history);
};

window.defaultGamesData = _defaultGames;


/* ============================================================
   7. Questions — دوال آمنة
   ============================================================ */
window.getQuestionsAnswers = function () {
    const key = _partnerKey('romantic_questions_answers_v4');
    return _getJSON(key, []);
};

window.setQuestionsAnswers = function (answers) {
    const key = _partnerKey('romantic_questions_answers_v4');
    return _setJSON(key, answers);
};

window.getCustomQuestions = function () {
    const key = _partnerKey('romantic_custom_questions_v4');
    return _getJSON(key, []);
};

window.setCustomQuestions = function (questions) {
    const key = _partnerKey('romantic_custom_questions_v4');
    return _setJSON(key, questions);
};

window.getQuestionOfTheDay = function () {
    return _getJSON('romantic_question_of_the_day', null);
};

window.setQuestionOfTheDay = function (q) {
    return _setJSON('romantic_question_of_the_day', q);
};


/* ============================================================
   8. Capsules — دوال آمنة (مشتركة بين الشريكين)
   ============================================================ */
window.getCapsules = function () {
    return _getJSON(STORAGE.TIME_CAPSULES || 'romantic_time_capsules_v4', []);
};

window.setCapsules = function (capsules) {
    const key = STORAGE.TIME_CAPSULES || 'romantic_time_capsules_v4';
    return _setJSON(key, capsules);
};

window.updateCapsulesBadge = function () {
    const capsules = window.getCapsules();
    const now = new Date();
    const count = capsules.filter(c => !c.isOpened && new Date(c.openDate) <= now).length;
    const badge = document.getElementById('badgeCapsules');
    if (badge) {
        badge.textContent = count || 0;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
};


/* ============================================================
   9. Diary — دوال آمنة
   ============================================================ */
window.getDiaryEntries = function () {
    return _getJSON(STORAGE.DIARY_ENTRIES || 'romantic_diary_v4', []);
};

window.setDiaryEntries = function (entries) {
    const key = STORAGE.DIARY_ENTRIES || 'romantic_diary_v4';
    _setJSON(key, entries);
    if (typeof window.updateDiaryStats === 'function') window.updateDiaryStats();
    const badge = document.getElementById('badgeDiary');
    if (badge) {
        const now = new Date();
        const month = entries.filter(e => {
            const d = new Date(e.date || e.createdAt);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        badge.textContent = month;
    }
};


/* ============================================================
   10. دوال Action Hooks — ربط الإجراءات بالـ Gamification
   ============================================================ */
function _safeAddPoints(pts, label) {
    if (typeof window.addPoints === 'function') {
        try { window.addPoints(pts, label); } catch (e) {}
    }
}

window.onEventAdded = function () { _safeAddPoints(10, 'إضافة مناسبة'); };
window.onPhotoAdded = function () { _safeAddPoints(5, 'إضافة صورة'); };
window.onDiaryAdded = function () { _safeAddPoints(8, 'كتابة خاطرة'); };
window.onCapsuleAdded = function () { _safeAddPoints(15, 'إنشاء كبسولة'); };
window.onMessageSaved = function () { _safeAddPoints(3, 'حفظ رسالة'); };
window.onGiftSaved = function () { _safeAddPoints(3, 'حفظ فكرة هدية'); };


/* ============================================================
   11. إصلاح supabaseLoadAllData
   ============================================================ */
window.supabaseLoadAllData = async function () {
    if (!window.supabaseAvailable || !window.modernCurrentPartner) {
        console.warn('⚠️ supabaseLoadAllData: not ready');
        return { success: false };
    }

    const p = window.modernCurrentPartner;

    const tables = [
        { key: 'romantic_events_v3',        localKey: STORAGE.EVENTS,          def: [] },
        { key: 'romantic_archive_v3',        localKey: STORAGE.ARCHIVE,         def: [] },
        { key: 'romantic_saved_messages',    localKey: STORAGE.MESSAGES,        def: [] },
        { key: 'romantic_saved_gifts',       localKey: STORAGE.GIFTS,           def: [] },
        { key: 'romantic_settings_v3',       localKey: STORAGE.SETTINGS,        def: {} },
        { key: 'romantic_time_capsules_v4',  localKey: STORAGE.TIME_CAPSULES,   def: [] },
        { key: 'romantic_diary_v4',          localKey: STORAGE.DIARY_ENTRIES,   def: [] },
        { key: `romantic_gamification_v4_p${p}`,      localKey: `romantic_gamification_v4_p${p}`,      def: _defaultGamification() },
        { key: `romantic_games_v4_p${p}`,             localKey: `romantic_games_v4_p${p}`,             def: _defaultGames() },
        { key: `romantic_games_history_v4_p${p}`,     localKey: `romantic_games_history_v4_p${p}`,     def: [] },
        { key: `romantic_questions_answers_v4_p${p}`, localKey: `romantic_questions_answers_v4_p${p}`, def: [] },
        { key: `romantic_custom_questions_v4_p${p}`,  localKey: `romantic_custom_questions_v4_p${p}`,  def: [] },
    ];

    let ok = 0, fail = 0;

    for (const t of tables) {
        try {
            const { data, error } = await supabaseClient
                .from(t.key)
                .select('data, updated_at')
                .eq('partner_id', p)
                .maybeSingle();

            if (!error && data && data.data !== null) {
                localStorage.setItem(t.localKey, JSON.stringify(data.data));
                ok++;
            } else {
                // لا تكتب البيانات الافتراضية إذا كانت موجودة محلياً
                if (!localStorage.getItem(t.localKey)) {
                    localStorage.setItem(t.localKey, JSON.stringify(t.def));
                }
            }
        } catch (e) {
            fail++;
            if (!localStorage.getItem(t.localKey)) {
                localStorage.setItem(t.localKey, JSON.stringify(t.def));
            }
        }
    }

    console.log(`✅ supabaseLoadAllData: ${ok} loaded, ${fail} failed`);
    return { success: true, ok, fail };
};


/* ============================================================
   12. إصلاح defaultGamificationData في app.js
       (تُستدعى من supabase-config.js)
   ============================================================ */
if (typeof window.defaultGamificationData !== 'function') {
    window.defaultGamificationData = _defaultGamification;
}
if (typeof window.defaultGamesData !== 'function') {
    window.defaultGamesData = _defaultGames;
}


/* ============================================================
   13. إصلاح calculateLevel
   ============================================================ */
if (typeof window.calculateLevel !== 'function') {
    window.calculateLevel = function (points) {
        const levels = [0, 500, 1500, 3000, 5000, 10000];
        let lvl = 1;
        for (let i = 0; i < levels.length; i++) {
            if (points >= levels[i]) lvl = i + 1;
        }
        return Math.min(lvl, 6);
    };
}


/* ============================================================
   14. إصلاح ensureGamificationData + checkDailyChallenges
   ============================================================ */
window.ensureGamificationData = function () {
    const gam = window.getGamificationData();
    const today = new Date().toISOString().split('T')[0];

    if (!Array.isArray(gam.dailyChallenges) || gam.dailyChallenges.length === 0) {
        gam.dailyChallenges = _generateDailyChallenges();
    }
    if (!gam.lastLoginDate || gam.lastLoginDate !== today) {
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yesterdayStr = yest.toISOString().split('T')[0];
        gam.loginStreak = gam.lastLoginDate === yesterdayStr ? (gam.loginStreak || 0) + 1 : 1;
        gam.lastLoginDate = today;
        gam.challengesCompletedToday = 0;
    }
    window.setGamificationData(gam);
    return gam;
};

function _generateDailyChallenges() {
    if (typeof DAILY_CHALLENGES !== 'undefined' && DAILY_CHALLENGES.length) {
        return [...DAILY_CHALLENGES]
            .sort(() => 0.5 - Math.random())
            .slice(0, 4)
            .map(c => ({ ...c, completed: false, date: new Date().toISOString().split('T')[0] }));
    }
    // fallback إذا لم تُعرَّف DAILY_CHALLENGES بعد
    return [
        { id: 'challenge_diary',   title: 'خواطر اليوم',     description: 'اكتب خاطرة في يومياتك',      icon: '📝', points: 40, completed: false, date: new Date().toISOString().split('T')[0] },
        { id: 'challenge_photo',   title: 'ذكريات بالألوان', description: 'أضف صورة لمناسبة',            icon: '📸', points: 50, completed: false, date: new Date().toISOString().split('T')[0] },
        { id: 'challenge_message', title: 'كلمة حلوة',        description: 'احفظ رسالة رومانسية جديدة', icon: '💌', points: 30, completed: false, date: new Date().toISOString().split('T')[0] },
        { id: 'challenge_capsule', title: 'رسالة مستقبلية',   description: 'أنشئ كبسولة زمنية',          icon: '⏳', points: 60, completed: false, date: new Date().toISOString().split('T')[0] },
    ];
}

window.checkDailyChallenges = function () {
    return window.ensureGamificationData();
};


/* ============================================================
   15. إضافة addPoints آمنة إذا لم تكن معرفة
   ============================================================ */
if (typeof window.addPoints !== 'function') {
    window.addPoints = function (points, _label) {
        const gam = window.getGamificationData();
        gam.points = (gam.points || 0) + points;
        const newLvl = window.calculateLevel(gam.points);
        if (newLvl > gam.level) {
            gam.level = newLvl;
            if (typeof window.showToast === 'function') {
                window.showToast(`🎊 مستوى جديد! المستوى ${newLvl}`, 'success');
            }
        }
        window.setGamificationData(gam);
        if (typeof window.updateGamificationUI === 'function') window.updateGamificationUI();
    };
}


/* ============================================================
   16. completeChallenge آمنة
   ============================================================ */
window.completeChallenge = function (challengeId) {
    const gam = window.getGamificationData();
    if (!Array.isArray(gam.dailyChallenges)) return;
    const ch = gam.dailyChallenges.find(c => c.id === challengeId);
    if (!ch || ch.completed) return;

    ch.completed = true;
    gam.challengesCompletedToday = (gam.challengesCompletedToday || 0) + 1;
    if (!Array.isArray(gam.completedChallenges)) gam.completedChallenges = [];
    gam.completedChallenges.push({ id: challengeId, date: new Date().toISOString() });

    window.setGamificationData(gam);
    _safeAddPoints(ch.points || 20, `تحدي: ${ch.title}`);

    if (typeof window.renderDailyChallenges === 'function') window.renderDailyChallenges();
    if (typeof window.showToast === 'function') {
        window.showToast(`🎉 أكملت التحدي! +${ch.points} نقطة`, 'success');
    }
};


/* ============================================================
   17. initializeGamification آمنة
   ============================================================ */
window.initializeGamification = function () {
    try {
        window.ensureGamificationData();
        if (typeof window.renderGamification === 'function') window.renderGamification();
    } catch (e) {
        console.warn('initializeGamification error:', e);
    }
};


/* ============================================================
   18. إصلاح لوحة Leaderboard — تعرض بيانات كلا الشريكين
   ============================================================ */
window.renderLeaderboard = function () {
    const settings = typeof getSettings === 'function' ? getSettings() : {};
    const myName = settings.partnerName || (window.modernCurrentPartner === 1 ? 'أنت' : 'الشريك');

    const p1Gam = _getJSON('romantic_gamification_v4_p1', { points: 0 });
    const p2Gam = _getJSON('romantic_gamification_v4_p2', { points: 0 });

    const p1Pts = p1Gam.points || 0;
    const p2Pts = p2Gam.points || 0;

    const p1El = document.getElementById('partner1Points');
    const p2El = document.getElementById('partner2Points');
    const msgEl = document.getElementById('leaderboardMessage');

    if (p1El) p1El.textContent = p1Pts;
    if (p2El) p2El.textContent = p2Pts;

    if (msgEl) {
        if (p1Pts === 0 && p2Pts === 0) {
            msgEl.textContent = 'ابدأ بإضافة مناسبات لكسب النقاط 💕';
        } else {
            const diff = Math.abs(p1Pts - p2Pts);
            const leader = p1Pts >= p2Pts ? 'الشريك الأول' : 'الشريك الثاني';
            msgEl.textContent = diff === 0 ? 'تعادل تام! 🤝' : `${leader} متقدم بـ ${diff} نقطة ❤️`;
        }
    }
};


/* ============================================================
   19. deleteCapsule — كانت مفقودة
   ============================================================ */
window.deleteCapsule = function (id) {
    if (!confirm('هل أنت متأكد من حذف هذه الكبسولة؟')) return;
    const capsules = window.getCapsules().filter(c => c.id !== id);
    window.setCapsules(capsules);
    if (typeof window.renderCapsules === 'function') window.renderCapsules();
    if (typeof window.showToast === 'function') window.showToast('تم حذف الكبسولة 🗑️', 'info');
};


/* ============================================================
   20. تصحيح renderCapsules — دفاعياً
   ============================================================ */
const _origRenderCapsules = window.renderCapsules;
window.renderCapsules = function () {
    try {
        if (typeof _origRenderCapsules === 'function') _origRenderCapsules();
        window.updateCapsulesBadge();
    } catch (e) {
        console.warn('renderCapsules error:', e);
        const container = document.getElementById('capsulesGrid');
        if (container) container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><h3>لا توجد كبسولات بعد</h3><button class="btn btn-primary" onclick="openCapsuleModal()"><i class="fas fa-plus"></i> كبسولة جديدة</button></div>';
    }
};


/* ============================================================
   21. تصحيح renderGamification — دفاعياً
   ============================================================ */
const _origRenderGamification = window.renderGamification;
window.renderGamification = function () {
    try {
        window.ensureGamificationData();
        if (typeof _origRenderGamification === 'function') _origRenderGamification();
    } catch (e) {
        console.warn('renderGamification error:', e);
    }
};


/* ============================================================
   22. إضافة الإشعارات الداخلية الذكية
   ============================================================ */
window.smartInternalNotify = function () {
    const settings = typeof getSettings === 'function' ? getSettings() : {};
    if (!settings.internalNotify) return;

    const events = typeof getEvents === 'function' ? getEvents() : [];
    const today = new Date();

    events.forEach(ev => {
        if (ev.muted) return;

        const effectiveDate = typeof getEffectiveDate === 'function'
            ? getEffectiveDate(ev)
            : ev.date;

        const daysLeft = typeof getDaysUntil === 'function'
            ? getDaysUntil(effectiveDate)
            : Math.ceil((new Date(effectiveDate) - today) / 86400000);

        if (daysLeft === 0 && typeof showToast === 'function') {
            showToast(`🎉 اليوم مناسبة: ${ev.emoji || ''} ${ev.name}!`, 'info');
        } else if (daysLeft === 1 && typeof showToast === 'function') {
            showToast(`⏰ غداً: ${ev.emoji || ''} ${ev.name}`, 'info');
        } else if (daysLeft === 7 && typeof showToast === 'function') {
            showToast(`📅 بعد أسبوع: ${ev.emoji || ''} ${ev.name}`, 'info');
        }
    });

    // التحقق من الكبسولات المتاحة
    const capsules = window.getCapsules();
    const available = capsules.filter(c => !c.isOpened && new Date(c.openDate) <= today);
    if (available.length > 0 && typeof showToast === 'function') {
        showToast(`📦 لديك ${available.length} كبسولة زمنية جاهزة للفتح!`, 'info');
    }
};


/* ============================================================
   23. إصلاح نظام الأسئلة — checkAndUpdateQuestionOfTheDay
   ============================================================ */
const _origCheckQOTD = window.checkAndUpdateQuestionOfTheDay;
window.checkAndUpdateQuestionOfTheDay = function () {
    try {
        const today = new Date().toISOString().split('T')[0];
        const last = window.getQuestionOfTheDay();

        if (!last || last.date !== today) {
            // اختر سؤالاً عشوائياً
            const pool = typeof ALL_QUESTIONS !== 'undefined' ? ALL_QUESTIONS : [];
            const custom = window.getCustomQuestions();
            const all = [...pool, ...custom];

            if (all.length > 0) {
                const q = all[Math.floor(Math.random() * all.length)];
                window.setQuestionOfTheDay({ ...q, date: today });

                const iconEl = document.getElementById('questionOfTheDayIcon');
                const textEl = document.getElementById('questionOfTheDayText');
                if (iconEl) iconEl.textContent = q.icon || '❓';
                if (textEl) textEl.textContent = q.question;
            }
        } else {
            const iconEl = document.getElementById('questionOfTheDayIcon');
            const textEl = document.getElementById('questionOfTheDayText');
            if (iconEl) iconEl.textContent = last.icon || '❓';
            if (textEl) textEl.textContent = last.question;
        }

        // تحديث المؤقت
        _updateQOTDTimer();
    } catch (e) {
        if (typeof _origCheckQOTD === 'function') _origCheckQOTD();
    }
};

function _updateQOTDTimer() {
    const el = document.getElementById('questionOfTheDayTimer');
    if (!el) return;
    const now = new Date();
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const diff = end - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    el.textContent = `يتجدد بعد ${h} ساعة و ${m} دقيقة`;
    setTimeout(_updateQOTDTimer, 60000);
}


/* ============================================================
   24. إصلاح saveGameResult — يستخدم الدوال الجديدة
   ============================================================ */
window.saveGameResult = function (gameId, score) {
    const gamesData = window.getGamesData();
    const history = window.getGamesHistory();

    gamesData.totalGames = (gamesData.totalGames || 0) + 1;
    if (!gamesData.gamesPlayed) gamesData.gamesPlayed = {};
    gamesData.gamesPlayed[gameId] = (gamesData.gamesPlayed[gameId] || 0) + 1;
    gamesData.lastPlayed = new Date().toISOString();

    const totalQuestions = typeof currentQuestions !== 'undefined' ? currentQuestions.length : 5;

    if (!gamesData.scores) gamesData.scores = {};
    if (!gamesData.scores[gameId]) gamesData.scores[gameId] = { correct: 0, total: 0 };
    gamesData.scores[gameId].correct = (gamesData.scores[gameId].correct || 0) + (score.matches || 0);
    gamesData.scores[gameId].total   = (gamesData.scores[gameId].total   || 0) + totalQuestions;

    window.setGamesData(gamesData);

    const newHistory = [...history, {
        id: Date.now().toString(36),
        gameId,
        date: new Date().toISOString(),
        score,
        questions: totalQuestions
    }].slice(-20);

    window.setGamesHistory(newHistory);

    if (typeof window.renderRecentGames === 'function')  window.renderRecentGames();
    if (typeof window.updateGamesStats === 'function')   window.updateGamesStats();

    _safeAddPoints(10, `لعبة: ${gameId}`);
};


/* ============================================================
   25. تسجيل نشاط الأسئلة في Gamification
   ============================================================ */
const _origSaveAnswer = window.saveAnswer;
window.saveAnswer = function (e) {
    if (typeof _origSaveAnswer === 'function') _origSaveAnswer(e);
    _safeAddPoints(5, 'إجابة سؤال');
    if (typeof window.updateQuestionsStats === 'function') window.updateQuestionsStats();
};


/* ============================================================
   26. إصلاح refreshAll — يحدث شارات التبويبات
   ============================================================ */
const _origRefreshAll = window.refreshAll;
window.refreshAll = function () {
    try {
        if (typeof _origRefreshAll === 'function') _origRefreshAll();
    } catch (e) { console.warn('refreshAll error:', e); }

    // تحديث شارات إضافية
    window.updateCapsulesBadge();
    if (typeof window.updateGamificationBadge === 'function') window.updateGamificationBadge();
    if (typeof window.updateQuestionsStats    === 'function') window.updateQuestionsStats();
    if (typeof window.updateDiaryStats        === 'function') window.updateDiaryStats();
};


/* ============================================================
   27. إصلاح modernHandleLogin — يضمن تحميل البيانات
   ============================================================ */
const _origLogin = window.modernHandleLogin;
window.modernHandleLogin = async function () {
    if (typeof _origLogin === 'function') {
        await _origLogin();
    }
    // بعد تسجيل الدخول: تأكد من تهيئة Gamification
    setTimeout(() => {
        window.ensureGamificationData();
        window.smartInternalNotify();
    }, 1500);
};


/* ============================================================
   28. إصلاح init — يضمن استدعاء الدوال الجديدة
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    // انتظر قليلاً حتى تنتهي app.js من التنفيذ
    setTimeout(() => {
        // أصلح المفاتيح مجدداً (بعد تعريف STORAGE في app.js)
        if (typeof STORAGE !== 'undefined') {
            const needed = {
                GAMIFICATION:        'romantic_gamification_v4',
                GAMES_DATA:          'romantic_games_v4',
                GAMES_HISTORY:       'romantic_games_history_v4',
                QUESTIONS_ANSWERS:   'romantic_questions_answers_v4',
                CUSTOM_QUESTIONS:    'romantic_custom_questions_v4',
                QUESTION_OF_THE_DAY:'romantic_question_of_the_day',
            };
            Object.entries(needed).forEach(([k, v]) => { if (!STORAGE[k]) STORAGE[k] = v; });
        }

        // تهيئة Gamification
        if (window.modernCurrentPartner) {
            window.ensureGamificationData();
        }

        // إشعارات ذكية بعد التحميل
        setTimeout(window.smartInternalNotify, 3000);

    }, 500);
}, { once: true });


/* ============================================================
   29. دوال مفقودة تُستدعى من HTML
   ============================================================ */

// deleteCapsule — مُعرَّفة أعلاه (19)

// openCapsuleModal — تأكد من وجودها
if (typeof window.openCapsuleModal !== 'function') {
    window.openCapsuleModal = function () {
        const overlay = document.getElementById('capsuleModalOverlay');
        if (overlay) overlay.classList.add('active');
    };
}

if (typeof window.closeCapsuleModal !== 'function') {
    window.closeCapsuleModal = function () {
        const overlay = document.getElementById('capsuleModalOverlay');
        if (overlay) overlay.classList.remove('active');
    };
}

// openDiaryEntryModal — تأكد من وجودها
if (typeof window.openDiaryEntryModal !== 'function') {
    window.openDiaryEntryModal = function () {
        const overlay = document.getElementById('diaryModalOverlay');
        if (overlay) overlay.classList.add('active');
    };
}

if (typeof window.closeDiaryModal !== 'function') {
    window.closeDiaryModal = function () {
        const overlay = document.getElementById('diaryModalOverlay');
        if (overlay) overlay.classList.remove('active');
    };
}

// startGame guard
if (typeof window.startGame !== 'function') {
    window.startGame = function (id) {
        console.warn('startGame called but not defined for:', id);
    };
}


/* ============================================================
   30. إصلاح شريط تقدم الكبسولات
   ============================================================ */
const _origOpenCapsule = window.openCapsule;
window.openCapsule = function (id) {
    const capsules = window.getCapsules();
    const capsule = capsules.find(c => c.id === id);
    if (!capsule) return;

    if (!capsule.isOpened) {
        capsule.isOpened = true;
        capsule.openedAt = new Date().toISOString();
        window.setCapsules(capsules);
        _safeAddPoints(20, 'فتح كبسولة زمنية');
    }

    // استدعاء الأصلية أو اعرض محتوى بسيط
    if (typeof _origOpenCapsule === 'function') {
        _origOpenCapsule(id);
    } else {
        let html = `<h3 style="text-align:center; margin-bottom:15px;">${capsule.title}</h3>`;
        if (capsule.message) html += `<div style="background:var(--bg-input);border-radius:12px;padding:15px;line-height:1.8;">${capsule.message}</div>`;
        if (capsule.images && capsule.images.length) {
            html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:15px;">';
            capsule.images.forEach(img => { html += `<img src="${img}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">`; });
            html += '</div>';
        }
        if (capsule.audio) html += `<audio controls src="${capsule.audio}" style="width:100%;margin-top:15px;"></audio>`;
        if (typeof openModal === 'function') {
            openModal('📦 كبسولة الزمن', html, '<button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>');
        }
    }
};


/* ============================================================
   31. زر المزامنة اليدوي — يعمل فعلاً
   ============================================================ */
window.manualSyncAll = async function () {
    if (!window.supabaseAvailable) {
        if (typeof showToast === 'function') showToast('Supabase غير متاح', 'error');
        return;
    }
    if (!window.modernCurrentPartner) {
        if (typeof showToast === 'function') showToast('يرجى تسجيل الدخول أولاً', 'error');
        return;
    }

    if (typeof showToast === 'function') showToast('جاري المزامنة...', 'info');

    const p = window.modernCurrentPartner;
    const toSync = [
        [STORAGE.EVENTS,          typeof getEvents   === 'function' ? getEvents()   : []],
        [STORAGE.ARCHIVE,         typeof getArchive  === 'function' ? getArchive()  : []],
        [STORAGE.MESSAGES,        typeof getSavedMessages === 'function' ? getSavedMessages() : []],
        [STORAGE.GIFTS,           typeof getSavedGifts   === 'function' ? getSavedGifts()    : []],
        [STORAGE.SETTINGS,        typeof getSettings     === 'function' ? getSettings()       : {}],
        [STORAGE.TIME_CAPSULES,   window.getCapsules()],
        [STORAGE.DIARY_ENTRIES,   window.getDiaryEntries()],
        [`romantic_gamification_v4_p${p}`, window.getGamificationData()],
        [`romantic_games_v4_p${p}`,        window.getGamesData()],
        [`romantic_games_history_v4_p${p}`,window.getGamesHistory()],
        [`romantic_questions_answers_v4_p${p}`, window.getQuestionsAnswers()],
        [`romantic_custom_questions_v4_p${p}`,  window.getCustomQuestions()],
    ];

    let count = 0;
    for (const [key, data] of toSync) {
        if (!key) continue;
        try {
            const { error } = await supabaseClient.from(key).upsert({
                partner_id: p,
                data: data,
                updated_at: new Date().toISOString()
            }, { onConflict: 'partner_id' });
            if (!error) count++;
        } catch {}
    }

    if (typeof showToast === 'function') showToast(`✅ تمت المزامنة (${count} جدول)`, 'success');
};


/* ============================================================
   32. نظام اقتباس يومي تلقائي
   ============================================================ */
(function initDailyQuote() {
    const today = new Date().toISOString().split('T')[0];
    const saved = _getJSON('daily_quote_date', null);

    if (saved !== today) {
        _setJSON('daily_quote_date', today);
        // سيظهر الاقتباس عند استدعاء renderDashboard
    }
})();


/* ============================================================
   33. تحسين updateGamificationUI لعرض بيانات صحيحة
   ============================================================ */
window.updateGamificationUI = function () {
    const gam = window.getGamificationData();

    const LEVELS = [
        { level: 1, name: 'بدايات',        min: 0 },
        { level: 2, name: 'حبايب',          min: 500 },
        { level: 3, name: 'عشاق',           min: 1500 },
        { level: 4, name: 'أصدقاء العمر',   min: 3000 },
        { level: 5, name: 'توأم روح',       min: 5000 },
        { level: 6, name: 'قصة خالدة',      min: 10000 },
    ];

    const current = LEVELS.find(l => l.level === gam.level) || LEVELS[0];
    const next    = LEVELS.find(l => l.level === gam.level + 1);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('gamificationPoints', gam.points || 0);
    set('gamificationLevel',  gam.level  || 1);
    set('currentLevelName',   current.name);
    set('loginStreak',        gam.loginStreak || 0);

    const challenges = Array.isArray(gam.dailyChallenges) ? gam.dailyChallenges : [];
    const done = challenges.filter(c => c.completed).length;
    set('dailyChallengesCount', `${done}/${challenges.length}`);

    if (next) {
        const toNext = next.min - (gam.points || 0);
        set('nextLevelPoints', `${Math.max(0, toNext)} نقطة للمستوى التالي`);
        const pct = Math.min(100, Math.max(0, (((gam.points || 0) - current.min) / (next.min - current.min)) * 100));
        const bar = document.getElementById('levelProgress');
        if (bar) bar.style.width = pct + '%';
    } else {
        set('nextLevelPoints', 'وصلت للمستوى الأقصى 🏆');
        const bar = document.getElementById('levelProgress');
        if (bar) bar.style.width = '100%';
    }

    // لوحة المتصدرين
    window.renderLeaderboard();
};


/* ============================================================
   34. تصحيح renderDailyChallenges
   ============================================================ */
window.renderDailyChallenges = function () {
    const gam = window.getGamificationData();
    const container = document.getElementById('dailyChallenges');
    if (!container) return;

    const challenges = Array.isArray(gam.dailyChallenges) ? gam.dailyChallenges : [];
    if (challenges.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p class="text-muted">لا توجد تحديات اليوم</p></div>';
        return;
    }

    container.innerHTML = challenges.map(ch => `
        <div style="background:var(--gradient-card);border:var(--border);border-radius:14px;padding:18px;${ch.completed ? 'opacity:0.7;' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-size:2rem;">${ch.icon || '🎯'}</span>
                ${ch.completed
                    ? '<span style="color:#4caf50;"><i class="fas fa-check-circle"></i> مكتمل</span>'
                    : `<span style="color:var(--gold);">+${ch.points || 20} نقطة</span>`}
            </div>
            <h4 style="font-size:1rem;margin-bottom:5px;">${ch.title}</h4>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:${ch.completed ? '0' : '15px'};">${ch.description}</p>
            ${!ch.completed ? `<button class="btn btn-primary btn-sm" onclick="completeChallenge('${ch.id}')" style="width:100%;"><i class="fas fa-check"></i> أكملت التحدي</button>` : ''}
        </div>
    `).join('');
};


/* ============================================================
   35. تحسين renderGames بشكل دفاعي
   ============================================================ */
window.updateGamesStats = function () {
    const data = window.getGamesData();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('gamesPlayed', data.totalGames || 0);

    const kp = data.scores?.know_your_partner || { correct: 0, total: 0 };
    const rate = kp.total > 0 ? Math.round((kp.correct / kp.total) * 100) : 0;
    set('gamesWinRate', rate + '%');

    let fav = '🎮';
    let max = 0;
    const names = { know_your_partner: '❓', who_is_more: '⚖️', back_to_first: '🕰️', build_home: '🏠' };
    Object.entries(data.gamesPlayed || {}).forEach(([g, n]) => { if (n > max) { max = n; fav = names[g] || '🎮'; } });
    set('gamesFavorite', fav);

    const badge = document.getElementById('badgeGames');
    if (badge) badge.textContent = data.totalGames || 0;
};


/* ============================================================
   36. تحسين updateQuestionsStats
   ============================================================ */
window.updateQuestionsStats = function () {
    const answers = window.getQuestionsAnswers();
    const custom  = window.getCustomQuestions();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalQuestionsAnswered', answers.length);
    set('totalQuestionsSaved',    answers.length);
    set('totalCustomQuestions',   custom.length);

    const badge = document.getElementById('badgeQuestions');
    if (badge) badge.textContent = answers.length > 0 ? '💬' : '✨';
};


/* ============================================================
   37. إضافة notification permission آمن
   ============================================================ */
window.requestNotificationPermission = async function () {
    if (!('Notification' in window)) {
        if (typeof showToast === 'function') showToast('المتصفح لا يدعم الإشعارات', 'error');
        return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
        if (typeof showToast === 'function') showToast('تم تفعيل الإشعارات ✅', 'success');
        new Notification('💕 ذكرياتنا', { body: 'تم تفعيل الإشعارات بنجاح!' });
    } else {
        if (typeof showToast === 'function') showToast('تم رفض الإشعارات', 'error');
    }
};

window.sendBrowserNotification = function (title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '💕' });
    }
};


/* ============================================================
   38. حماية ضد XSS في escapeHTML
   ============================================================ */
if (typeof window.escapeHTML !== 'function') {
    window.escapeHTML = function (str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };
}


/* ============================================================
   39. STORAGE.GAMIFICATION alias — للتوافق مع الكود القديم
   ============================================================ */
Object.defineProperty(window, '_gamificationKey', {
    get: () => _partnerKey('romantic_gamification_v4'),
    configurable: true
});


/* ============================================================
   40. تقرير تشخيصي في Console
   ============================================================ */
console.log([
    '╔══════════════════════════════╗',
    '║  fixes.js loaded ✅          ║',
    '║  ذكرياتنا — نسخة مُصلَّحة    ║',
    '╚══════════════════════════════╝',
].join('\n'));
