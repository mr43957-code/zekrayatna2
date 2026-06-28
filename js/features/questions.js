/**
 * ذكرياتنا V3.0 - Questions Module
 * Question system with "شوف" (Reveal) button
 */

const Questions = {
    currentQuestion: null,

    init() {
        this.renderQuestionsPage();
        this.loadDailyQuestion();
    },

    renderQuestionsPage() {
        const container = document.getElementById('questions-container');
        if (!container) return;

        container.innerHTML = `
            <div class="questions-header">
                <h2>❓ أسئلة وإجابات</h2>
                <p>اكتشفوا المزيد عن بعضكما</p>
            </div>

            <div class="daily-question-section">
                <h3>سؤال اليوم</h3>
                <div class="daily-question-card" id="daily-question">
                    ${this.renderDailyQuestion()}
                </div>
            </div>

            <div class="questions-controls">
                <div class="search-box">
                    <input type="text" id="question-search" placeholder="ابحث في الأسئلة...">
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn active" data-category="all">الكل</button>
                    ${[...new Set(CONSTANTS.QUESTIONS.map(q => q.category))].map(cat => 
                        `<button class="filter-btn" data-category="${cat}">${cat}</button>`
                    ).join('')}
                </div>
            </div>

            <div class="questions-list" id="questions-list">
                ${this.renderQuestionsList()}
            </div>

            <div class="questions-actions">
                <button class="btn-primary" onclick="Questions.startRound()">🎲 جولة أسئلة عشوائية</button>
                <button class="btn-secondary" onclick="Modals.open('add-question')">➕ أضف سؤالا مخصصا</button>
            </div>
        `;

        this.attachListeners();
    },

    renderDailyQuestion() {
        const daily = this.getDailyQuestion();
        const userAnswers = Storage.getQuestionsAnswers();
        const myAnswer = userAnswers.find(a => a.question_id === daily.id && a.answered_by === Auth.getCurrentUser()?.id);
        const partnerAnswer = userAnswers.find(a => a.question_id === daily.id && a.answered_by === Auth.getCurrentPartner()?.id);

        return `
            <div class="question-icon">${daily.icon}</div>
            <p class="question-text">${daily.text}</p>
            <div class="question-actions">
                ${!myAnswer ? `
                    <button class="btn-answer" onclick="Questions.openAnswerModal('${daily.id}')">أجب الآن</button>
                ` : `
                    <div class="my-answer">
                        <span>إجابتك: ${myAnswer.answer}</span>
                    </div>
                `}

                ${partnerAnswer ? `
                    <div class="partner-answer-section">
                        ${partnerAnswer.revealed ? `
                            <div class="revealed-answer">
                                <span>إجابة شريكك: ${partnerAnswer.answer}</span>
                            </div>
                        ` : myAnswer ? `
                            <button class="btn-reveal" onclick="Questions.revealAnswer('${daily.id}')">
                                👁️ شوف إجابة شريكك
                            </button>
                        ` : ''}
                    </div>
                ` : `
                    <p class="waiting-partner">شريكك لم يجب بعد</p>
                `}
            </div>
        `;
    },

    getDailyQuestion() {
        const today = new Date().toDateString();
        let daily = Storage.load('daily_question', null, 'couple');

        if (!daily || daily.date !== today) {
            const random = CONSTANTS.QUESTIONS[Math.floor(Math.random() * CONSTANTS.QUESTIONS.length)];
            daily = { ...random, date: today };
            Storage.save('daily_question', daily, 'couple');
        }

        return daily;
    },

    renderQuestionsList(filter = 'all', search = '') {
        let questions = CONSTANTS.QUESTIONS;

        if (filter !== 'all') {
            questions = questions.filter(q => q.category === filter);
        }

        if (search) {
            questions = questions.filter(q => q.text.includes(search));
        }

        const userAnswers = Storage.getQuestionsAnswers();

        return questions.map(q => {
            const myAnswer = userAnswers.find(a => a.question_id === q.id && a.answered_by === Auth.getCurrentUser()?.id);
            const partnerAnswer = userAnswers.find(a => a.question_id === q.id && a.answered_by === Auth.getCurrentPartner()?.id);

            return `
                <div class="question-card ${myAnswer ? 'answered' : ''}">
                    <div class="question-header">
                        <span class="question-category">${q.category}</span>
                        <span class="question-icon">${q.icon}</span>
                    </div>
                    <p class="question-text">${q.text}</p>
                    <div class="question-status">
                        ${myAnswer ? '✅ أجبت' : '⭕ لم تجب'}
                        ${partnerAnswer ? (partnerAnswer.revealed ? ' | 👁️ شاهدت إجابة شريكك' : ' | ✅ شريكك أجاب') : ' | ⭕ شريكك لم يجب'}
                    </div>
                    <div class="question-actions">
                        ${!myAnswer ? `
                            <button class="btn-answer" onclick="Questions.openAnswerModal('${q.id}')">أجب</button>
                        ` : `
                            <span class="my-answer-preview">إجابتك: ${myAnswer.answer.substring(0, 30)}${myAnswer.answer.length > 30 ? '...' : ''}</span>
                        `}
                        ${partnerAnswer && !partnerAnswer.revealed && myAnswer ? `
                            <button class="btn-reveal" onclick="Questions.revealAnswer('${q.id}')">شوف</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    openAnswerModal(questionId) {
        const question = CONSTANTS.QUESTIONS.find(q => q.id === questionId);
        if (!question) return;

        this.currentQuestion = question;

        Modals.open('answer-modal', `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${question.icon} ${question.category}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="question-text">${question.text}</p>
                    <textarea id="answer-input" rows="4" placeholder="اكتب إجابتك هنا..."></textarea>
                    <div class="privacy-options">
                        <label>
                            <input type="radio" name="privacy" value="public" checked>
                            عامة (يشاهدها الشريك)
                        </label>
                        <label>
                            <input type="radio" name="privacy" value="private">
                            خاصة (تبقى سرا)
                        </label>
                    </div>
                    <button class="btn-primary" onclick="Questions.submitAnswer()">إرسال الإجابة</button>
                </div>
            </div>
        `);
    },

    async submitAnswer() {
        const answerInput = document.getElementById('answer-input');
        const answer = answerInput ? answerInput.value.trim() : '';
        if (!answer) {
            Notifications.show('الرجاء كتابة إجابة', 'warning');
            return;
        }

        const privacyRadio = document.querySelector('input[name="privacy"]:checked');
        const privacy = privacyRadio ? privacyRadio.value : 'public';
        const userId = Auth.getCurrentUser()?.id;
        const coupleId = Auth.getCurrentUser()?.couple_id;

        if (!userId || !coupleId) return;

        const answerData = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            couple_id: coupleId,
            question_id: this.currentQuestion.id,
            question: this.currentQuestion.text,
            question_icon: this.currentQuestion.icon,
            question_category: this.currentQuestion.category,
            answer: answer,
            answered_by: userId,
            revealed: privacy === 'public' ? false : true,
            created_at: new Date().toISOString()
        };

        const answers = Storage.getQuestionsAnswers();
        answers.push(answerData);
        Storage.saveQuestionsAnswers(answers);

        await Sync.supabaseSaveData('questions_answers', answerData);

        if (privacy === 'public') {
            Notifications.show('تم إرسال إجابتك! شريكك يمكنه مشاهدتها الآن', 'success');
        } else {
            Notifications.show('تم حفظ إجابتك الخاصة', 'info');
        }

        Modals.close('answer-modal');
        this.renderQuestionsPage();

        const totalAnswers = answers.filter(a => a.answered_by === userId).length;
        if (totalAnswers >= 1) Challenges.unlock('ach005');
        if (totalAnswers >= 50) Challenges.unlock('ach006');
    },

    async revealAnswer(questionId) {
        const answers = Storage.getQuestionsAnswers();
        const answerIndex = answers.findIndex(a => a.question_id === questionId && a.answered_by !== Auth.getCurrentUser()?.id);

        if (answerIndex === -1) return;

        answers[answerIndex].revealed = true;
        Storage.saveQuestionsAnswers(answers);

        await Sync.supabaseUpdateData('questions_answers', answers[answerIndex].id, { revealed: true });

        Notifications.show('تم الكشف عن الإجابة! 💕', 'love');

        const revealedCount = answers.filter(a => a.revealed && a.answered_by !== Auth.getCurrentUser()?.id).length;
        if (revealedCount >= 20) Challenges.unlock('ach019');

        this.renderQuestionsPage();
    },

    startRound() {
        const shuffled = [...CONSTANTS.QUESTIONS].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);
        let current = 0;

        const showNext = () => {
            if (current >= selected.length) {
                Modals.open('round-modal', `
                    <div class="modal-content">
                        <div class="modal-header"><h3>🎉 اكتملت الجولة!</h3></div>
                        <div class="modal-body">
                            <p>أجبت على ${selected.length} أسئلة</p>
                            <button class="btn-primary" onclick="Modals.close('round-modal')">إغلاق</button>
                        </div>
                    </div>
                `);
                return;
            }

            const q = selected[current];
            this.currentQuestion = q;

            Modals.open('round-modal', `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>سؤال ${current + 1} من ${selected.length}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="question-text">${q.text}</p>
                        <textarea id="round-answer" rows="3" placeholder="إجابتك..."></textarea>
                        <button class="btn-primary" onclick="Questions.submitRoundAnswer()">التالي</button>
                    </div>
                </div>
            `);
        };

        showNext();
    },

    async submitRoundAnswer() {
        const answerInput = document.getElementById('round-answer');
        const answer = answerInput ? answerInput.value.trim() : '';
        if (!answer) return;

        await this.submitAnswer();
    },

    attachListeners() {
        const searchInput = document.getElementById('question-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const list = document.getElementById('questions-list');
                if (list) list.innerHTML = this.renderQuestionsList('all', e.target.value);
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const list = document.getElementById('questions-list');
                if (list) list.innerHTML = this.renderQuestionsList(e.target.dataset.category);
            });
        });
    },

    loadDailyQuestion() {}
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Questions;
}
