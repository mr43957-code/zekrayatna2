/**
 * ذكرياتنا V3.0 - Profile Module
 * Advanced profile management
 */

const Profile = {
    // Initialize profile
    init() {
        this.renderProfileModal();
    },

    // Render profile modal
    renderProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;

        const user = Auth.getCurrentUser();
        const partner = Auth.getCurrentPartner();

        modal.innerHTML = `
            <div class="modal-content profile-modal">
                <div class="modal-header">
                    <h2>الملف الشخصي</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="profile-tabs">
                        <button class="profile-tab active" data-tab="my-profile">ملفي</button>
                        <button class="profile-tab" data-tab="partner-profile">شريكي</button>
                    </div>

                    <div class="profile-content" id="my-profile-tab">
                        <div class="profile-avatar-section">
                            <div class="profile-avatar">
                                ${user?.profile_picture 
                                    ? `<img src="${user.profile_picture}" alt="Profile">` 
                                    : `<span class="avatar-emoji">${user?.avatar || '👤'}</span>`}
                            </div>
                            <button class="btn-upload-avatar">تغيير الصورة</button>
                            <input type="file" id="avatar-upload" accept="image/*" hidden>
                        </div>

                        <form class="profile-form" id="profile-form">
                            <div class="form-group">
                                <label>الاسم</label>
                                <input type="text" name="name" value="${user?.name || ''}" required>
                            </div>

                            <div class="form-group">
                                <label>الأفاتار</label>
                                <div class="avatar-picker">
                                    ${['👤','👩','👨','👧','👦','🧑','👱','🧔','👳','🧕'].map(emoji => 
                                        `<span class="avatar-option ${user?.avatar === emoji ? 'selected' : ''}" data-avatar="${emoji}">${emoji}</span>`
                                    ).join('')}
                                </div>
                            </div>

                            <div class="form-group">
                                <label>تاريخ الميلاد</label>
                                <input type="date" name="birthday" value="${user?.birthday || ''}">
                            </div>

                            <div class="form-group">
                                <label>الهوايات</label>
                                <div class="hobbies-input">
                                    <input type="text" id="hobby-input" placeholder="أضف هواية...">
                                    <button type="button" class="btn-add-hobby">+</button>
                                </div>
                                <div class="hobbies-list">
                                    ${(user?.hobbies || []).map(hobby => 
                                        `<span class="hobby-tag">${hobby} <button class="remove-hobby">&times;</button></span>`
                                    ).join('')}
                                </div>
                            </div>

                            <div class="form-group">
                                <label>اللون المفضل</label>
                                <input type="color" name="favorite_color" value="${user?.favorite_color || '#ff69b4'}">
                            </div>

                            <div class="form-group">
                                <label>الأغنية المفضلة</label>
                                <input type="text" name="favorite_song" value="${user?.favorite_song || ''}" placeholder="اسم الأغنية والمغني">
                            </div>

                            <div class="form-group">
                                <label>الفيلم المفضل</label>
                                <input type="text" name="favorite_movie" value="${user?.favorite_movie || ''}">
                            </div>

                            <div class="form-group">
                                <label>ذكرى خاصة</label>
                                <textarea name="special_memory" rows="3" placeholder="اكتب عن ذكرى خاصة بينكما...">${user?.special_memory || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label>تاريخ أول لقاء</label>
                                <input type="date" name="first_meet_date" value="${user?.first_meet_date || ''}">
                            </div>

                            <div class="form-group">
                                <label>مكان أول لقاء</label>
                                <input type="text" name="first_meet_place" value="${user?.first_meet_place || ''}">
                            </div>

                            <div class="form-group">
                                <label>كود الدعوة</label>
                                <div class="invite-code-display">
                                    <code>${user?.invite_code || '---'}</code>
                                    <button type="button" class="btn-copy-code">نسخ</button>
                                    <button type="button" class="btn-share-code">مشاركة</button>
                                </div>
                            </div>

                            <button type="submit" class="btn-primary">حفظ التغييرات</button>
                        </form>
                    </div>

                    <div class="profile-content hidden" id="partner-profile-tab">
                        ${partner ? `
                            <div class="partner-info">
                                <div class="profile-avatar">
                                    ${partner.profile_picture 
                                        ? `<img src="${partner.profile_picture}" alt="Partner">` 
                                        : `<span class="avatar-emoji">${partner.avatar || '👤'}</span>`}
                                </div>
                                <h3>${partner.name}</h3>
                                <p class="partner-email">${partner.email}</p>

                                <div class="partner-details">
                                    <div class="detail-item">
                                        <span class="detail-icon">🎂</span>
                                        <span class="detail-label">تاريخ الميلاد</span>
                                        <span class="detail-value">${partner.birthday || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">🎨</span>
                                        <span class="detail-label">اللون المفضل</span>
                                        <span class="detail-value" style="color: ${partner.favorite_color || '#000'}">${partner.favorite_color || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">🎵</span>
                                        <span class="detail-label">الأغنية المفضلة</span>
                                        <span class="detail-value">${partner.favorite_song || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">🎬</span>
                                        <span class="detail-label">الفيلم المفضل</span>
                                        <span class="detail-value">${partner.favorite_movie || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">💭</span>
                                        <span class="detail-label">ذكرى خاصة</span>
                                        <span class="detail-value">${partner.special_memory || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">📅</span>
                                        <span class="detail-label">تاريخ أول لقاء</span>
                                        <span class="detail-value">${partner.first_meet_date || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">📍</span>
                                        <span class="detail-label">مكان أول لقاء</span>
                                        <span class="detail-value">${partner.first_meet_place || 'غير محدد'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">🎯</span>
                                        <span class="detail-label">الهوايات</span>
                                        <span class="detail-value">${(partner.hobbies || []).join(', ') || 'غير محدد'}</span>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="no-partner">
                                <p>لم تربط بحساب شريكك بعد</p>
                                <button class="btn-primary" onclick="Modals.open('link-partner')">ربط الشريك</button>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    },

    // Attach event listeners
    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.profile-content').forEach(c => c.classList.add('hidden'));
                e.target.classList.add('active');
                document.getElementById(`${e.target.dataset.tab}-tab`).classList.remove('hidden');
            });
        });

        // Avatar selection
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });

        // Hobby management
        const hobbyInput = document.getElementById('hobby-input');
        const addHobbyBtn = document.querySelector('.btn-add-hobby');
        const hobbiesList = document.querySelector('.hobbies-list');

        const addHobby = () => {
            const hobby = hobbyInput.value.trim();
            if (hobby) {
                const tag = document.createElement('span');
                tag.className = 'hobby-tag';
                tag.innerHTML = `${hobby} <button class="remove-hobby">&times;</button>`;
                hobbiesList.appendChild(tag);
                hobbyInput.value = '';
            }
        };

        addHobbyBtn.addEventListener('click', addHobby);
        hobbyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addHobby();
        });

        hobbiesList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-hobby')) {
                e.target.parentElement.remove();
            }
        });

        // Form submission
        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProfile(e.target);
        });

        // Avatar upload
        document.querySelector('.btn-upload-avatar').addEventListener('click', () => {
            document.getElementById('avatar-upload').click();
        });

        document.getElementById('avatar-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const result = await Auth.uploadProfilePicture(file);
                if (result.success) {
                    document.querySelector('.profile-avatar').innerHTML = `<img src="${result.url}" alt="Profile">`;
                }
            }
        });

        // Invite code actions
        document.querySelector('.btn-copy-code').addEventListener('click', () => {
            Auth.sendInvitation();
        });

        document.querySelector('.btn-share-code').addEventListener('click', () => {
            Auth.sendInvitation();
        });
    },

    // Save profile
    async saveProfile(form) {
        const formData = new FormData(form);
        const hobbies = Array.from(document.querySelectorAll('.hobby-tag')).map(tag => 
            tag.textContent.replace(' ×', '').trim()
        );

        const selectedAvatar = document.querySelector('.avatar-option.selected')?.dataset.avatar;

        const updates = {
            name: formData.get('name'),
            avatar: selectedAvatar || Auth.getCurrentUser()?.avatar,
            birthday: formData.get('birthday'),
            hobbies: hobbies,
            favorite_color: formData.get('favorite_color'),
            favorite_song: formData.get('favorite_song'),
            favorite_movie: formData.get('favorite_movie'),
            special_memory: formData.get('special_memory'),
            first_meet_date: formData.get('first_meet_date'),
            first_meet_place: formData.get('first_meet_place')
        };

        const result = await Auth.updateProfile(updates);
        if (result.success) {
            Modals.close('profile-modal');
            UI.updateHeader();
        }
    },

    // Get relationship duration
    getRelationshipDuration() {
        const user = Auth.getCurrentUser();
        if (!user?.first_meet_date) return null;

        const start = new Date(user.first_meet_date);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        const days = diffDays % 30;

        return { years, months, days, totalDays: diffDays };
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Profile;
}
