/**
 * ذكرياتنا V3.0 - Sync Module
 * Supabase synchronization with offline support
 */

const Sync = {
    syncQueue: [],
    isOnline: navigator.onLine,
    lastSync: null,
    syncInProgress: false,

    // Initialize sync
    init() {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            Notifications.show('تم استعادة الاتصال بالإنترنت - جاري المزامنة', 'info');
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            Notifications.show('انقطع الاتصال بالإنترنت - سيتم الحفظ محلياً', 'warning');
        });

        // Load sync queue from storage
        this.syncQueue = Storage.load('sync_queue', [], 'user');
        this.lastSync = Storage.load('last_sync', null, 'user');
    },

    // Save data to Supabase
    async supabaseSaveData(table, data, options = {}) {
        if (!Auth.isLoggedIn || !this.isOnline) {
            this.addToSyncQueue('insert', table, data);
            return { success: false, offline: true };
        }

        try {
            const { data: result, error } = await supabase
                .from(table)
                .insert([data])
                .select()
                .maybeSingle();

            if (error) throw error;

            return { success: true, data: result };

        } catch (error) {
            console.error(`Supabase save error (${table}):`, error);
            this.addToSyncQueue('insert', table, data);
            return { success: false, error, offline: false };
        }
    },

    // Update data in Supabase
    async supabaseUpdateData(table, id, updates) {
        if (!Auth.isLoggedIn || !this.isOnline) {
            this.addToSyncQueue('update', table, { id, ...updates });
            return { success: false, offline: true };
        }

        try {
            const { data: result, error } = await supabase
                .from(table)
                .update(updates)
                .eq('id', id)
                .select()
                .maybeSingle();

            if (error) throw error;

            return { success: true, data: result };

        } catch (error) {
            console.error(`Supabase update error (${table}):`, error);
            this.addToSyncQueue('update', table, { id, ...updates });
            return { success: false, error, offline: false };
        }
    },

    // Load data from Supabase
    async supabaseLoadData(table, filters = {}) {
        if (!Auth.isLoggedIn || !this.isOnline) {
            return { success: false, offline: true };
        }

        try {
            let query = supabase.from(table).select('*');

            // Apply filters
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data };

        } catch (error) {
            console.error(`Supabase load error (${table}):`, error);
            return { success: false, error };
        }
    },

    // Delete data from Supabase
    async supabaseDeleteData(table, id) {
        if (!Auth.isLoggedIn || !this.isOnline) {
            this.addToSyncQueue('delete', table, { id });
            return { success: false, offline: true };
        }

        try {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (error) throw error;

            return { success: true };

        } catch (error) {
            console.error(`Supabase delete error (${table}):`, error);
            this.addToSyncQueue('delete', table, { id });
            return { success: false, error, offline: false };
        }
    },

    // Add operation to sync queue
    addToSyncQueue(operation, table, data) {
        this.syncQueue.push({
            operation,
            table,
            data,
            timestamp: new Date().toISOString(),
            retryCount: 0
        });

        Storage.save('sync_queue', this.syncQueue, 'user');
    },

    // Process sync queue
    async processSyncQueue() {
        if (!this.isOnline || this.syncInProgress || !Auth.isLoggedIn) return;

        this.syncInProgress = true;
        const failed = [];

        for (const item of this.syncQueue) {
            try {
                let result;

                switch (item.operation) {
                    case 'insert':
                        result = await supabase.from(item.table).insert([item.data]);
                        break;
                    case 'update':
                        const { id, ...updates } = item.data;
                        result = await supabase.from(item.table).update(updates).eq('id', id);
                        break;
                    case 'delete':
                        result = await supabase.from(item.table).delete().eq('id', item.data.id);
                        break;
                }

                if (result.error) throw result.error;

            } catch (error) {
                item.retryCount++;
                if (item.retryCount < 3) {
                    failed.push(item);
                } else {
                    console.error('Sync item failed after 3 retries:', item, error);
                }
            }
        }

        this.syncQueue = failed;
        Storage.save('sync_queue', this.syncQueue, 'user');
        this.syncInProgress = false;

        if (failed.length === 0) {
            Notifications.show('تمت مزامنة جميع البيانات بنجاح', 'success');
        } else {
            Notifications.show(`تمت مزامنة بعض البيانات، ${failed.length} عملية بحاجة لإعادة المحاولة`, 'warning');
        }
    },

    // Full sync all data
    async syncAll() {
        if (!Auth.isLoggedIn || !this.isOnline) return;

        Notifications.show('جاري مزامنة البيانات...', 'info');

        try {
            const coupleId = Auth.getCurrentUser()?.couple_id;
            if (!coupleId) return;

            // Sync events
            const localEvents = Storage.getEvents();
            for (const event of localEvents) {
                if (!event.synced) {
                    await this.supabaseSaveData('events', { ...event, couple_id: coupleId });
                    event.synced = true;
                }
            }
            Storage.saveEvents(localEvents);

            // Sync capsules
            const localCapsules = Storage.getCapsules();
            for (const capsule of localCapsules) {
                if (!capsule.synced) {
                    await this.supabaseSaveData('capsules', { ...capsule, couple_id: coupleId });
                    capsule.synced = true;
                }
            }
            Storage.saveCapsules(localCapsules);

            // Sync Q&A
            const localQA = Storage.getQuestionsAnswers();
            for (const qa of localQA) {
                if (!qa.synced) {
                    await this.supabaseSaveData('questions_answers', { ...qa, couple_id: coupleId });
                    qa.synced = true;
                }
            }
            Storage.saveQuestionsAnswers(localQA);

            // Sync game states
            const localGames = Storage.getGameHistory();
            for (const game of localGames) {
                if (!game.synced) {
                    await this.supabaseSaveData('shared_game_state', { ...game, couple_id: coupleId });
                    game.synced = true;
                }
            }
            Storage.saveGameHistory(localGames);

            // Process any queued operations
            await this.processSyncQueue();

            // Update last sync time
            this.lastSync = new Date().toISOString();
            Storage.save('last_sync', this.lastSync, 'user');

            Notifications.show('تمت المزامنة بنجاح!', 'success');

        } catch (error) {
            console.error('Full sync error:', error);
            Notifications.show('خطأ في المزامنة الكاملة', 'error');
        }
    },

    // Sync on logout
    async syncOnLogout() {
        if (this.isOnline) {
            await this.syncAll();
        }
    },

    // Get sync status
    getStatus() {
        return {
            isOnline: this.isOnline,
            lastSync: this.lastSync,
            queueLength: this.syncQueue.length,
            syncInProgress: this.syncInProgress
        };
    },

    // Real-time subscription for couple data
    async subscribeToCoupleData(coupleId, callback) {
        if (!coupleId) return;

        return supabase
            .channel(`couple_${coupleId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shared_game_state',
                filter: `couple_id=eq.${coupleId}`
            }, callback)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'questions_answers',
                filter: `couple_id=eq.${coupleId}`
            }, callback)
            .subscribe();
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sync;
}
