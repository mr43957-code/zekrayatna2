// ============================================
// SMART AI CHAT - نسخة نقي خالص (API فقط)
// من غير رسايل ترحيبية ولا ردود احتياطية
// ============================================

// ============================
// الإعدادات
// ============================
const GEMINI_API_KEY = 'AIzaSyDp1yvFeyFv7VQ8em6zrPVAD3d7eTqNXRs';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ============================
// متغيرات الشات
// ============================
let chatTypingTimer = null;
let chatInitialized = false;
let conversationHistory = [];
let isProcessing = false;

// ============================
// شخصية الشات
// ============================
const SYSTEM_PROMPT = `أنت "ذكرياتنا" - صديق مصري لزيز وفكاهي.

شخصيتك:
- بتتكلم مصري بطلاقة (استخدم: يعني، بجد، اوي، خلاص، كده، يلا)
- لطيف وفكاهي وبتستخدم إيموجي (😂 ❤️ 💕 ✨)
- ردودك قصيرة (جملتين على الأكثر)
- كلامك كله بالعامية المصرية`;

// ============================
// دوال الشات الأساسية
// ============================
function initAIChat() {
    if (chatInitialized) return;
    console.log('🤣 AI Chat initialized');
    chatInitialized = true;
    
    const badge = document.getElementById('aiChatBadge');
    if (badge) badge.style.display = 'flex';
}

function toggleAIChat() {
    const chatWindow = document.getElementById('aiChatWindow');
    const chatBtn = document.getElementById('aiChatBtn');
    
    if (chatWindow) {
        chatWindow.classList.toggle('active');
        
        if (chatWindow.classList.contains('active')) {
            chatBtn.innerHTML = '<i class="fas fa-times"></i>';
            const badge = document.getElementById('aiChatBadge');
            if (badge) badge.style.display = 'none';
            setTimeout(scrollToBottom, 100);
        } else {
            chatBtn.innerHTML = '<i class="fas fa-robot"></i>';
            const badge = document.getElementById('aiChatBadge');
            if (badge) {
                badge.style.display = 'flex';
                badge.innerHTML = '✨';
            }
        }
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function escapeHTML(str) {
    return str.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    }).replace(/\n/g, '<br>');
}

function addUserMessage(text) {
    const messagesContainer = document.getElementById('aiChatMessages');
    const now = new Date();
    
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="user-message">
            <div class="user-message-content">
                <p>${escapeHTML(text)}</p>
                <span class="message-time">${formatTime(now)}</span>
            </div>
            <div class="user-avatar">
                <i class="fas fa-user"></i>
            </div>
        </div>
    `);
    
    scrollToBottom();
    conversationHistory.push({ role: 'user', content: text });
}

function addAIMessage(text) {
    const messagesContainer = document.getElementById('aiChatMessages');
    const now = new Date();
    
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="ai-message">
            <div class="ai-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="ai-message-content">
                <p>${escapeHTML(text)}</p>
                <span class="message-time">${formatTime(now)}</span>
            </div>
        </div>
    `);
    
    scrollToBottom();
    conversationHistory.push({ role: 'model', content: text });
}

function showTypingIndicator() {
    removeTypingIndicator();
    
    document.getElementById('aiChatMessages').insertAdjacentHTML('beforeend', `
        <div class="ai-message" id="typingIndicator">
            <div class="ai-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `);
    
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) typingIndicator.remove();
}

function sendUserMessage() {
    if (isProcessing) return;
    
    const input = document.getElementById('aiUserInput');
    const message = input.value.trim();
    
    if (message) {
        isProcessing = true;
        addUserMessage(message);
        getAIResponse(message);
        input.value = '';
    }
}

function sendQuickMessage(message) {
    if (isProcessing) return;
    
    isProcessing = true;
    addUserMessage(message);
    getAIResponse(message);
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendUserMessage();
    }
}

// ============================
// الاتصال بـ Gemini API (الطريقة الوحيدة دلوقتي)
// ============================
async function getAIResponse(userMessage) {
    showTypingIndicator();
    
    try {
        const contents = [
            {
                role: "user",
                parts: [{ text: SYSTEM_PROMPT }]
            },
            {
                role: "model",
                parts: [{ text: "اهلين! اتفضل قول اللي في دماغك 😊" }]
            }
        ];
        
        conversationHistory.slice(-6).forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: 0.95,
                    maxOutputTokens: 300,
                    topP: 0.95,
                    topK: 50
                }
            })
        });
        
        removeTypingIndicator();
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            addAIMessage("آسف يا صاحبي، في مشكلة في الاتصال بالخدمة 😅");
            isProcessing = false;
            return;
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            let aiResponse = data.candidates[0].content.parts[0].text;
            aiResponse = aiResponse.trim();
            addAIMessage(aiResponse);
        } else {
            addAIMessage("آسف، مش فاهمك ممكن توضح تاني؟ 😅");
        }
        
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addAIMessage("في مشكلة تقنية، جرب تكتب تاني بعد شوية 😊");
    } finally {
        isProcessing = false;
    }
}

// ============================
// مسح المحادثة
// ============================
function clearChatHistory() {
    if (confirm('هل أنت متأكد من مسح كل الرسائل؟')) {
        document.getElementById('aiChatMessages').innerHTML = '';
        conversationHistory = [];
        isProcessing = false;
    }
}

// ============================
// إضافة زر المسح بس
// ============================
function addClearButton() {
    const header = document.querySelector('.ai-chat-header');
    if (header) {
        // زر مسح المحادثة
        const clearBtn = document.createElement('button');
        clearBtn.className = 'ai-chat-close';
        clearBtn.style.marginLeft = '10px';
        clearBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        clearBtn.title = 'مسح المحادثة';
        clearBtn.onclick = (e) => { 
            e.stopPropagation(); 
            clearChatHistory(); 
        };
        header.appendChild(clearBtn);
    }
}

// ============================
// تهيئة الشات - مرة واحدة
// ============================
if (!window.chatInitialized) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initAIChat();
            addClearButton();
        }, 1000);
    });
    window.chatInitialized = true;
}

// ============================
// تصدير الدوال
// ============================
window.toggleAIChat = toggleAIChat;
window.sendQuickMessage = sendQuickMessage;
window.sendUserMessage = sendUserMessage;
window.handleChatKeyPress = handleChatKeyPress;
window.clearChatHistory = clearChatHistory;