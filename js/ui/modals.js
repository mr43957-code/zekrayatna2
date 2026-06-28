/**
 * ذكرياتنا V3.0 - Modals Module
 */

const Modals = {
    activeModal: null,

    init() {
        if (!document.getElementById('modals-container')) {
            const container = document.createElement('div');
            container.id = 'modals-container';
            container.className = 'modals-container';
            document.body.appendChild(container);
        }
    },

    open(modalId, content = null) {
        this.closeAll();

        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            document.getElementById('modals-container').appendChild(modal);
        }

        if (content) {
            modal.innerHTML = content;
        }

        modal.classList.add('active');
        this.activeModal = modal;
        document.body.style.overflow = 'hidden';

        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.close(modalId));
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close(modalId);
        });
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            if (this.activeModal === modal) {
                this.activeModal = null;
            }
        }

        if (!document.querySelector('.modal.active')) {
            document.body.style.overflow = '';
        }
    },

    closeAll() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        this.activeModal = null;
        document.body.style.overflow = '';
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modals;
}
