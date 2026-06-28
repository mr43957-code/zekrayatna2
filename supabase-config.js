// ============================================
// SUPABASE CONFIGURATION - مع تهيئة محسنة
// ============================================

// تهيئة Supabase
const SUPABASE_URL = 'https://uifnadcxnhyjzefjuvsq.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZm5hZGN4bmh5anplZmp1dnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Mjk2MzQsImV4cCI6MjA4NzIwNTYzNH0.C9rSd2XJJRD9e41gB-iRdUrmCXSmoZXXIT8hiICd5I0'; 

// إنشاء عميل Supabase
let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseAvailable = true;
        console.log('✅ Supabase initialized successfully');
    } else {
        console.warn('⚠️ Supabase library not loaded');
        window.supabaseAvailable = false;
    }
} catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    window.supabaseAvailable = false;
}

// متغيرات عامة للتتبع
window.isSyncing = false;
window.pendingSyncs = new Map();
window.syncQueue = [];
// التحقق من توفر Supabase
(function checkSupabase() {
    if (typeof supabase !== 'undefined' && supabaseClient) {
        window.supabaseAvailable = true;
        console.log('✅ Supabase initialized successfully');
    } else {
        console.warn('⚠️ Supabase not available');
    }
})();

// ============================================
// دوال المصادقة (Authentication)
// ============================================

/**
 * تسجيل الدخول
 */
async function supabaseLogin(partnerNumber, password) {
    try {
        const email = `partner${partnerNumber}@dhakryatna.com`;
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // حفظ بيانات الجلسة
        localStorage.setItem('supabase_session', JSON.stringify(data.session));
        localStorage.setItem('modern_partner', partnerNumber);
        localStorage.setItem('supabase_user_id', data.user.id);
        
        window.modernCurrentPartner = partnerNumber;
        
        // بدء معالجة المهام المؤجلة
        processSyncQueue();
        
        return { success: true, data };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * تسجيل الخروج
 */
async function supabaseLogout() {
    try {
        // مزامنة البيانات قبل الخروج
        await supabaseSyncAll();
        
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        // مسح البيانات المحلية
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('modern_partner');
        localStorage.removeItem('supabase_user_id');
        window.modernCurrentPartner = null;
        
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * التحقق من حالة تسجيل الدخول
 */
async function supabaseCheckSession() {
    try {
        const savedSession = localStorage.getItem('supabase_session');
        if (!savedSession) return { success: false };
        
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        
        if (data.session) {
            const partnerNumber = localStorage.getItem('modern_partner');
            window.modernCurrentPartner = parseInt(partnerNumber) || null;
            return { success: true, session: data.session };
        }
        
        return { success: false };
    } catch (error) {
        console.error('Session check error:', error);
        return { success: false };
    }
}

/**
 * حفظ البيانات في Supabase مع إعادة المحاولة
 * @param {string} table - اسم الجدول (يجب أن يكون non-empty string)
 * @param {any} data - البيانات المراد حفظها
 * @param {number} retryCount - عدد مرات إعادة المحاولة
 */
async function supabaseSaveData(table, data, retryCount = 0) {
    // التحقق من صحة اسم الجدول
    if (!table || typeof table !== 'string' || table.trim() === '') {
        console.error('❌ Invalid table name:', table);
        addToSyncQueue('unknown_table', data);
        return { success: false, error: 'Invalid table name', queued: true };
    }
    
    // إذا كان التطبيق غير متصل أو Supabase غير متاح، أضف للمهام المؤجلة
    if (!window.supabaseAvailable || !navigator.onLine) {
        addToSyncQueue(table, data);
        return { success: true, queued: true };
    }
    
    // التحقق من وجود عميل Supabase
    if (!supabaseClient) {
        console.error('❌ supabaseClient not initialized');
        addToSyncQueue(table, data);
        return { success: false, error: 'Client not initialized', queued: true };
    }
    
    try {
        const partnerNumber = window.modernCurrentPartner || localStorage.getItem('modern_partner');
        if (!partnerNumber) {
            console.warn('⚠️ No active session');
            addToSyncQueue(table, data);
            return { success: true, queued: true };
        }

        // منع التكرار
        if (window.isSyncing) {
            addToSyncQueue(table, data);
            return { success: true, queued: true };
        }

        window.isSyncing = true;

        console.log(`📥 Saving to Supabase: ${table} for partner ${partnerNumber}`);

        const { error } = await supabaseClient
            .from(table)
            .upsert({
                partner_id: partnerNumber,
                data: data,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'partner_id',
                ignoreDuplicates: false 
            });

        if (error) throw error;
        
        // إزالة من المهام المؤجلة إذا كانت موجودة
        removeFromSyncQueue(table);
        
        window.isSyncing = false;
        console.log(`✅ Successfully saved to ${table}`);
        return { success: true };
        
    } catch (error) {
        window.isSyncing = false;
        console.error(`❌ Save error for ${table}:`, error);
        
        // إعادة المحاولة حتى 3 مرات
        if (retryCount < 3) {
            console.log(`🔄 Retrying save for ${table} (attempt ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return supabaseSaveData(table, data, retryCount + 1);
        }
        
        // إذا فشلت كل المحاولات، أضف للمهام المؤجلة
        addToSyncQueue(table, data);
        return { success: false, error: error.message, queued: true };
    }
}


// ============================================
// تحميل البيانات من Supabase - نسخة آمنة جداً
// ============================================
async function supabaseLoadData(table) {
    // 🔥 التحقق الصارم من اسم الجدول
    if (!table) {
        console.error('❌ Table name is undefined or null');
        return { success: false, error: 'Table name is undefined' };
    }
    
    if (typeof table !== 'string') {
        console.error('❌ Table name is not a string:', typeof table, table);
        return { success: false, error: 'Table name is not a string' };
    }
    
    if (table.trim() === '') {
        console.error('❌ Table name is empty string');
        return { success: false, error: 'Table name is empty' };
    }
    
    if (!window.supabaseAvailable) {
        console.warn('⚠️ Supabase not available');
        return { success: false, error: 'Supabase not available' };
    }
    
    if (!supabaseClient) {
        console.error('❌ supabaseClient not initialized');
        return { success: false, error: 'Client not initialized' };
    }
    
    try {
        const partnerNumber = window.modernCurrentPartner || localStorage.getItem('modern_partner');
        
        if (!partnerNumber) {
            console.warn('⚠️ No partner number available');
            return { success: false, error: 'No partner number' };
        }

        console.log(`📤 Loading from Supabase: ${table} for partner ${partnerNumber}`);

        // 🔥 استخدام .maybeSingle() بدلاً من .single() لتجنب 406
        const { data, error } = await supabaseClient
            .from(table)
            .select('data, updated_at')
            .eq('partner_id', partnerNumber)
            .maybeSingle(); // <-- المفتاح السحري!

        if (error) {
            console.error(`❌ Supabase error for ${table}:`, error);
            return { success: false, error: error.message };
        }

        if (data) {
            console.log(`✅ Successfully loaded from ${table}`);
            return { 
                success: true, 
                data: data.data, 
                updatedAt: data.updated_at 
            };
        } else {
            console.log(`ℹ️ No data found for ${table}`);
            return { success: true, data: null };
        }
        
    } catch (error) {
        console.error(`❌ Load error for ${table}:`, error);
        return { success: false, error: error.message };
    }
}


// ============================================
// نظام المهام المؤجلة (Offline Support)
// ============================================

/**
 * إضافة مهمة للمزامنة المؤجلة
 */
function addToSyncQueue(table, data) {
    const key = `${table}_${Date.now()}`;
    window.syncQueue.push({
        id: key,
        table: table,
        data: data,
        timestamp: Date.now()
    });
    
    // حفظ المهام المؤجلة في localStorage
    localStorage.setItem('sync_queue', JSON.stringify(window.syncQueue));
    
    console.log(`📦 Added to sync queue: ${table}`);
}

/**
 * إزالة مهمة من المهام المؤجلة
 */
function removeFromSyncQueue(table) {
    window.syncQueue = window.syncQueue.filter(item => item.table !== table);
    localStorage.setItem('sync_queue', JSON.stringify(window.syncQueue));
}

/**
 * معالجة المهام المؤجلة
 */
async function processSyncQueue() {
    if (!window.supabaseAvailable || !navigator.onLine || window.syncQueue.length === 0) {
        return;
    }
    
    console.log(`🔄 Processing sync queue (${window.syncQueue.length} items)`);
    
    const queue = [...window.syncQueue];
    window.syncQueue = [];
    
    for (const item of queue) {
        await supabaseSaveData(item.table, item.data);
    }
    
    localStorage.setItem('sync_queue', JSON.stringify(window.syncQueue));
}

// ============================================
// مزامنة جميع البيانات
// ============================================

/**
 * مزامنة جميع البيانات مع Supabase
 */
async function supabaseSyncAll() {
    if (!window.supabaseAvailable || !navigator.onLine) {
        console.log('⚠️ Cannot sync: offline or Supabase unavailable');
        return { success: false, offline: true };
    }
    
    try {
        const tables = [
            STORAGE.EVENTS,
            STORAGE.ARCHIVE,
            STORAGE.MESSAGES,
            STORAGE.GIFTS,
            STORAGE.SETTINGS,
            STORAGE.TIME_CAPSULES,
            STORAGE.DIARY_ENTRIES,
            STORAGE.GAMIFICATION,
            STORAGE.GAMES_DATA,
            STORAGE.GAMES_HISTORY,
            STORAGE.QUESTIONS_ANSWERS,
            STORAGE.CUSTOM_QUESTIONS
        ];

        console.log('🔄 Syncing all data with Supabase...');
        
        for (const table of tables) {
            try {
                const localData = localStorage.getItem(table);
                if (localData) {
                    await supabaseSaveData(table, JSON.parse(localData));
                }
            } catch (e) {
                console.warn(`Error syncing ${table}:`, e);
            }
        }
        
        // معالجة المهام المؤجلة
        await processSyncQueue();
        
        console.log('✅ Sync completed');
        return { success: true };
    } catch (error) {
        console.error('Sync error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// تحميل جميع البيانات من Supabase - نسخة نهائية ومضمونة
// ============================================
async function supabaseLoadAllData() {
    console.log('🔄 Loading all data from Supabase...');
    
    // التحقق من وجود Supabase
    if (!window.supabaseAvailable) {
        console.warn('⚠️ Supabase not available, using local data only');
        return { success: false, error: 'Supabase not available' };
    }
    
    // التحقق من وجود شريك حالي
    if (!modernCurrentPartner) {
        console.warn('⚠️ No current partner, cannot load from Supabase');
        return { success: false, error: 'No current partner' };
    }

    console.log(`👤 Current partner: ${modernCurrentPartner}`);
    
    try {
        // 🔥 قائمة الجداول الأساسية - ثابتة ومعروفة
        const tables = [
            { key: 'romantic_events_v3', default: [] },
            { key: 'romantic_archive_v3', default: [] },
            { key: 'romantic_saved_messages', default: [] },
            { key: 'romantic_saved_gifts', default: [] },
            { key: 'romantic_settings_v3', default: defaultSettings() },
            { key: 'romantic_time_capsules_v4', default: [] },
            { key: 'romantic_diary_v4', default: [] },
            
            // جداول حسب الشريك - بأسماء ثابتة
            { key: modernCurrentPartner === 1 ? 'romantic_gamification_v4_p1' : 'romantic_gamification_v4_p2', default: defaultGamificationData() },
            { key: modernCurrentPartner === 1 ? 'romantic_questions_answers_v4_p1' : 'romantic_questions_answers_v4_p2', default: [] },
            { key: modernCurrentPartner === 1 ? 'romantic_games_v4_p1' : 'romantic_games_v4_p2', default: defaultGamesData() },
            { key: modernCurrentPartner === 1 ? 'romantic_games_history_v4_p1' : 'romantic_games_history_v4_p2', default: [] },
            { key: modernCurrentPartner === 1 ? 'romantic_custom_questions_v4_p1' : 'romantic_custom_questions_v4_p2', default: [] }
        ];

        console.log(`📋 Will load ${tables.length} tables`);

        let successCount = 0;
        let errorCount = 0;

        // تحميل كل جدول
        for (const table of tables) {
            try {
                // 🔥 التحقق النهائي من صحة المفتاح
                if (!table.key) {
                    console.warn('⚠️ Skipping table with null key');
                    errorCount++;
                    continue;
                }
                
                console.log(`📥 Loading ${table.key}...`);
                
                const result = await supabaseLoadData(table.key);
                
                if (result.success && result.data !== null) {
                    localStorage.setItem(table.key, JSON.stringify(result.data));
                    successCount++;
                    console.log(`✅ Loaded ${table.key}`);
                } else {
                    console.log(`📦 Using default for ${table.key}`);
                    localStorage.setItem(table.key, JSON.stringify(table.default));
                }
            } catch (error) {
                console.error(`❌ Error loading ${table.key}:`, error);
                errorCount++;
                if (table.key) {
                    localStorage.setItem(table.key, JSON.stringify(table.default));
                }
            }
        }

        console.log(`✅ Supabase load completed: ${successCount} success, ${errorCount} errors`);
        return { success: true, successCount, errorCount };
        
    } catch (error) {
        console.error('❌ Fatal error in supabaseLoadAllData:', error);
        return { success: false, error: error.message };
    }
}




// ============================================
// الاستماع للتغيرات في الاتصال
// ============================================

// عند استعادة الاتصال، قم بمزامنة المهام المؤجلة
window.addEventListener('online', function() {
    console.log('📶 Connection restored, processing sync queue...');
    processSyncQueue();
});

// حفظ المهام المؤجلة قبل إغلاق التطبيق
window.addEventListener('beforeunload', function() {
    if (window.syncQueue.length > 0) {
        localStorage.setItem('sync_queue', JSON.stringify(window.syncQueue));
    }
});

// استعادة المهام المؤجلة عند تحميل الصفحة
(function loadSyncQueue() {
    try {
        const savedQueue = localStorage.getItem('sync_queue');
        if (savedQueue) {
            window.syncQueue = JSON.parse(savedQueue) || [];
        }
    } catch (e) {
        window.syncQueue = [];
    }
})();

// ============================================
// دوال الإعدادات (Settings)
// ============================================

async function supabaseSaveSettings(settings) {
    return supabaseSaveData(STORAGE.SETTINGS, settings);
}

async function supabaseLoadSettings() {
    const result = await supabaseLoadData(STORAGE.SETTINGS);
    if (result.success && result.data) {
        localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(result.data));
        return result.data;
    }
    return defaultSettings();
}

// دالة الإعدادات الافتراضية (إذا لم تكن معرفة)
function defaultSettings() {
    return {
        hearts: true, 
        quotes: true, 
        internalNotify: true,
        panic: true,
        reducedMotion: false, 
        autoArchive: false,
        defaultReminder: 7, 
        theme: 'romantic-dark',
        relationshipStart: '', 
        partnerName: ''
    };
}

function defaultGamificationData() {
    return {
        points: 0,
        level: 1,
        achievements: [],
        completedChallenges: [],
        loginStreak: 0,
        lastLoginDate: null,
        dailyChallenges: [],
        challengesCompletedToday: 0,
        unlockedRewards: ['romantic-dark']
    };
}

function defaultGamesData() {
    return {
        totalGames: 0,
        gamesPlayed: {
            know_your_partner: 0,
            who_is_more: 0,
            back_to_first: 0,
            build_home: 0
        },
        scores: {
            know_your_partner: { correct: 0, total: 0 },
            who_is_more: { correct: 0, total: 0 },
            back_to_first: { correct: 0, total: 0 },
            build_home: { matches: 0, total: 0 }
        },
        lastPlayed: null
    };
}


// ============================================
// دوال مساعدة للتحقق من الجداول
// ============================================

/**
 * اختبار اتصال بجدول معين
 * @param {string} table - اسم الجدول
 */
async function testTableConnection(table) {
    console.log(`🔍 Testing connection to ${table}...`);
    
    try {
        const { data, error } = await supabaseClient
            .from(table)
            .select('*')
            .limit(1);
            
        if (error) {
            console.error(`❌ Table ${table} error:`, error);
            return false;
        }
        
        console.log(`✅ Table ${table} is accessible`);
        return true;
    } catch (error) {
        console.error(`❌ Table ${table} connection failed:`, error);
        return false;
    }
}

/**
 * اختبار جميع الجداول
 */
window.testAllTables = async function() {
    console.log('🔍 Testing all tables...');
    
    const tables = [
        STORAGE.EVENTS,
        STORAGE.ARCHIVE,
        STORAGE.MESSAGES,
        STORAGE.GIFTS,
        STORAGE.SETTINGS,
        STORAGE.TIME_CAPSULES,
        STORAGE.DIARY_ENTRIES,
        STORAGE.GAMIFICATION_P1,
        STORAGE.GAMIFICATION_P2,
        STORAGE.QUESTIONS_ANSWERS_P1,
        STORAGE.QUESTIONS_ANSWERS_P2,
        STORAGE.CUSTOM_QUESTIONS_P1,
        STORAGE.CUSTOM_QUESTIONS_P2,
        STORAGE.GAMES_DATA_P1,
        STORAGE.GAMES_DATA_P2,
        STORAGE.GAMES_HISTORY_P1,
        STORAGE.GAMES_HISTORY_P2
    ];
    
    const results = [];
    
    for (const table of tables) {
        if (!table) {
            console.warn('⚠️ Skipping undefined table');
            continue;
        }
        
        const ok = await testTableConnection(table);
        results.push({ table, ok });
    }
    
    console.log('\n📊 Test Results:');
    results.forEach(r => {
        console.log(`  ${r.ok ? '✅' : '❌'} ${r.table}`);
    });
    
    return results;
};




// ============================================
// دوال تصحيح Supabase
// ============================================

/**
 * اختبار شامل لجميع الجداول
 */
window.debugSupabaseTables = async function() {
    console.log('🔍 Starting Supabase diagnostic...');
    
    // 1. التحقق من المتغيرات العامة
    console.log('📊 Environment:');
    console.log('  supabaseAvailable:', window.supabaseAvailable);
    console.log('  modernCurrentPartner:', window.modernCurrentPartner);
    console.log('  supabaseClient:', supabaseClient ? '✅' : '❌');
    
    if (!supabaseClient) {
        console.error('❌ supabaseClient is not defined');
        return;
    }
    
    // 2. التحقق من STORAGE (يجب تمريره من app.js)
    if (typeof STORAGE === 'undefined') {
        console.warn('⚠️ STORAGE is not defined in this scope');
    } else {
        console.log('📋 STORAGE keys:', Object.keys(STORAGE));
    }
    
    // 3. اختبار اتصال بسيط
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        console.log('  Auth session:', error ? '❌' : '✅');
    } catch (e) {
        console.error('  Auth error:', e);
    }
    
    // 4. اختبار جدول معروف
    const testTable = 'romantic_events_v3';
    try {
        const { data, error } = await supabaseClient
            .from(testTable)
            .select('*')
            .limit(1);
        
        console.log(`  Table ${testTable}:`, error ? '❌' : '✅');
        if (error) console.error('    Error:', error);
    } catch (e) {
        console.error(`  Error testing ${testTable}:`, e);
    }
};

/**
 * اختبار تحميل جدول معين
 */
window.testLoadTable = async function(tableName) {
    console.log(`🧪 Testing load for table: ${tableName}`);
    
    if (!tableName) {
        console.error('❌ Please provide a table name');
        return;
    }
    
    const result = await supabaseLoadData(tableName);
    console.log('Result:', result);
    return result;
};
