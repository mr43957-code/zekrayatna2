/**
 * ذكرياتنا V3.0 - Authentication Module
 * Sign up, login, password reset, partner linking
 */

const Auth = {
    currentUser: null,
    currentPartner: null,
    isLoggedIn: false,

    // Initialize auth state
    async init() {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await this.setUser(session.user);
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.setUser(session.user);
                App.navigateTo('home');
            } else if (event === 'SIGNED_OUT') {
                this.logout();
            }
        });
    },

    // Set current user and load profile
    async setUser(authUser) {
        if (!authUser) return;

        // Load profile from Supabase
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

        if (error) {
            console.error('Error loading profile:', error);
            return;
        }

        this.currentUser = {
            id: authUser.id,
            email: authUser.email,
            ...profile
        };

        this.isLoggedIn = true;

        // Load partner if coupled
        if (profile && profile.couple_id) {
            await this.loadPartner(profile.couple_id);
        }

        // Update UI
        UI.updateHeader();
        UI.updateNavigation();
    },

    // Load partner data
    async loadPartner(coupleId) {
        const { data: couple, error } = await supabase
            .from('couples')
            .select('*')
            .eq('id', coupleId)
            .maybeSingle();

        if (error || !couple) return;

        const partnerId = couple.partner1_id === this.currentUser.id 
            ? couple.partner2_id 
            : couple.partner1_id;

        const { data: partner, error: partnerError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', partnerId)
            .maybeSingle();

        if (!partnerError && partner) {
            this.currentPartner = partner;
            this.currentUser.partnerNumber = couple.partner1_id === this.currentUser.id ? 1 : 2;
        }
    },

    // Sign up new user
    async signUp(email, password, name) {
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name }
                }
            });

            if (authError) throw authError;

            // Generate invite code
            const inviteCode = this.generateInviteCode();

            // Create profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    email,
                    name,
                    invite_code: inviteCode,
                    avatar: '👤',
                    created_at: new Date().toISOString()
                }]);

            if (profileError) throw profileError;

            Notifications.show('تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني', 'success');
            return { success: true, user: authData.user };

        } catch (error) {
            console.error('Sign up error:', error);
            Notifications.show(error.message || 'خطأ في إنشاء الحساب', 'error');
            return { success: false, error };
        }
    },

    // Sign in
    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            await this.setUser(data.user);
            Notifications.show('تم تسجيل الدخول بنجاح!', 'success');

            // Sync data from cloud
            await Sync.syncAll();

            return { success: true };

        } catch (error) {
            console.error('Sign in error:', error);
            Notifications.show(error.message || 'خطأ في تسجيل الدخول', 'error');
            return { success: false, error };
        }
    },

    // Reset password
    async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) throw error;

            Notifications.show('تم إرسال رابط إعادة تعيين كلمة المرور', 'success');
            return { success: true };

        } catch (error) {
            console.error('Reset password error:', error);
            Notifications.show(error.message || 'خطأ في إرسال الرابط', 'error');
            return { success: false, error };
        }
    },

    // Update password
    async updatePassword(newPassword) {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            Notifications.show('تم تحديث كلمة المرور بنجاح', 'success');
            return { success: true };

        } catch (error) {
            console.error('Update password error:', error);
            Notifications.show(error.message || 'خطأ في تحديث كلمة المرور', 'error');
            return { success: false, error };
        }
    },

    // Generate unique invite code
    generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // Get invite code
    getInviteCode() {
        return this.currentUser ? this.currentUser.invite_code : null;
    },

    // Send invitation to partner
    async sendInvitation() {
        if (!this.currentUser) return;

        const inviteCode = this.getInviteCode();
        const inviteText = `انضم إلي في تطبيق ذكرياتنا! استخدم كود الدعوة: ${inviteCode}`;
        const inviteUrl = `${window.location.origin}?invite=${inviteCode}`;

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(`${inviteText}\n${inviteUrl}`);
            Notifications.show('تم نسخ كود الدعوة!', 'success');
        } catch (err) {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = `${inviteText}\n${inviteUrl}`;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Notifications.show('تم نسخ كود الدعوة!', 'success');
        }

        // Share if available
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'انضم إلي في ذكرياتنا',
                    text: inviteText,
                    url: inviteUrl
                });
            } catch (err) {
                // User cancelled share
            }
        }
    },

    // Accept invitation
    async acceptInvitation(partnerCode) {
        if (!this.currentUser) return { success: false, error: 'Not logged in' };

        try {
            // Find partner by invite code
            const { data: partner, error: partnerError } = await supabase
                .from('profiles')
                .select('*')
                .eq('invite_code', partnerCode.toUpperCase())
                .maybeSingle();

            if (partnerError || !partner) {
                throw new Error('كود الدعوة غير صحيح');
            }

            if (partner.id === this.currentUser.id) {
                throw new Error('لا يمكنك ربط نفسك بنفسك!');
            }

            if (partner.couple_id || this.currentUser.couple_id) {
                throw new Error('أحد الطرفين مرتبط بالفعل');
            }

            // Create couple record
            const { data: couple, error: coupleError } = await supabase
                .from('couples')
                .insert([{
                    partner1_id: this.currentUser.id,
                    partner2_id: partner.id,
                    partner1_name: this.currentUser.name,
                    partner2_name: partner.name,
                    relationship_start: new Date().toISOString().split('T')[0],
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (coupleError) throw coupleError;

            // Update both profiles with couple_id
            await supabase
                .from('profiles')
                .update({ couple_id: couple.id })
                .eq('id', this.currentUser.id);

            await supabase
                .from('profiles')
                .update({ couple_id: couple.id })
                .eq('id', partner.id);

            // Create invite record
            await supabase
                .from('invites')
                .insert([{
                    couple_id: couple.id,
                    inviter_id: this.currentUser.id,
                    invitee_id: partner.id,
                    status: 'accepted',
                    created_at: new Date().toISOString()
                }]);

            // Reload partner
            await this.loadPartner(couple.id);
            this.currentUser.couple_id = couple.id;

            Notifications.show(`تم الربط بنجاح مع ${partner.name}! 💕`, 'love');

            // Award achievement
            Achievements.unlock('ach011');

            return { success: true };

        } catch (error) {
            console.error('Accept invitation error:', error);
            Notifications.show(error.message || 'خطأ في ربط الشريك', 'error');
            return { success: false, error };
        }
    },

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    },

    // Get current partner
    getCurrentPartner() {
        return this.currentPartner;
    },

    // Check if user has partner
    hasPartner() {
        return !!this.currentPartner;
    },

    // Logout
    async logout() {
        // Sync before logout
        await Sync.syncAll();

        // Sign out from Supabase
        await supabase.auth.signOut();

        // Clear local state
        this.currentUser = null;
        this.currentPartner = null;
        this.isLoggedIn = false;

        // Clear sensitive local data
        Storage.clearUserData();

        Notifications.show('تم تسجيل الخروج بنجاح', 'info');
        App.navigateTo('login');
    },

    // Update profile
    async updateProfile(updates) {
        if (!this.currentUser) return { success: false };

        try {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', this.currentUser.id);

            if (error) throw error;

            // Update local
            Object.assign(this.currentUser, updates);
            Storage.save('profile', this.currentUser, 'user');

            Notifications.show('تم تحديث الملف الشخصي بنجاح', 'success');
            return { success: true };

        } catch (error) {
            console.error('Update profile error:', error);
            Notifications.show('خطأ في تحديث الملف الشخصي', 'error');
            return { success: false, error };
        }
    },

    // Upload profile picture
    async uploadProfilePicture(file) {
        if (!this.currentUser) return { success: false };

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${this.currentUser.id}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('profile_pictures')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('profile_pictures')
                .getPublicUrl(fileName);

            await this.updateProfile({ profile_picture: publicUrl });

            return { success: true, url: publicUrl };

        } catch (error) {
            console.error('Upload error:', error);
            Notifications.show('خطأ في رفع الصورة', 'error');
            return { success: false, error };
        }
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
}
