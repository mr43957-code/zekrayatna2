/**
 * ذكرياتنا V3.0 - Main App Module
 */

const App = {
    currentPage: 'login',

    async init() {
        Notifications.init();
        Modals.init();
        Sync.init();

        this.initSupabase();
        await Auth.init();

        this.setupNavigation();
        this.setupEventListeners();

        if (Auth.isLoggedIn) {
            this.navigateTo('home');
        } else {
            this.navigateTo('login');
        }
    },

    initSupabase() {
        const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://your-project.supabase.co';
        const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'your-anon-key';

        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    },

    setupNavigation() {
        window.addEventListener('popstate', (e) => {
            if (e.state?.page) {
                this.showPage(e.state.page);
            }
        });
    },

    navigateTo(page) {
        this.currentPage = page;
        history.pushState({ page }, '', `#${page}`);
        this.showPage(page);
    },

    showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }

        switch(page) {
            case 'home':
                this.loadHomePage();
                break;
            case 'games':
                Games.init();
                break;
            case 'questions':
                Questions.init();
                break;
            case 'challenges':
                Challenges.init();
                break;
            case 'capsules':
                Capsules.init();
                break;
            case 'diary':
                Diary.init();
                break;
            case 'profile':
                Profile.init();
                break;
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
    },

    loadHomePage() {
        const container = document.getElementById('home-container');
        if (!container) return;

        const events = Storage.getEvents ? Storage.getEvents() : [];
        const upcoming = events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));

        const duration = Profile.getRelationshipDuration ? Profile.getRelationshipDuration() : null;

        container.innerHTML = `
            <div class="home-header">
                <h1>أهلا ${Auth.getCurrentUser()?.name || ''}! 👋</h1>
                <p>${this.getGreeting()}</p>
            </div>

            <div class="quick-stats">
                <div class="stat-card">
                    <span class="stat-number">${events.length}</span>
                    <span class="stat-label">مناسبة</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${upcoming.length}</span>
                    <span class="stat-label">قادمة</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${duration?.totalDays || 0}</span>
                    <span class="stat-label">يوم معا</span>
                </div>
            </div>

            <div class="upcoming-events">
                <h3>📅 المناسبات القادمة</h3>
                ${upcoming.slice(0, 3).map(e => `
                    <div class="event-card">
                        <span class="event-icon">${CONSTANTS.EVENT_CATEGORIES?.find(c => c.id === e.category)?.icon || '📅'}</span>
                        <div class="event-info">
                            <h4>${e.title}</h4>
                            <p>${new Date(e.date).toLocaleDateString('ar')} - ${this.formatCountdown(new Date(e.date))}</p>
                        </div>
                    </div>
                `).join('') || '<p>لا توجد مناسبات قادمة</p>'}
            </div>

            <div class="daily-quote">
                <h3>💭 اقتباس اليوم</h3>
                <blockquote>${this.getDailyQuote()}</blockquote>
            </div>
        `;
    },

    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباح الخير! يوم جديد من الحب 💕';
        if (hour < 18) return 'مساء الخير! استمتعا بوقتكما 💑';
        return 'تصبح على خير! نهاية يوم مليء بالحب 🌙';
    },

    getDailyQuote() {
        const quotes = CONSTANTS.QUOTES || [];
        const today = new Date().getDate();
        return quotes[today % quotes.length]?.text || 'الحب هو كل شيء جميل في الحياة';
    },

    formatCountdown(targetDate) {
        const diff = targetDate - new Date();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'اليوم!';
        if (days === 1) return 'غدا';
        return `بعد ${days} يوم`;
    },

    setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                if (page) this.navigateTo(page);
            });
        });

        const btnQuickAdd = document.getElementById('btn-quick-add');
        if (btnQuickAdd) {
            btnQuickAdd.addEventListener('click', () => {
                Modals.open('add-event');
            });
        }

        const btnSync = document.getElementById('btn-sync');
        if (btnSync) {
            btnSync.addEventListener('click', () => {
                Sync.syncAll();
            });
        }

        const btnPanic = document.getElementById('btn-panic');
        if (btnPanic) {
            btnPanic.addEventListener('click', () => {
                document.body.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:99999;"></div>';
                setTimeout(() => location.reload(), 3000);
            });
        }

        // Auth forms
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                await Auth.signIn(formData.get('email'), formData.get('password'));
            });
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                await Auth.signUp(formData.get('email'), formData.get('password'), formData.get('name'));
            });
        }

        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                const tabName = e.target.dataset.tab;
                document.getElementById('login-form').classList.toggle('hidden', tabName !== 'login');
                document.getElementById('register-form').classList.toggle('hidden', tabName !== 'register');
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
