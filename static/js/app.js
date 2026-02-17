// ============================================
// VoxAI - Voice AI Assistant
// Frontend application logic
// ============================================

(function () {
    'use strict';

    // ---- State ----
    const state = {
        messages: [],
        conversations: [],
        currentConversationId: null,
        isRecording: false,
        isProcessing: false,
        mediaRecorder: null,
        audioChunks: [],
        recognition: null,
        settings: {
            apiEndpoint: 'http://localhost:8000',
            autoSpeak: true,
            darkMode: true,
            speechRate: 1.0,
            temperature: 0.7,
            maxTokens: 512,
            voiceURI: 'default',
        },
    };

    // ---- DOM Elements ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elements = {
        chatArea: $('#chatArea'),
        messagesContainer: $('#messagesContainer'),
        welcomeScreen: $('#welcomeScreen'),
        messageInput: $('#messageInput'),
        sendBtn: $('#sendBtn'),
        micBtn: $('#micBtn'),
        voiceOverlay: $('#voiceOverlay'),
        voiceStatus: $('#voiceStatus'),
        voiceTranscript: $('#voiceTranscript'),
        voiceCancelBtn: $('#voiceCancelBtn'),
        visualizerBars: $('#visualizerBars'),
        newChatBtn: $('#newChatBtn'),
        chatHistory: $('#chatHistory'),
        clearChatBtn: $('#clearChatBtn'),
        menuToggle: $('#menuToggle'),
        settingsBtn: $('#settingsBtn'),
        settingsModal: $('#settingsModal'),
        settingsClose: $('#settingsClose'),
        settingsCancel: $('#settingsCancel'),
        settingsSave: $('#settingsSave'),
        statusIndicator: $('#statusIndicator'),
        apiEndpoint: $('#apiEndpoint'),
        voiceSelect: $('#voiceSelect'),
        speechRate: $('#speechRate'),
        speechRateVal: $('#speechRateVal'),
        temperature: $('#temperature'),
        temperatureVal: $('#temperatureVal'),
        maxTokens: $('#maxTokens'),
        autoSpeak: $('#autoSpeak'),
        darkMode: $('#darkMode'),
    };

    // ---- Initialize ----
    function init() {
        loadSettings();
        applyTheme();
        loadConversations();
        populateVoices();
        setupEventListeners();
        setupSpeechRecognition();
        startNewConversation();
    }

    // ---- Settings ----
    function loadSettings() {
        const saved = localStorage.getItem('voxai-settings');
        if (saved) {
            Object.assign(state.settings, JSON.parse(saved));
        }
    }

    function saveSettings() {
        localStorage.setItem('voxai-settings', JSON.stringify(state.settings));
    }

    function applyTheme() {
        document.documentElement.setAttribute(
            'data-theme',
            state.settings.darkMode ? 'dark' : 'light'
        );
    }

    function openSettings() {
        elements.apiEndpoint.value = state.settings.apiEndpoint;
        elements.speechRate.value = state.settings.speechRate;
        elements.speechRateVal.textContent = state.settings.speechRate + 'x';
        elements.temperature.value = state.settings.temperature;
        elements.temperatureVal.textContent = state.settings.temperature;
        elements.maxTokens.value = state.settings.maxTokens;
        elements.autoSpeak.checked = state.settings.autoSpeak;
        elements.darkMode.checked = state.settings.darkMode;
        elements.settingsModal.classList.add('active');
    }

    function closeSettings() {
        elements.settingsModal.classList.remove('active');
    }

    function applySettings() {
        state.settings.apiEndpoint = elements.apiEndpoint.value.replace(/\/+$/, '');
        state.settings.speechRate = parseFloat(elements.speechRate.value);
        state.settings.temperature = parseFloat(elements.temperature.value);
        state.settings.maxTokens = parseInt(elements.maxTokens.value);
        state.settings.autoSpeak = elements.autoSpeak.checked;
        state.settings.darkMode = elements.darkMode.checked;
        const selectedVoice = elements.voiceSelect.value;
        state.settings.voiceURI = selectedVoice;
        saveSettings();
        applyTheme();
        closeSettings();
    }

    // ---- Conversations ----
    function loadConversations() {
        const saved = localStorage.getItem('voxai-conversations');
        if (saved) {
            state.conversations = JSON.parse(saved);
        }
    }

    function saveConversations() {
        localStorage.setItem('voxai-conversations', JSON.stringify(state.conversations));
    }

    function startNewConversation() {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        state.currentConversationId = id;
        state.messages = [];
        elements.messagesContainer.innerHTML = '';
        elements.welcomeScreen.classList.remove('hidden');
        renderChatHistory();
    }

    function renderChatHistory() {
        const historyLabel = elements.chatHistory.querySelector('.history-label');
        elements.chatHistory.innerHTML = '';
        elements.chatHistory.appendChild(historyLabel);

        state.conversations
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 20)
            .forEach((conv) => {
                const item = document.createElement('div');
                item.className = 'history-item' + (conv.id === state.currentConversationId ? ' active' : '');
                item.textContent = conv.title || 'New conversation';
                item.addEventListener('click', () => loadConversation(conv.id));
                elements.chatHistory.appendChild(item);
            });
    }

    function loadConversation(id) {
        const conv = state.conversations.find((c) => c.id === id);
        if (!conv) return;
        state.currentConversationId = id;
        state.messages = conv.messages || [];
        elements.messagesContainer.innerHTML = '';
        elements.welcomeScreen.classList.add('hidden');
        state.messages.forEach((msg) => renderMessage(msg, false));
        scrollToBottom();
        renderChatHistory();
        closeSidebar();
    }

    function saveCurrentConversation() {
        if (!state.messages.length) return;
        let conv = state.conversations.find((c) => c.id === state.currentConversationId);
        if (!conv) {
            conv = { id: state.currentConversationId, title: '', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
            state.conversations.push(conv);
        }
        conv.messages = state.messages;
        conv.updatedAt = Date.now();
        if (!conv.title && state.messages.length > 0) {
            const firstUser = state.messages.find((m) => m.role === 'user');
            conv.title = firstUser ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '') : 'Conversation';
        }
        saveConversations();
        renderChatHistory();
    }

    // ---- Messages ----
    function addMessage(role, content) {
        const msg = {
            id: Date.now().toString(36),
            role,
            content,
            timestamp: Date.now(),
        };
        state.messages.push(msg);
        elements.welcomeScreen.classList.add('hidden');
        renderMessage(msg, true);
        saveCurrentConversation();
        return msg;
    }

    function renderMessage(msg, animate) {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        if (!animate) div.style.animation = 'none';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = msg.role === 'user' ? 'U' : 'V';

        const content = document.createElement('div');
        content.className = 'message-content';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = msg.content;

        const meta = document.createElement('div');
        meta.className = 'message-meta';

        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatTime(msg.timestamp);

        const actions = document.createElement('div');
        actions.className = 'message-actions';

        if (msg.role === 'assistant') {
            const speakBtn = createActionBtn('Speak', () => speakText(msg.content));
            const copyBtn = createActionBtn('Copy', () => copyText(msg.content));
            actions.appendChild(speakBtn);
            actions.appendChild(copyBtn);
        } else {
            const copyBtn = createActionBtn('Copy', () => copyText(msg.content));
            actions.appendChild(copyBtn);
        }

        meta.appendChild(time);
        meta.appendChild(actions);
        content.appendChild(bubble);
        content.appendChild(meta);
        div.appendChild(avatar);
        div.appendChild(content);

        elements.messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function createActionBtn(label, onClick) {
        const btn = document.createElement('button');
        btn.className = 'msg-action-btn';
        btn.title = label;
        btn.textContent = label === 'Speak' ? '🔊' : '📋';
        btn.addEventListener('click', onClick);
        return btn;
    }

    function showTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.id = 'typingIndicator';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = 'V';

        const content = document.createElement('div');
        content.className = 'message-content';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        const typing = document.createElement('div');
        typing.className = 'typing-indicator';
        typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

        bubble.appendChild(typing);
        content.appendChild(bubble);
        div.appendChild(avatar);
        div.appendChild(content);

        elements.messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    // ---- API Communication ----
    async function sendToModel(userMessage) {
        setStatus('processing');
        showTypingIndicator();

        // Build conversation context (last 10 messages for context window)
        const context = state.messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
        }));

        try {
            const response = await fetch(`${state.settings.apiEndpoint}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'personalplex-7b',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are VoxAI, a helpful and friendly voice assistant powered by the PersonalPlex 7B model. Keep responses conversational and concise since they may be spoken aloud. Be warm but direct.',
                        },
                        ...context,
                    ],
                    temperature: state.settings.temperature,
                    max_tokens: state.settings.maxTokens,
                    stream: false,
                }),
            });

            removeTypingIndicator();

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

            const assistantMsg = addMessage('assistant', reply);

            if (state.settings.autoSpeak) {
                speakText(reply);
            }

            setStatus('online');
        } catch (err) {
            removeTypingIndicator();
            console.error('API error:', err);

            // Fallback: generate a local response if server is unreachable
            const fallback = generateFallbackResponse(userMessage);
            addMessage('assistant', fallback);

            if (state.settings.autoSpeak) {
                speakText(fallback);
            }

            setStatus('online');
        }
    }

    function generateFallbackResponse(input) {
        const lower = input.toLowerCase();
        const responses = [
            "I'm currently running in offline mode since the PersonalPlex 7B server isn't reachable. Please make sure the server is running at " + state.settings.apiEndpoint,
            "It seems the model server is offline. You can start it by running `python server.py` in the project directory.",
            "I can't reach the AI backend right now. Check that the server is running and the API endpoint in settings is correct.",
        ];

        if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
            return "Hey there! I'm VoxAI. The model server doesn't seem to be running right now, but once you start it up I'll be fully functional. Run `python server.py` to get started!";
        }
        if (lower.includes('help') || lower.includes('what can you')) {
            return "I'm VoxAI, your voice AI assistant! I can chat with you using voice or text, powered by the PersonalPlex 7B model. To get started, make sure the backend server is running with `python server.py`.";
        }

        return responses[Math.floor(Math.random() * responses.length)];
    }

    // ---- Speech Recognition ----
    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            return;
        }

        state.recognition = new SpeechRecognition();
        state.recognition.continuous = true;
        state.recognition.interimResults = true;
        state.recognition.lang = 'en-US';

        state.recognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) isFinal = true;
            }
            elements.voiceTranscript.textContent = transcript;

            if (isFinal) {
                stopRecording();
                if (transcript.trim()) {
                    addMessage('user', transcript.trim());
                    sendToModel(transcript.trim());
                }
            }
        };

        state.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();
            if (event.error === 'not-allowed') {
                addMessage('assistant', 'Microphone access was denied. Please allow microphone access in your browser settings to use voice input.');
            }
        };

        state.recognition.onend = () => {
            if (state.isRecording) {
                stopRecording();
            }
        };
    }

    function startRecording() {
        if (!state.recognition) {
            addMessage('assistant', "Voice input isn't supported in this browser. Try Chrome or Edge for the best experience.");
            return;
        }

        state.isRecording = true;
        elements.micBtn.classList.add('recording');
        elements.voiceOverlay.classList.add('active');
        elements.voiceTranscript.textContent = '';
        elements.voiceStatus.textContent = 'Listening...';
        setStatus('recording');

        // Animate bars with audio
        animateVisualizerBars();

        try {
            state.recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
            stopRecording();
        }
    }

    function stopRecording() {
        state.isRecording = false;
        elements.micBtn.classList.remove('recording');
        elements.voiceOverlay.classList.remove('active');
        setStatus('online');

        try {
            state.recognition?.stop();
        } catch (e) {
            // ignore
        }
    }

    function animateVisualizerBars() {
        if (!state.isRecording) return;

        const bars = elements.visualizerBars.querySelectorAll('.bar');
        bars.forEach((bar) => {
            const height = Math.random() * 50 + 10;
            bar.style.height = height + 'px';
        });

        requestAnimationFrame(() => {
            setTimeout(() => animateVisualizerBars(), 100);
        });
    }

    // ---- Text-to-Speech ----
    function speakText(text) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = state.settings.speechRate;

        if (state.settings.voiceURI !== 'default') {
            const voices = window.speechSynthesis.getVoices();
            const selected = voices.find((v) => v.voiceURI === state.settings.voiceURI);
            if (selected) utterance.voice = selected;
        }

        window.speechSynthesis.speak(utterance);
    }

    function populateVoices() {
        function loadVoices() {
            const voices = window.speechSynthesis.getVoices();
            elements.voiceSelect.innerHTML = '<option value="default">System Default</option>';
            voices.forEach((voice) => {
                const opt = document.createElement('option');
                opt.value = voice.voiceURI;
                opt.textContent = `${voice.name} (${voice.lang})`;
                if (voice.voiceURI === state.settings.voiceURI) opt.selected = true;
                elements.voiceSelect.appendChild(opt);
            });
        }

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // ---- UI Helpers ----
    function setStatus(status) {
        const dot = elements.statusIndicator.querySelector('.status-dot');
        dot.className = 'status-dot';

        const labels = { online: 'Ready', recording: 'Listening', processing: 'Thinking...' };
        dot.classList.add(status);
        elements.statusIndicator.querySelector('.status-dot').nextSibling.textContent = '\n' + (labels[status] || 'Ready');
        // Fix: update the text node properly
        const textNode = elements.statusIndicator.childNodes[elements.statusIndicator.childNodes.length - 1];
        if (textNode.nodeType === 3) {
            textNode.textContent = '\n' + (labels[status] || 'Ready');
        }
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
        });
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function copyText(text) {
        navigator.clipboard.writeText(text).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    }

    function closeSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ---- Event Listeners ----
    function setupEventListeners() {
        // Send message
        elements.sendBtn.addEventListener('click', handleSend);
        elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea & toggle send button
        elements.messageInput.addEventListener('input', () => {
            const input = elements.messageInput;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            elements.sendBtn.classList.toggle('active', input.value.trim().length > 0);
        });

        // Mic
        elements.micBtn.addEventListener('click', () => {
            if (state.isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });

        elements.voiceCancelBtn.addEventListener('click', stopRecording);

        // New chat
        elements.newChatBtn.addEventListener('click', () => {
            startNewConversation();
            closeSidebar();
        });

        // Clear chat
        elements.clearChatBtn.addEventListener('click', () => {
            state.messages = [];
            elements.messagesContainer.innerHTML = '';
            elements.welcomeScreen.classList.remove('hidden');
            // Remove from saved conversations
            state.conversations = state.conversations.filter((c) => c.id !== state.currentConversationId);
            saveConversations();
            renderChatHistory();
        });

        // Quick actions
        $$('.quick-action').forEach((btn) => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) {
                    addMessage('user', prompt);
                    sendToModel(prompt);
                }
            });
        });

        // Mobile menu
        elements.menuToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('open');
        });

        // Settings
        elements.settingsBtn.addEventListener('click', openSettings);
        elements.settingsClose.addEventListener('click', closeSettings);
        elements.settingsCancel.addEventListener('click', closeSettings);
        elements.settingsSave.addEventListener('click', applySettings);

        elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) closeSettings();
        });

        // Range inputs live update
        elements.speechRate.addEventListener('input', () => {
            elements.speechRateVal.textContent = parseFloat(elements.speechRate.value).toFixed(1) + 'x';
        });

        elements.temperature.addEventListener('input', () => {
            elements.temperatureVal.textContent = parseFloat(elements.temperature.value).toFixed(1);
        });

        // Keyboard shortcut: Escape closes overlays
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (state.isRecording) stopRecording();
                if (elements.settingsModal.classList.contains('active')) closeSettings();
                closeSidebar();
            }
        });
    }

    function handleSend() {
        const text = elements.messageInput.value.trim();
        if (!text || state.isProcessing) return;

        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
        elements.sendBtn.classList.remove('active');

        addMessage('user', text);
        sendToModel(text);
    }

    // ---- Boot ----
    document.addEventListener('DOMContentLoaded', init);
})();
