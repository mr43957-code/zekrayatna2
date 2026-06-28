/**
 * ذكرياتنا V3.0 - Diary Module
 */

const Diary = {
    init() {
        this.renderDiaryPage();
    },

    renderDiaryPage() {
        const container = document.getElementById('diary-container');
        if (!container) return;

        container.innerHTML = `
            <div class="diary-header">
                <h2>📓 اليوميات</h2>
                <p>اكتب خواطرك وأفكارك</p>
            </div>

            <div class="diary-actions">
                <button class="btn-primary" onclick="Diary.showCreateModal()">✍️ كتابة خاطرة</button>
                <div class="diary-filters">
                    <select id="diary-filter">
                        <option value="all">الكل</option>
                        <option value="today">اليوم</option>
                        <option value="week">هذا الأسبوع</option>
                        <option value="month">هذا الشهر</option>
                        <option value="year">هذه السنة</option>
                    </select>
                </div>
            </div>

            <div class="on-this-day-section" id="on-this-day"></div>

            <div class="diary-entries" id="diary-entries">
                ${this.renderEntries()}
            </div>
        `;

        this.loadOnThisDay();

        const filterSelect = document.getElementById('diary-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const entriesContainer = document.getElementById('diary-entries');
                if (entriesContainer) entriesContainer.innerHTML = this.renderEntries(e.target.value);
            });
        }
    },

    renderEntries(filter = 'all') {
        let entries = Storage.getDiaryEntries();
        const now = new Date();

        if (filter === 'today') {
            entries = entries.filter(e => new Date(e.date).toDateString() === now.toDateString());
        } else if (filter === 'week') {
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            entries = entries.filter(e => new Date(e.date) >= weekAgo);
        } else if (filter === 'month') {
            entries = entries.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (filter === 'year') {
            entries = entries.filter(e => new Date(e.date).getFullYear() === now.getFullYear());
        }

        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (entries.length === 0) {
            return '<div class="empty-state"><p>لا توجد خواطر بعد. ابدأ الكتابة اليوم!</p></div>';
        }

        return entries.map(entry => `
            <div class="diary-entry">
                <div class="entry-header">
                    <span class="entry-mood">${CONSTANTS.MOODS.find(m => m.id === entry.mood)?.icon || '😊'}</span>
                    <h4>${entry.title}</h4>
                    <span class="entry-date">${new Date(entry.date).toLocaleDateString('ar')}</span>
                </div>
                <div class="entry-content">${entry.content}</div>
                ${entry.tags && entry.tags.length > 0 ? `
                    <div class="entry-tags">
                        ${entry.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                ` : ''}
                ${entry.photos && entry.photos.length > 0 ? `
                    <div class="entry-photos">
                        ${entry.photos.map(p => `<img src="${p}" alt="Diary photo">`).join('')}
                    </div>
                ` : ''}
                <div class="entry-actions">
                    <button onclick="Diary.editEntry('${entry.id}')">✏️ تعديل</button>
                    <button onclick="Diary.deleteEntry('${entry.id}')">🗑️ حذف</button>
                </div>
            </div>
        `).join('');
    },

    loadOnThisDay() {
        const entries = Storage.getDiaryEntries();
        const now = new Date();
        const pastEntries = entries.filter(e => {
            const d = new Date(e.date);
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear();
        });

        if (pastEntries.length > 0) {
            const container = document.getElementById('on-this-day');
            if (container) {
                container.innerHTML = `
                    <h3>📅 في مثل هذا اليوم</h3>
                    ${pastEntries.map(e => `
                        <div class="past-entry">
                            <span class="past-year">${new Date(e.date).getFullYear()}</span>
                            <p>${e.title}</p>
                        </div>
                    `).join('')}
                `;
            }
        }
    },

    showCreateModal() {
        Modals.open('create-entry-modal', `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✍️ كتابة خاطرة جديدة</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="diary-form">
                        <div class="form-group">
                            <label>العنوان</label>
                            <input type="text" id="entry-title" required placeholder="عنوان الخاطرة">
                        </div>
                        <div class="form-group">
                            <label>المحتوى</label>
                            <textarea id="entry-content" rows="6" required placeholder="اكتب ما في قلبك..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>المزاج</label>
                            <div class="mood-picker">
                                ${CONSTANTS.MOODS.map(m => `
                                    <span class="mood-option" data-mood="${m.id}">${m.icon} ${m.name}</span>
                                `).join('')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label>الوسوم (مفصولة بفواصل)</label>
                            <input type="text" id="entry-tags" placeholder="سعادة، حب، يوم جميل">
                        </div>
                        <button type="submit" class="btn-primary">حفظ الخاطرة</button>
                    </form>
                </div>
            </div>
        `);

        document.querySelectorAll('.mood-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                document.querySelectorAll('.mood-option').forEach(o => o.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });

        document.getElementById('diary-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEntryFromForm();
        });
    },

    saveEntryFromForm() {
        const title = document.getElementById('entry-title').value;
        const content = document.getElementById('entry-content').value;
        const tags = document.getElementById('entry-tags').value.split(',').map(t => t.trim()).filter(t => t);
        const mood = document.querySelector('.mood-option.selected')?.dataset.mood || 'happy';

        this.saveEntry({ title, content, tags, mood });
        Modals.close('create-entry-modal');
    },

    async saveEntry(entryData) {
        const entries = Storage.getDiaryEntries();

        if (entryData.id) {
            const index = entries.findIndex(e => e.id === entryData.id);
            if (index !== -1) {
                entries[index] = { ...entries[index], ...entryData, updated_at: new Date().toISOString() };
            }
        } else {
            entryData.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            entryData.date = new Date().toISOString();
            entryData.created_by = Auth.getCurrentUser()?.id;
            entries.push(entryData);
        }

        Storage.saveDiaryEntries(entries);
        Notifications.show('تم حفظ الخاطرة بنجاح!', 'success');

        this.renderDiaryPage();
    },

    editEntry(entryId) {
        const entries = Storage.getDiaryEntries();
        const entry = entries.find(e => e.id === entryId);
        if (!entry) return;

        Modals.open('edit-entry-modal', `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ تعديل الخاطرة</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-diary-form">
                        <div class="form-group">
                            <label>العنوان</label>
                            <input type="text" id="edit-title" value="${entry.title}" required>
                        </div>
                        <div class="form-group">
                            <label>المحتوى</label>
                            <textarea id="edit-content" rows="6" required>${entry.content}</textarea>
                        </div>
                        <button type="submit" class="btn-primary">تحديث</button>
                    </form>
                </div>
            </div>
        `);

        document.getElementById('edit-diary-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('edit-title').value;
            const content = document.getElementById('edit-content').value;
            this.saveEntry({ id: entryId, title, content });
            Modals.close('edit-entry-modal');
        });
    },

    deleteEntry(entryId) {
        if (!confirm('هل أنت متأكد من حذف هذه الخاطرة؟')) return;

        let entries = Storage.getDiaryEntries();
        entries = entries.filter(e => e.id !== entryId);
        Storage.saveDiaryEntries(entries);

        Notifications.show('تم حذف الخاطرة', 'info');
        this.renderDiaryPage();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Diary;
}
