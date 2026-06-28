/**
 * ذكرياتنا V3.0 - Notifications Module
 * Internal toast notifications system
 */

const Notifications = {
    container: null,
    maxNotifications: 5,
    notificationHistory: [],

    // Initialize notification container
    init() {
        this.container = document.getElementById('notifications-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notifications-container';
            this.container.className = 'notifications-container';
            document.body.appendChild(this.container);
        }
        this.notificationHistory = Storage.load('notification_history', [], 'user');
    },

    // Show notification
    show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const config = CONSTANTS.NOTIFICATION_TYPES[type] || CONSTANTS.NOTIFICATION_TYPES.info;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${config.icon}</span>
            <span class="notification-text">${this.escapeHTML(message)}</span>
            <button class="notification-close">✕</button>
        `;

        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.dismiss(notification);
        });

        this.container.appendChild(notification);

        while (this.container.children.length > this.maxNotifications) {
            this.dismiss(this.container.firstChild);
        }

        if (duration > 0) {
            setTimeout(() => this.dismiss(notification), duration);
        }

        this.addToHistory(message, type);
    },

    // Dismiss notification
    dismiss(notification) {
        if (!notification || notification.classList.contains('dismissing')) return;
        notification.classList.add('dismissing');
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    },

    // Add to history
    addToHistory(message, type) {
        this.notificationHistory.unshift({ message, type, timestamp: new Date().toISOString() });
        if (this.notificationHistory.length > 100) {
            this.notificationHistory = this.notificationHistory.slice(0, 100);
        }
        Storage.save('notification_history', this.notificationHistory, 'user');
    },

    // Get notification history
    getHistory(limit = 50) {
        return this.notificationHistory.slice(0, limit);
    },

    // Clear history
    clearHistory() {
        this.notificationHistory = [];
        Storage.save('notification_history', [], 'user');
    },

    // Escape HTML to prevent XSS
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Notifications;
}
