/**
 * ذكرياتنا V3.0 - Time Capsules Module
 */

const Capsules = {
    init() {
        this.renderCapsulesPage();
        this.checkUnlockedCapsules();
    },

    renderCapsulesPage() {
        const container = document.getElementById('capsules-container');
        if (!container) return;

        const capsules = Storage.getCapsules();
        const now = new Date();

        const stats = {
            total: capsules.length,
            locked: capsules.filter(c => new Date(c.open_date) > now).length,
            unlocked: capsules.filter(c => new Date(c.open_date) <= now && !c.opened).length,
            opened: capsules.filter(c => c.opened).length
        };

        container.innerHTML = `
            <div class="capsules-header">
                <h2>⏳ الكبسولات الزمنية</h2>
                <p>احفظ ذكرياتك لفتحها في المستقبل</p>
            </div>

            <div class="capsules-stats">
                <div class="stat-card"><span>${stats.total}</span><label>الإجمالي</label></div>
                <div class="stat-card"><span>${stats.locked}</span><label>مغلقة</label></div>
                <div class="stat-card"><span>${stats.unlocked}</span><label>متاحة</label></div>
                <div class="stat-card"><span>${stats.opened}</span><label>مفتوحة</label></div>
            </div>

            <div class="capsules-actions">
                <button class="btn-primary" onclick="Capsules.showCreateModal()">➕ إنشاء كبسولة</button>
            </div>

            <div class="capsules-grid">
                ${this.renderCapsulesList(capsules)}
            </div>
        `;
    },

    renderCapsulesList(capsules) {
        const now = new Date();

        if (capsules.length === 0) {
            return '<div class="empty-state"><p>لا توجد كبسولات بعد. أنشئ كبسولتك الأولى!</p></div>';
        }

        return capsules.sort((a, b) => new Date(a.open_date) - new Date(b.open_date)).map(c => {
            const openDate = new Date(c.open_date);
            const isLocked = openDate > now;
            const isAvailable = !isLocked && !c.opened;

            return `
                <div class="capsule-card ${isLocked ? 'locked' : ''} ${isAvailable ? 'available' : ''} ${c.opened ? 'opened' : ''}">
                    <div class="capsule-icon">${isLocked ? '🔒' : isAvailable ? '🔓' : '📂'}</div>
                    <h4>${c.title}</h4>
                    <p class="capsule-type">${CONSTANTS.CAPSULE_TYPES.find(t => t.id === c.type)?.name || 'مخصص'}</p>
                    <div class="capsule-date">
                        ${isLocked ? `يفتح بعد: ${this.formatCountdown(openDate)}` : 
                          isAvailable ? 'متاح للفتح الآن!' : `فُتح في: ${new Date(c.opened_at).toLocaleDateString('ar')}`}
                    </div>
                    ${isAvailable ? `
                        <button class="btn-open-capsule" onclick="Capsules.openCapsule('${c.id}')">افتح الكبسولة</button>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    formatCountdown(targetDate) {
        const now = new Date();
        const diff = targetDate - now;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 365) return `${Math.floor(days / 365)} سنة`;
        if (days > 30) return `${Math.floor(days / 30)} شهر`;
        if (days > 0) return `${days} يوم`;
        return `${hours} ساعة`;
    },

    showCreateModal() {
        Modals.open('create-capsule-modal', `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⏳ إنشاء كبسولة زمنية</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="capsule-form">
                        <div class="form-group">
                            <label>العنوان</label>
                            <input type="text" id="capsule-title" required placeholder="مثال: رسالة لنا بعد سنة">
                        </div>
                        <div class="form-group">
                            <label>الرسالة</label>
                            <textarea id="capsule-message" rows="4" placeholder="اكتب رسالتك هنا..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>نوع الكبسولة</label>
                            <select id="capsule-type">
                                ${CONSTANTS.CAPSULE_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>تاريخ الفتح</label>
                            <input type="date" id="capsule-open-date" required>
                        </div>
                        <button type="submit" class="btn-primary">إنشاء الكبسولة</button>
                    </form>
                </div>
            </div>
        `);

        document.getElementById('capsule-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCapsuleFromForm();
        });
    },

    createCapsuleFromForm() {
        const title = document.getElementById('capsule-title').value;
        const message = document.getElementById('capsule-message').value;
        const type = document.getElementById('capsule-type').value;
        const openDate = document.getElementById('capsule-open-date').value;

        if (!title || !openDate) return;

        this.createCapsule({ title, message, type, open_date: openDate });
        Modals.close('create-capsule-modal');
    },

    async createCapsule(formData) {
        const capsule = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: formData.title,
            message: formData.message,
            open_date: formData.open_date,
            type: formData.type,
            photos: formData.photos || [],
            audio: formData.audio || null,
            created_by: Auth.getCurrentUser()?.id,
            created_at: new Date().toISOString(),
            opened: false,
            synced: false
        };

        const capsules = Storage.getCapsules();
        capsules.push(capsule);
        Storage.saveCapsules(capsules);

        await Sync.supabaseSaveData('capsules', capsule);

        Notifications.show('تم إنشاء الكبسولة بنجاح! ⏳', 'success');
        Challenges.unlock('ach009');

        this.renderCapsulesPage();
    },

    async openCapsule(capsuleId) {
        const capsules = Storage.getCapsules();
        const capsule = capsules.find(c => c.id === capsuleId);

        if (!capsule || capsule.opened) return;

        capsule.opened = true;
        capsule.opened_at = new Date().toISOString();
        Storage.saveCapsules(capsules);

        Modals.open('capsule-content-modal', `
            <div class="modal-content capsule-content">
                <div class="modal-header"><h3>🎉 حان وقت الفتح!</h3></div>
                <div class="modal-body">
                    <h4>${capsule.title}</h4>
                    <div class="capsule-message">${capsule.message}</div>
                    ${capsule.photos && capsule.photos.length > 0 ? `
                        <div class="capsule-photos">
                            ${capsule.photos.map(p => `<img src="${p}" alt="Capsule photo">`).join('')}
                        </div>
                    ` : ''}
                    ${capsule.audio ? `
                        <audio controls src="${capsule.audio}"></audio>
                    ` : ''}
                    <p class="capsule-created">أنشئت في: ${new Date(capsule.created_at).toLocaleDateString('ar')}</p>
                </div>
            </div>
        `);

        await Sync.supabaseUpdateData('capsules', capsuleId, { opened: true, opened_at: capsule.opened_at });

        Notifications.show('تم فتح الكبسولة! استمتع بالذكرى 💕', 'love');
        Challenges.unlock('ach010');
    },

    checkUnlockedCapsules() {
        const capsules = Storage.getCapsules();
        const now = new Date();

        const newlyUnlocked = capsules.filter(c => {
            const openDate = new Date(c.open_date);
            return openDate <= now && !c.opened && !c.notified;
        });

        newlyUnlocked.forEach(c => {
            c.notified = true;
            Notifications.show(`كبسولة "${c.title}" متاحة للفتح الآن! 🔓`, 'capsule');
        });

        if (newlyUnlocked.length > 0) {
            Storage.saveCapsules(capsules);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Capsules;
}
