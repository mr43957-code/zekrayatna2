/**
 * ذكرياتنا V3.0 - Games Module
 * Interactive games between partners
 */

const Games = {
    currentGame: null,
    gameState: null,

    // Initialize games
    init() {
        this.renderGamesList();
    },

    // Render games list
    renderGamesList() {
        const container = document.getElementById('games-container');
        if (!container) return;

        container.innerHTML = `
            <div class="games-header">
                <h2>الألعاب التفاعلية</h2>
                <p>اختبر معرفتك بشريكك واستمتعا معاً</p>
            </div>
            <div class="games-grid">
                ${CONSTANTS.GAMES.map(game => `
                    <div class="game-card" data-game="${game.id}">
                        <div class="game-icon">${game.icon}</div>
                        <h3>${game.name}</h3>
                        <p>${game.description}</p>
                        <div class="game-meta">
                            <span class="game-players">👥 ${game.minPlayers}+ لاعبين</span>
                            <span class="game-category">${game.category}</span>
                        </div>
                        <button class="btn-play-game" data-game="${game.id}">العب الآن</button>
                    </div>
                `).join('')}
            </div>
            <div class="games-stats">
                <h3>إحصائيات الألعاب</h3>
                ${this.renderGameStats()}
            </div>
        `;

        // Attach event listeners
        container.querySelectorAll('.btn-play-game').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const gameId = e.target.dataset.game;
                this.startGame(gameId);
            });
        });
    },

    // Render game stats
    renderGameStats() {
        const history = Storage.getGameHistory();
        const stats = {};

        CONSTANTS.GAMES.forEach(game => {
            const gameHistory = history.filter(h => h.game_id === game.id);
            stats[game.id] = {
                played: gameHistory.length,
                wins: gameHistory.filter(h => h.winner === Auth.getCurrentUser()?.id).length,
                lastPlayed: gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].date : null
            };
        });

        return `
            <div class="stats-grid">
                ${CONSTANTS.GAMES.map(game => `
                    <div class="stat-card">
                        <span class="stat-icon">${game.icon}</span>
                        <span class="stat-name">${game.name}</span>
                        <span class="stat-value">${stats[game.id]?.played || 0} مرة</span>
                        <span class="stat-wins">${stats[game.id]?.wins || 0} فوز</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Start a game
    async startGame(gameId) {
        if (!Auth.hasPartner()) {
            Notifications.show('يجب ربط شريكك أولاً للعب!', 'warning');
            Modals.open('link-partner');
            return;
        }

        const gameDef = CONSTANTS.GAMES.find(g => g.id === gameId);
        if (!gameDef) return;

        this.currentGame = gameDef;

        // Create game state in Supabase
        const gameState = {
            couple_id: Auth.getCurrentUser().couple_id,
            game_id: gameId,
            current_turn: Auth.getCurrentUser().id,
            player1_answers: {},
            player2_answers: {},
            status: 'waiting',
            created_at: new Date().toISOString()
        };

        const result = await Sync.supabaseSaveData('shared_game_state', gameState);

        if (result.success || result.offline) {
            this.gameState = gameState;
            this.renderGameInterface(gameId);

            // Notify partner
            Notifications.show(`بدأت لعبة "${gameDef.name}"! انتظر شريكك...`, 'game');

            // Subscribe to game changes
            this.subscribeToGame(gameState.id);
        }
    },

    // Subscribe to game state changes
    async subscribeToGame(gameId) {
        if (!gameId) return;

        supabase
            .channel(`game_${gameId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'shared_game_state',
                filter: `id=eq.${gameId}`
            }, (payload) => {
                this.handleGameUpdate(payload.new);
            })
            .subscribe();
    },

    // Handle game state update
    handleGameUpdate(newState) {
        this.gameState = newState;

        if (newState.status === 'finished') {
            this.showGameResults();
        } else if (newState.current_turn === Auth.getCurrentUser().id) {
            Notifications.show('دورك الآن!', 'game');
            this.updateGameInterface();
        }
    },

    // Render game interface
    renderGameInterface(gameId) {
        const modal = document.getElementById('game-modal');
        const gameDef = CONSTANTS.GAMES.find(g => g.id === gameId);

        modal.innerHTML = `
            <div class="modal-content game-modal">
                <div class="modal-header">
                    <h2>${gameDef.icon} ${gameDef.name}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="game-status">
                        <div class="player-status">
                            <span class="player-avatar">${Auth.getCurrentUser()?.avatar || '👤'}</span>
                            <span class="player-name">أنت</span>
                            <span class="player-score" id="player1-score">0</span>
                        </div>
                        <div class="vs">VS</div>
                        <div class="player-status">
                            <span class="player-avatar">${Auth.getCurrentPartner()?.avatar || '👤'}</span>
                            <span class="player-name">${Auth.getCurrentPartner()?.name || 'شريكك'}</span>
                            <span class="player-score" id="player2-score">0</span>
                        </div>
                    </div>
                    <div class="game-area" id="game-area">
                        ${this.getGameContent(gameId)}
                    </div>
                </div>
            </div>
        `;

        Modals.open('game-modal');
        this.attachGameListeners(gameId);
    },

    // Get game-specific content
    getGameContent(gameId) {
        const gameDef = CONSTANTS.GAMES.find(g => g.id === gameId);

        switch (gameId) {
            case 'know_your_partner':
                return this.renderKnowYourPartner(gameDef);
            case 'me_or_you':
                return this.renderMeOrYou(gameDef);
            case 'first_time':
                return this.renderFirstTime(gameDef);
            case 'build_our_home':
                return this.renderBuildOurHome(gameDef);
            case 'quick_questions':
                return this.renderQuickQuestions(gameDef);
            case 'future_predictions':
                return this.renderFuturePredictions(gameDef);
            default:
                return '<p>اللعبة قيد التطوير</p>';
        }
    },

    // Render "Know Your Partner" game
    renderKnowYourPartner(gameDef) {
        const currentQ = this.gameState?.currentQuestion || 0;
        const question = gameDef.questions[currentQ];

        if (!question) {
            return '<div class="game-complete"><h3>اكتملت اللعبة!</h3><button class="btn-primary" onclick="Games.showResults()">عرض النتائج</button></div>';
        }

        return `
            <div class="quiz-game">
                <div class="question-counter">سؤال ${currentQ + 1} من ${gameDef.questions.length}</div>
                <div class="question-text">${question.q}</div>
                <div class="options-grid">
                    ${question.options.map((opt, i) => `
                        <button class="option-btn" data-answer="${i}">${opt}</button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // Render "Me or You" game
    renderMeOrYou(gameDef) {
        const currentT = this.gameState?.currentTrait || 0;
        const trait = gameDef.traits[currentT];

        if (!trait) {
            return '<div class="game-complete"><h3>اكتملت اللعبة!</h3><button class="btn-primary" onclick="Games.showResults()">عرض النتائج</button></div>';
        }

        return `
            <div class="comparison-game">
                <div class="trait-counter">صفة ${currentT + 1} من ${gameDef.traits.length}</div>
                <div class="trait-text">${trait.trait}</div>
                <div class="comparison-options">
                    <button class="comparison-btn" data-answer="0">${trait.options[0]}</button>
                    <button class="comparison-btn" data-answer="1">${trait.options[1]}</button>
                </div>
            </div>
        `;
    },

    // Render "First Time" game
    renderFirstTime(gameDef) {
        const currentQ = this.gameState?.currentQuestion || 0;
        const question = gameDef.questions[currentQ];

        if (!question) {
            return '<div class="game-complete"><h3>اكتملت اللعبة!</h3><button class="btn-primary" onclick="Games.showResults()">عرض النتائج</button></div>';
        }

        return `
            <div class="memory-game">
                <div class="question-counter">سؤال ${currentQ + 1} من ${gameDef.questions.length}</div>
                <div class="question-text">${question.q}</div>
                <textarea class="answer-input" placeholder="اكتب إجابتك هنا..." rows="4"></textarea>
                <button class="btn-submit-answer">إرسال الإجابة</button>
            </div>
        `;
    },

    // Render "Build Our Home" game
    renderBuildOurHome(gameDef) {
        const currentC = this.gameState?.currentChoice || 0;
        const choice = gameDef.choices[currentC];

        if (!choice) {
            return '<div class="game-complete"><h3>اكتملت اللعبة!</h3><button class="btn-primary" onclick="Games.showResults()">عرض النتائج</button></div>';
        }

        return `
            <div class="choice-game">
                <div class="choice-counter">اختيار ${currentC + 1} من ${gameDef.choices.length}</div>
                <div class="choice-category">${choice.category}</div>
                <div class="choices-grid">
                    ${choice.options.map((opt, i) => `
                        <button class="choice-btn" data-answer="${i}">${opt}</button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // Render "Quick Questions" game
    renderQuickQuestions(gameDef) {
        return `
            <div class="speed-game">
                <div class="timer">⏱️ <span id="game-timer">${gameDef.timeLimit}</span> ثانية</div>
                <div class="question-area" id="speed-question"></div>
                <input type="text" class="speed-answer" placeholder="اكتب إجابتك..." autocomplete="off">
                <div class="speed-score">النقاط: <span id="speed-score">0</span></div>
            </div>
        `;
    },

    // Render "Future Predictions" game
    renderFuturePredictions(gameDef) {
        const currentQ = this.gameState?.currentQuestion || 0;
        const question = gameDef.questions[currentQ];

        if (!question) {
            return '<div class="game-complete"><h3>اكتملت اللعبة!</h3><button class="btn-primary" onclick="Games.showResults()">عرض النتائج</button></div>';
        }

        return `
            <div class="future-game">
                <div class="question-counter">سؤال ${currentQ + 1} من ${gameDef.questions.length}</div>
                <div class="question-text">${question.q}</div>
                ${question.type === 'number' 
                    ? `<input type="number" class="answer-input" placeholder="أدخل رقم...">`
                    : `<textarea class="answer-input" placeholder="اكتب إجابتك هنا..." rows="4"></textarea>`
                }
                <button class="btn-submit-answer">إرسال الإجابة</button>
            </div>
        `;
    },

    // Attach game-specific listeners
    attachGameListeners(gameId) {
        const gameArea = document.getElementById('game-area');

        gameArea.addEventListener('click', async (e) => {
            if (e.target.classList.contains('option-btn')) {
                await this.submitAnswer(parseInt(e.target.dataset.answer));
            } else if (e.target.classList.contains('comparison-btn')) {
                await this.submitAnswer(parseInt(e.target.dataset.answer));
            } else if (e.target.classList.contains('choice-btn')) {
                await this.submitAnswer(parseInt(e.target.dataset.answer));
            } else if (e.target.classList.contains('btn-submit-answer')) {
                const input = gameArea.querySelector('.answer-input');
                await this.submitAnswer(input.value);
            }
        });
    },

    // Submit answer
    async submitAnswer(answer) {
        const userId = Auth.getCurrentUser().id;
        const isPlayer1 = this.gameState.current_turn === userId;

        if (isPlayer1) {
            this.gameState.player1_answers[this.gameState.currentQuestion || 0] = answer;
            this.gameState.current_turn = Auth.getCurrentPartner().id;
        } else {
            this.gameState.player2_answers[this.gameState.currentQuestion || 0] = answer;
            this.gameState.current_turn = Auth.getCurrentUser().id;
            this.gameState.currentQuestion = (this.gameState.currentQuestion || 0) + 1;
        }

        // Update in Supabase
        await Sync.supabaseUpdateData('shared_game_state', this.gameState.id, {
            player1_answers: this.gameState.player1_answers,
            player2_answers: this.gameState.player2_answers,
            current_turn: this.gameState.current_turn,
            currentQuestion: this.gameState.currentQuestion
        });

        // Check if game is complete
        const gameDef = CONSTANTS.GAMES.find(g => g.id === this.currentGame.id);
        const totalQuestions = gameDef.questions?.length || gameDef.traits?.length || gameDef.choices?.length;

        if (this.gameState.currentQuestion >= totalQuestions) {
            this.gameState.status = 'finished';
            await Sync.supabaseUpdateData('shared_game_state', this.gameState.id, {
                status: 'finished',
                result: this.calculateResults()
            });
            this.showGameResults();
        } else {
            this.renderGameInterface(this.currentGame.id);
            Notifications.show('تم إرسال إجابتك! انتظر شريكك...', 'info');
        }
    },

    // Calculate game results
    calculateResults() {
        const p1Answers = Object.values(this.gameState.player1_answers);
        const p2Answers = Object.values(this.gameState.player2_answers);

        let matches = 0;
        const total = Math.min(p1Answers.length, p2Answers.length);

        for (let i = 0; i < total; i++) {
            if (p1Answers[i] === p2Answers[i]) matches++;
        }

        const percentage = total > 0 ? Math.round((matches / total) * 100) : 0;

        return {
            player1_score: p1Answers.length,
            player2_score: p2Answers.length,
            matches,
            total,
            percentage,
            winner: percentage >= 70 ? 'both' : (p1Answers.length > p2Answers.length ? 'player1' : 'player2')
        };
    },

    // Show game results
    showGameResults() {
        const result = this.gameState.result || this.calculateResults();
        const gameArea = document.getElementById('game-area');

        gameArea.innerHTML = `
            <div class="game-results">
                <h3>نتائج اللعبة</h3>
                <div class="compatibility-score">
                    <div class="score-circle" style="--score: ${result.percentage}">
                        <span class="score-value">${result.percentage}%</span>
                    </div>
                    <p class="score-label">نسبة التوافق</p>
                </div>
                <div class="results-details">
                    <div class="result-item">
                        <span>إجاباتك: ${result.player1_score}</span>
                    </div>
                    <div class="result-item">
                        <span>إجابات شريكك: ${result.player2_score}</span>
                    </div>
                    <div class="result-item">
                        <span>الإجابات المتطابقة: ${result.matches}</span>
                    </div>
                </div>
                <div class="result-message">
                    ${result.percentage >= 80 ? 'توافق رائع! أنتما حقاً متماسكان 💕' :
                      result.percentage >= 60 ? 'توافق جيد! استمرا في التعرف على بعضكما 💑' :
                      'تحتاجان للمزيد من التعرف على بعضكما! 💪'}
                </div>
                <button class="btn-primary" onclick="Games.closeGame()">إغلاق</button>
            </div>
        `;

        // Save to history
        this.saveGameHistory(result);

        // Award achievements
        if (result.percentage >= 80) {
            Achievements.unlock('ach007');
        }
    },

    // Save game history
    saveGameHistory(result) {
        const history = Storage.getGameHistory();
        history.push({
            game_id: this.currentGame.id,
            game_name: this.currentGame.name,
            date: new Date().toISOString(),
            result,
            winner: result.winner === 'both' ? 'both' : 
                    (result.winner === 'player1' ? Auth.getCurrentUser().id : Auth.getCurrentPartner()?.id),
            synced: false
        });
        Storage.saveGameHistory(history);
    },

    // Close game modal
    closeGame() {
        Modals.close('game-modal');
        this.currentGame = null;
        this.gameState = null;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Games;
}
