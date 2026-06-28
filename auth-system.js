// ============================================================
// auth-system.js — نظام تسجيل المستخدمين الكامل
// ذكرياتنا V3.0 — Sign Up / Sign In / Partner Linking
// ============================================================

'use strict';

/* ============================================================
   CONFIG
   ============================================================ */
const AUTH = {
    STORAGE_SESSION:  'auth_session_v3',
    STORAGE_PROFILE:  'auth_profile_v3',
    STORAGE_COUPLE:   'auth_couple_v3',
    COUPLE_TABLE:     'couples',
    PROFILES_TABLE:   'profiles',
};

/* ============================================================
   STATE
   ============================================================ */
window.currentUser    = null;   // Supabase user object
window.currentProfile = null;   // our custom profile
window.currentCouple  = null;   // couple record
window.partnerProfile = null;   // the other person

/* ============================================================
   INIT — يُستدعى بدلاً من modernInitLogin
   ============================================================ */
window.authInit = async function () {
    _showLoader('جاري التحقق من حسابك...');

    try {
        const { data } = await supabaseClient.auth.getSession();

        if (data?.session?.user) {
            window.currentUser = data.session.user;
            const ok = await _loadProfile(data.session.user.id);
            if (ok) {
                await _loadCouple();
                _hideLoginScreen();
                _afterLogin();
                return;
            }
        }
    } catch (e) {
        console.warn('authInit error:', e);
    }

    // لا يوجد جلسة — أظهر شاشة الدخول الجديدة
    _showAuthScreen('login');
};

/* ============================================================
   SIGN UP
   ============================================================ */
window.authSignUp = async function () {
    const name     = _val('authSignUpName');
    const email    = _val('authSignUpEmail');
    const password = _val('authSignUpPassword');
    const confirm  = _val('authSignUpConfirm');

    if (!name || !email || !password) return _authError('يرجى ملء جميع الحقول');
    if (password !== confirm)          return _authError('كلمات المرور غير متطابقة');
    if (password.length < 6)           return _authError('كلمة المرور 6 أحرف على الأقل');
    if (!email.includes('@'))          return _authError('البريد الإلكتروني غير صحيح');

    _authLoading(true);
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email, password,
            options: { data: { display_name: name } }
        });
        if (error) throw error;

        // أنشئ ملف شخصي
        const inviteCode = _generateCode();
        const profile = {
            id:          data.user.id,
            email,
            name,
            invite_code: inviteCode,
            couple_id:   null,
            avatar:      '👤',
            created_at:  new Date().toISOString(),
        };

        const { error: profErr } = await supabaseClient
            .from(AUTH.PROFILES_TABLE)
            .insert(profile);

        if (profErr) throw profErr;

        window.currentUser    = data.user;
        window.currentProfile = profile;
        localStorage.setItem(AUTH.STORAGE_PROFILE, JSON.stringify(profile));

        // إذا كان يحتاج توثيق بريد
        if (!data.session) {
            _authLoading(false);
            _showAuthMessage('✅ تم إنشاء حسابك! تحقق من بريدك الإلكتروني لتأكيده ثم ادخل.');
            _showAuthScreen('login');
            return;
        }

        await _loadCouple();
        _hideLoginScreen();
        _afterLogin();

    } catch (e) {
        _authLoading(false);
        _authError(_translateError(e.message));
    }
};

/* ============================================================
   SIGN IN
   ============================================================ */
window.authSignIn = async function () {
    const email    = _val('authLoginEmail');
    const password = _val('authLoginPassword');

    if (!email || !password) return _authError('يرجى إدخال البريد وكلمة المرور');

    _authLoading(true);
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        window.currentUser = data.user;
        const ok = await _loadProfile(data.user.id);
        if (!ok) {
            // المستخدم موجود لكن ليس له profile — أنشئه
            const inviteCode = _generateCode();
            const profile = {
                id:          data.user.id,
                email:       data.user.email,
                name:        data.user.user_metadata?.display_name || 'مستخدم',
                invite_code: inviteCode,
                couple_id:   null,
                avatar:      '👤',
                created_at:  new Date().toISOString(),
            };
            await supabaseClient.from(AUTH.PROFILES_TABLE).upsert(profile);
            window.currentProfile = profile;
            localStorage.setItem(AUTH.STORAGE_PROFILE, JSON.stringify(profile));
        }

        await _loadCouple();
        _hideLoginScreen();
        _afterLogin();

    } catch (e) {
        _authLoading(false);
        _authError(_translateError(e.message));
    }
};

/* ============================================================
   RESET PASSWORD
   ============================================================ */
window.authResetPassword = async function () {
    const email = _val('authResetEmail');
    if (!email) return _authError('أدخل بريدك الإلكتروني');

    _authLoading(true);
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) throw error;
        _authLoading(false);
        _showAuthMessage('✅ تم إرسال رابط إعادة التعيين لبريدك الإلكتروني');
        setTimeout(() => _showAuthScreen('login'), 3000);
    } catch (e) {
        _authLoading(false);
        _authError(_translateError(e.message));
    }
};

/* ============================================================
   SIGN OUT
   ============================================================ */
window.authSignOut = async function () {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;

    // مزامنة قبل الخروج
    if (typeof window.manualSyncAll === 'function') {
        try { await window.manualSyncAll(); } catch {}
    }

    await supabaseClient.auth.signOut();
    window.currentUser    = null;
    window.currentProfile = null;
    window.currentCouple  = null;
    window.partnerProfile = null;
    window.modernCurrentPartner = null;

    localStorage.removeItem(AUTH.STORAGE_SESSION);
    localStorage.removeItem(AUTH.STORAGE_PROFILE);
    localStorage.removeItem(AUTH.STORAGE_COUPLE);
    localStorage.removeItem('modern_partner');

    _showAuthScreen('login');
    document.getElementById('modernLoginScreen')?.classList.remove('hidden');
};

/* ============================================================
   PARTNER LINKING — إرسال دعوة
   ============================================================ */
window.authSendInvite = async function () {
    if (!window.currentProfile) return _authError('سجل الدخول أولاً');

    const code = window.currentProfile.invite_code;
    const msg  = `💕 أنا في انتظارك على تطبيق ذكرياتنا!\nكود الربط: ${code}\nافتح التطبيق واستخدم زر "ربط بشريكي"`;

    if (navigator.share) {
        try { await navigator.share({ text: msg }); return; } catch {}
    }
    // نسخ للحافظة
    try {
        await navigator.clipboard.writeText(msg);
        _showCoupleStatus('✅ تم نسخ كود الدعوة! شاركه مع شريكك', 'success');
    } catch {
        _showCoupleStatus(`كود الربط: ${code}`, 'info');
    }
};

/* ============================================================
   PARTNER LINKING — قبول دعوة
   ============================================================ */
window.authLinkPartner = async function () {
    const code = _val('partnerInviteCode')?.trim().toUpperCase();
    if (!code) return _authError('أدخل كود الشريك');
    if (!window.currentProfile) return _authError('سجل الدخول أولاً');

    if (window.currentCouple) {
        return _showCoupleStatus('أنت مرتبط بالفعل بشريك! يجب فك الارتباط أولاً', 'error');
    }

    _setCoupleLoading(true);

    try {
        // ابحث عن المستخدم بالكود
        const { data: partnerData, error: findErr } = await supabaseClient
            .from(AUTH.PROFILES_TABLE)
            .select('*')
            .eq('invite_code', code)
            .maybeSingle();

        if (findErr) throw findErr;
        if (!partnerData) {
            _setCoupleLoading(false);
            return _showCoupleStatus('❌ الكود غير صحيح أو لا يوجد مستخدم بهذا الكود', 'error');
        }
        if (partnerData.id === window.currentProfile.id) {
            _setCoupleLoading(false);
            return _showCoupleStatus('❌ لا يمكنك الارتباط بنفسك!', 'error');
        }
        if (partnerData.couple_id) {
            _setCoupleLoading(false);
            return _showCoupleStatus('❌ هذا المستخدم مرتبط بشخص آخر', 'error');
        }

        // أنشئ couple
        const coupleId = _generateCoupleId();
        const couple = {
            id:         coupleId,
            partner1_id: window.currentProfile.id,
            partner2_id: partnerData.id,
            partner1_name: window.currentProfile.name,
            partner2_name: partnerData.name,
            relationship_start: null,
            created_at: new Date().toISOString(),
        };

        const { error: coupleErr } = await supabaseClient
            .from(AUTH.COUPLES_TABLE || 'couples')
            .insert(couple);
        if (coupleErr) throw coupleErr;

        // حدث كلا المستخدمين
        await supabaseClient.from(AUTH.PROFILES_TABLE).update({ couple_id: coupleId }).eq('id', window.currentProfile.id);
        await supabaseClient.from(AUTH.PROFILES_TABLE).update({ couple_id: coupleId }).eq('id', partnerData.id);

        window.currentCouple  = couple;
        window.partnerProfile = partnerData;
        window.currentProfile.couple_id = coupleId;
        window.modernCurrentPartner = 1;
        localStorage.setItem('modern_partner', '1');
        localStorage.setItem(AUTH.STORAGE_COUPLE, JSON.stringify(couple));

        _setCoupleLoading(false);
        _showCoupleStatus(`💕 تم الربط بنجاح مع ${partnerData.name}!`, 'success');
        _updatePartnerUI();

        setTimeout(() => {
            _renderCouplePanel();
            if (typeof window.showToast === 'function') {
                window.showToast(`💕 مرحباً! أنت الآن مرتبط بـ ${partnerData.name}`, 'success');
            }
        }, 1500);

    } catch (e) {
        _setCoupleLoading(false);
        _showCoupleStatus('❌ حدث خطأ: ' + _translateError(e.message), 'error');
    }
};

/* ============================================================
   UNLINK PARTNER
   ============================================================ */
window.authUnlinkPartner = async function () {
    if (!confirm('هل أنت متأكد من فك الارتباط مع شريكك؟ ستُحذف البيانات المشتركة.')) return;

    try {
        if (window.currentCouple) {
            await supabaseClient.from(AUTH.PROFILES_TABLE)
                .update({ couple_id: null })
                .in('id', [window.currentProfile.id, window.partnerProfile?.id].filter(Boolean));

            await supabaseClient.from('couples').delete().eq('id', window.currentCouple.id);
        }

        window.currentCouple  = null;
        window.partnerProfile = null;
        localStorage.removeItem(AUTH.STORAGE_COUPLE);

        _renderCouplePanel();
        if (typeof window.showToast === 'function') {
            window.showToast('تم فك الارتباط', 'info');
        }
    } catch (e) {
        _authError('حدث خطأ: ' + e.message);
    }
};

/* ============================================================
   UPDATE PROFILE
   ============================================================ */
window.authUpdateProfile = async function () {
    const name   = _val('profileName');
    const avatar = _val('profileAvatar') || window.currentProfile?.avatar || '👤';
    const relStart = _val('profileRelStart');

    if (!name) return _authError('أدخل اسمك');

    try {
        const updates = { name, avatar };
        if (relStart) updates.relationship_start = relStart;

        await supabaseClient.from(AUTH.PROFILES_TABLE).update(updates).eq('id', window.currentUser.id);

        window.currentProfile = { ...window.currentProfile, ...updates };
        localStorage.setItem(AUTH.STORAGE_PROFILE, JSON.stringify(window.currentProfile));

        // تحديث إعدادات التطبيق
        if (typeof getSettings === 'function' && typeof saveSettings === 'function') {
            const s = getSettings();
            s.partnerName = window.partnerProfile?.name || s.partnerName;
            if (relStart) s.relationshipStart = relStart;
            localStorage.setItem('romantic_settings_v3', JSON.stringify(s));
        }

        _updatePartnerUI();
        if (typeof window.showToast === 'function') {
            window.showToast('✅ تم تحديث الملف الشخصي', 'success');
        }

        // إغلاق المودال
        const modal = document.getElementById('profileModalOverlay');
        if (modal) modal.classList.remove('active');

    } catch (e) {
        _authError('حدث خطأ: ' + e.message);
    }
};

/* ============================================================
   INTERNAL HELPERS
   ============================================================ */
async function _loadProfile(userId) {
    // جرب من localStorage أولاً
    const cached = localStorage.getItem(AUTH.STORAGE_PROFILE);
    if (cached) {
        try {
            const p = JSON.parse(cached);
            if (p.id === userId) { window.currentProfile = p; return true; }
        } catch {}
    }

    try {
        const { data, error } = await supabaseClient
            .from(AUTH.PROFILES_TABLE)
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) return false;

        window.currentProfile = data;
        localStorage.setItem(AUTH.STORAGE_PROFILE, JSON.stringify(data));
        return true;
    } catch { return false; }
}

async function _loadCouple() {
    if (!window.currentProfile?.couple_id) return;

    try {
        const { data } = await supabaseClient
            .from('couples')
            .select('*')
            .eq('id', window.currentProfile.couple_id)
            .maybeSingle();

        if (!data) return;
        window.currentCouple = data;
        localStorage.setItem(AUTH.STORAGE_COUPLE, JSON.stringify(data));

        // تحميل بيانات الشريك
        const partnerId = data.partner1_id === window.currentProfile.id
            ? data.partner2_id : data.partner1_id;

        const { data: partnerData } = await supabaseClient
            .from(AUTH.PROFILES_TABLE)
            .select('*')
            .eq('id', partnerId)
            .maybeSingle();

        if (partnerData) {
            window.partnerProfile = partnerData;
            // تحديد رقم الشريك
            window.modernCurrentPartner = data.partner1_id === window.currentProfile.id ? 1 : 2;
            localStorage.setItem('modern_partner', String(window.modernCurrentPartner));
        }

        // تحديث إعدادات التطبيق بتاريخ العلاقة
        if (data.relationship_start && typeof getSettings === 'function') {
            const s = getSettings();
            s.relationshipStart = data.relationship_start;
            s.partnerName = partnerData?.name || s.partnerName;
            localStorage.setItem('romantic_settings_v3', JSON.stringify(s));
        }

    } catch (e) { console.warn('_loadCouple error:', e); }
}

function _afterLogin() {
    // ضبط modernCurrentPartner للتوافق مع الكود القديم
    if (!window.modernCurrentPartner) window.modernCurrentPartner = 1;
    localStorage.setItem('modern_partner', String(window.modernCurrentPartner));

    // تحديث الهيدر
    _updatePartnerUI();
    _renderCouplePanel();

    // تحميل بيانات التطبيق
    setTimeout(async () => {
        if (typeof window.supabaseLoadAllData === 'function') {
            try { await window.supabaseLoadAllData(); } catch {}
        }
        if (typeof window.ensureGamificationData === 'function') window.ensureGamificationData();
        if (typeof window.refreshAll === 'function') window.refreshAll();
        if (typeof window.smartInternalNotify === 'function') window.smartInternalNotify();
    }, 600);
}

function _updatePartnerUI() {
    // تحديث زر اللوجو في الهيدر
    const badge = document.getElementById('authUserBadge');
    if (badge) badge.remove();

    const headerActions = document.querySelector('.header-actions');
    if (!headerActions || !window.currentProfile) return;

    const div = document.createElement('div');
    div.id = 'authUserBadge';
    div.style.cssText = `
        display:inline-flex; align-items:center; gap:8px;
        padding:6px 14px; border-radius:30px; cursor:pointer;
        background:rgba(233,30,99,0.15); border:1px solid rgba(233,30,99,0.3);
        color:var(--accent); font-weight:600; font-size:0.85rem;
    `;
    div.innerHTML = `
        <span>${window.currentProfile.avatar || '👤'}</span>
        <span>${window.currentProfile.name}</span>
        ${window.currentCouple
            ? `<span style="color:#4caf50; font-size:0.75rem;">💑 ${window.partnerProfile?.name || 'شريك'}</span>`
            : `<span style="color:var(--gold); font-size:0.75rem;">🔗 ربط شريك</span>`}
        <i class="fas fa-chevron-down" style="font-size:0.7rem;"></i>
    `;
    div.onclick = () => _toggleUserMenu();
    headerActions.appendChild(div);

    // قائمة المستخدم
    let menu = document.getElementById('authUserMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'authUserMenu';
        menu.style.cssText = `
            display:none; position:fixed; top:70px; left:20px;
            background:var(--bg-secondary); border:var(--border);
            border-radius:16px; padding:10px; z-index:5000;
            box-shadow:0 10px 30px rgba(0,0,0,0.4); min-width:220px;
            backdrop-filter:blur(20px);
        `;
        document.body.appendChild(menu);
    }

    menu.innerHTML = `
        <div style="padding:12px 10px; border-bottom:var(--border); margin-bottom:8px;">
            <div style="font-size:1rem; font-weight:700;">${window.currentProfile.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${window.currentProfile.email}</div>
            <div style="font-size:0.7rem; color:var(--gold); margin-top:4px;">
                كود الدعوة: <strong>${window.currentProfile.invite_code}</strong>
            </div>
        </div>
        <button onclick="_openProfileModal()" class="_menu-btn"><i class="fas fa-user-edit"></i> الملف الشخصي</button>
        ${!window.currentCouple
            ? `<button onclick="_openLinkModal()" class="_menu-btn" style="color:var(--gold)"><i class="fas fa-link"></i> ربط بشريكي</button>`
            : `<button onclick="authUnlinkPartner()" class="_menu-btn" style="color:#ef9a9a"><i class="fas fa-unlink"></i> فك الارتباط</button>`}
        <button onclick="authSendInvite()" class="_menu-btn"><i class="fas fa-share-alt"></i> مشاركة الكود</button>
        <button onclick="authSignOut()" class="_menu-btn" style="color:#ef9a9a; margin-top:8px; border-top:var(--border); padding-top:10px;"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>
    `;

    // أضف style للأزرار
    if (!document.getElementById('_menuBtnStyle')) {
        const st = document.createElement('style');
        st.id = '_menuBtnStyle';
        st.textContent = `
            ._menu-btn { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px;
                background:none; border:none; color:var(--text-primary); cursor:pointer;
                font-family:'Tajawal'; font-size:0.9rem; border-radius:10px; transition:background 0.2s; text-align:right; }
            ._menu-btn:hover { background:var(--bg-card-hover); }
        `;
        document.head.appendChild(st);
    }

    // إغلاق القائمة عند النقر خارجها
    setTimeout(() => {
        document.addEventListener('click', function closer(e) {
            if (!menu.contains(e.target) && !div.contains(e.target)) {
                menu.style.display = 'none';
                document.removeEventListener('click', closer);
            }
        });
    }, 100);
}

function _toggleUserMenu() {
    const menu = document.getElementById('authUserMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function _renderCouplePanel() {
    // إظهار/إخفاء بانر الربط في الإعدادات
    const panel = document.getElementById('coupleLinkPanel');
    if (!panel) return;

    if (window.currentCouple) {
        panel.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                <div style="text-align:center;">
                    <span style="font-size:2rem;">${window.currentProfile?.avatar || '👤'}</span>
                    <div style="font-size:0.85rem; font-weight:700;">${window.currentProfile?.name || 'أنت'}</div>
                    <div style="font-size:0.7rem; color:var(--gold);">شريك ${window.modernCurrentPartner}</div>
                </div>
                <div style="font-size:2rem; color:var(--rose);">💕</div>
                <div style="text-align:center;">
                    <span style="font-size:2rem;">${window.partnerProfile?.avatar || '👤'}</span>
                    <div style="font-size:0.85rem; font-weight:700;">${window.partnerProfile?.name || 'شريك'}</div>
                    <div style="font-size:0.7rem; color:var(--gold);">شريك ${window.modernCurrentPartner === 1 ? 2 : 1}</div>
                </div>
                <div style="margin-right:auto; display:flex; flex-direction:column; gap:8px;">
                    <button class="btn btn-secondary btn-sm" onclick="authUnlinkPartner()">
                        <i class="fas fa-unlink"></i> فك الارتباط
                    </button>
                </div>
            </div>
        `;
    } else {
        panel.innerHTML = `
            <div>
                <p style="color:var(--text-muted); margin-bottom:15px;">
                    <i class="fas fa-info-circle" style="color:var(--gold);"></i>
                    لم تربط حسابك بشريكك بعد
                </p>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" onclick="_openLinkModal()">
                        <i class="fas fa-link"></i> ربط بشريكي
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="authSendInvite()">
                        <i class="fas fa-share-alt"></i> أرسل دعوة
                    </button>
                </div>
                <div style="margin-top:12px; padding:10px; background:rgba(255,215,0,0.1); border-radius:10px; border:1px solid rgba(255,215,0,0.3);">
                    <p style="font-size:0.8rem; color:var(--gold);">كودك الخاص:</p>
                    <p style="font-size:1.2rem; font-weight:900; letter-spacing:3px;">${window.currentProfile?.invite_code || '----'}</p>
                    <button class="btn btn-secondary btn-sm" onclick="authSendInvite()" style="margin-top:8px;">
                        <i class="fas fa-copy"></i> نسخ وإرسال
                    </button>
                </div>
            </div>
        `;
    }
}

function _openLinkModal() {
    const menu = document.getElementById('authUserMenu');
    if (menu) menu.style.display = 'none';

    const overlay = document.getElementById('linkPartnerModalOverlay');
    if (overlay) {
        const inp = document.getElementById('partnerInviteCode');
        if (inp) inp.value = '';
        document.getElementById('coupleStatusMsg')?.remove();
        overlay.classList.add('active');
    }
}

function _openProfileModal() {
    const menu = document.getElementById('authUserMenu');
    if (menu) menu.style.display = 'none';

    const overlay = document.getElementById('profileModalOverlay');
    if (overlay) {
        const inp = document.getElementById('profileName');
        if (inp && window.currentProfile) inp.value = window.currentProfile.name;
        const avt = document.getElementById('profileAvatar');
        if (avt && window.currentProfile) avt.value = window.currentProfile.avatar;
        const rel = document.getElementById('profileRelStart');
        if (rel && window.currentCouple?.relationship_start) rel.value = window.currentCouple.relationship_start;
        overlay.classList.add('active');
    }
}

// اجعلها global
window._openLinkModal    = _openLinkModal;
window._openProfileModal = _openProfileModal;

function _showLoader(msg) {
    const loader = document.getElementById('modernLoader');
    const txt    = loader?.querySelector('.modern-loader-text');
    if (txt) txt.textContent = msg || 'جاري التحميل...';
    if (loader) { loader.style.display = 'flex'; loader.classList.remove('fade-out'); }
    document.getElementById('modernLoginScreen')?.classList.remove('hidden');
    document.getElementById('modernLoginContainer')?.classList.remove('visible');
}

function _hideLoginScreen() {
    const screen = document.getElementById('modernLoginScreen');
    if (screen) screen.classList.add('hidden');
}

function _showAuthScreen(tab) {
    const loader = document.getElementById('modernLoader');
    if (loader) { loader.classList.add('fade-out'); setTimeout(() => loader.style.display = 'none', 500); }

    const container = document.getElementById('modernLoginContainer');
    if (container) container.classList.add('visible');

    // التبديل بين تبويبات Auth
    authSwitchTab(tab || 'login');
}

function _showAuthMessage(msg) {
    const el = document.getElementById('authGlobalMessage');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _authError(msg) {
    const el = document.getElementById('authErrorMsg');
    if (el) {
        el.textContent = msg;
        el.style.display = 'flex';
        el.style.animation = 'none';
        setTimeout(() => el.style.animation = '', 10);
        setTimeout(() => el.style.display = 'none', 4000);
    }
    if (typeof window.showToast === 'function') window.showToast(msg, 'error');
}

function _authLoading(state) {
    const btn = document.getElementById('authSubmitBtn');
    if (!btn) return;
    btn.disabled = state;
    btn.innerHTML = state
        ? '<i class="fas fa-spinner fa-spin"></i> جاري...'
        : (btn.dataset.label || '<i class="fas fa-sign-in-alt"></i> دخول');
}

function _showCoupleStatus(msg, type) {
    const old = document.getElementById('coupleStatusMsg');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'coupleStatusMsg';
    el.style.cssText = `
        padding:12px 15px; border-radius:10px; margin-top:15px; font-size:0.9rem;
        background:${type === 'success' ? 'rgba(76,175,80,0.15)' : type === 'error' ? 'rgba(244,67,54,0.15)' : 'rgba(255,215,0,0.15)'};
        color:${type === 'success' ? '#4caf50' : type === 'error' ? '#ef9a9a' : 'var(--gold)'};
        border:1px solid ${type === 'success' ? 'rgba(76,175,80,0.3)' : type === 'error' ? 'rgba(244,67,54,0.3)' : 'rgba(255,215,0,0.3)'};
    `;
    el.textContent = msg;

    const container = document.getElementById('coupleStatusContainer');
    if (container) container.appendChild(el);
}

function _setCoupleLoading(state) {
    const btn = document.getElementById('linkPartnerBtn');
    if (!btn) return;
    btn.disabled = state;
    btn.innerHTML = state
        ? '<i class="fas fa-spinner fa-spin"></i> جاري البحث...'
        : '<i class="fas fa-link"></i> ربط الآن';
}

function _val(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function _generateCoupleId() {
    return 'couple_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function _translateError(msg) {
    const map = {
        'Invalid login credentials': 'البريد أو كلمة المرور غير صحيحة',
        'Email not confirmed': 'يرجى تأكيد بريدك الإلكتروني',
        'User already registered': 'هذا البريد مسجل بالفعل',
        'Password should be at least 6 characters': 'كلمة المرور 6 أحرف على الأقل',
        'rate limit': 'حاول مرة أخرى بعد قليل',
        'Email rate limit exceeded': 'حاول مرة أخرى بعد قليل',
    };
    for (const [k, v] of Object.entries(map)) {
        if (msg?.includes(k)) return v;
    }
    return msg || 'حدث خطأ غير متوقع';
}

/* ============================================================
   AUTH TABS SWITCH
   ============================================================ */
window.authSwitchTab = function (tab) {
    ['login', 'signup', 'reset'].forEach(t => {
        const el = document.getElementById(`authTab_${t}`);
        const btn = document.getElementById(`authTabBtn_${t}`);
        if (el)  el.style.display  = t === tab ? 'block' : 'none';
        if (btn) {
            btn.style.background = t === tab ? 'var(--gradient-accent)' : 'transparent';
            btn.style.color      = t === tab ? '#fff' : 'var(--text-muted)';
        }
    });

    const errEl = document.getElementById('authErrorMsg');
    if (errEl) errEl.style.display = 'none';

    // تعديل زر Submit
    const btn = document.getElementById('authSubmitBtn');
    if (!btn) return;
    const configs = {
        login:  { label: '<i class="fas fa-sign-in-alt"></i> دخول',   fn: 'authSignIn()' },
        signup: { label: '<i class="fas fa-user-plus"></i> إنشاء حساب', fn: 'authSignUp()' },
        reset:  { label: '<i class="fas fa-paper-plane"></i> إرسال',   fn: 'authResetPassword()' },
    };
    const cfg = configs[tab];
    btn.innerHTML       = cfg.label;
    btn.dataset.label   = cfg.label;
    btn.setAttribute('onclick', cfg.fn);
};

/* ============================================================
   BOOT — يستبدل modernInitLogin
   ============================================================ */
window.modernInitLogin = window.authInit;

// استدعاء تلقائي
document.addEventListener('DOMContentLoaded', () => {
    // أعطِ app.js وقتاً ليُعرِّف STORAGE والدوال
    setTimeout(window.authInit, 300);
}, { once: true });

console.log('✅ auth-system.js loaded');

/* ============================================================
   REALTIME — مزامنة فورية عند تغيير بيانات الشريك
   ============================================================ */
window._authStartRealtime = function () {
    if (!window.currentCouple || typeof supabaseClient?.channel !== 'function') return;
    supabaseClient.channel('couple-sync')
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'romantic_events_v3'
        }, () => {
            if (typeof window.supabaseLoadAllData === 'function') {
                window.supabaseLoadAllData().then(() => {
                    if (typeof window.refreshAll === 'function') window.refreshAll();
                });
            }
        })
        .subscribe();
    console.log('✅ Realtime subscribed');
};

/* FIX — تأكد من COUPLES_TABLE */
AUTH.COUPLES_TABLE = 'couples';
