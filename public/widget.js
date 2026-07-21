// AI Chatbot Widget - Embeddable Script
(function() {
  'use strict';

  const ChatBotWidget = {
    config: {
      userId: null,
      primaryColor: '#2563eb',
      welcomeMessage: 'Hello! How can I help you today?',
      model: 'openai/gpt-3.5-turbo',
      autoOpenDelay: 3000,
      businessName: 'AI Assistant',
      botName: 'AI Assistant',
      leadFormEnabled: true
    },

    state: {
      isOpen: false,
      isInitialized: false,
      messages: [],
      conversationId: null,
      visitorId: null,
      isLoading: false,
      hasNotified: false,
      userHasInteracted: false,
      formSubmitted: false,
      visitorName: null,
      visitorPurpose: null
    },

    // Generate unique visitor ID
    generateVisitorId() {
      let id = localStorage.getItem('chatbot_visitor_id');
      if (!id) {
        id = 'visitor_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('chatbot_visitor_id', id);
      }
      return id;
    },

    // Check if form was already submitted for this visitor
    checkFormSubmitted() {
      const key = `chatbot_form_${this.config.userId}_${this.state.visitorId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.state.formSubmitted = true;
          this.state.conversationId = data.conversationId;
          this.state.visitorName = data.name;
          this.state.visitorPurpose = data.purpose;
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },

    // Save form submission to localStorage
    saveFormSubmitted(conversationId, name, purpose) {
      const key = `chatbot_form_${this.config.userId}_${this.state.visitorId}`;
      localStorage.setItem(key, JSON.stringify({ conversationId, name, purpose }));
    },

    // Analyze conversation for intent (silent - no console errors)
    async analyzeConversation() {
      if (!this.state.conversationId || this.state.messages.length < 2) return;

      try {
        await fetch(this.getApiUrl('/api/leads/analyze'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.config.userId,
            conversationId: this.state.conversationId,
            messages: this.state.messages
          })
        });
      } catch (e) {
        // Silent fail - analysis is optional
      }
    },

    getApiUrl(path) {
      // Use the script's origin for API calls
      const scripts = document.getElementsByTagName('script');
      for (let script of scripts) {
        if (script.src && script.src.includes('widget.js')) {
          const url = new URL(script.src);
          return url.origin + path;
        }
      }
      return path;
    },

    getLogoUrl() {
      // Get the logo URL from the same origin as the widget script
      return this.getApiUrl('/uplync.svg');
    },

    async init(options) {
      Object.assign(this.config, options);
      this.state.visitorId = this.generateVisitorId();

      // Validate domain with server
      try {
        const response = await fetch(this.getApiUrl('/api/widget/init'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.config.userId,
            domain: window.location.hostname
          })
        });

        const data = await response.json();

        if (!data.allowed) {
          console.error('Chatbot widget not authorized for this domain');
          return;
        }

        // Update config with server data
        if (data.businessName) this.config.businessName = data.businessName;
        if (data.botName) this.config.botName = data.botName;
        if (data.welcomeMessage) this.config.welcomeMessage = data.welcomeMessage;
        if (data.primaryColor) this.config.primaryColor = data.primaryColor;
        if (typeof data.leadFormEnabled === 'boolean') this.config.leadFormEnabled = data.leadFormEnabled;

      } catch (error) {
        console.error('Failed to initialize widget:', error);
        // Continue anyway for development
      }

      // Check if form was already submitted
      this.checkFormSubmitted();

      this.injectStyles();
      this.createWidget();
      this.state.isInitialized = true;

      // If lead form is disabled, skip it entirely and go straight to chat
      if (!this.config.leadFormEnabled) {
        this.showChatInterface();
        this.state.messages.push({
          role: 'assistant',
          content: this.config.welcomeMessage
        });
        this.renderMessages();
      } else if (this.state.formSubmitted) {
        // If form already submitted, show chat directly with welcome
        this.showChatInterface();
        const welcomeName = this.state.visitorName ? `, ${this.state.visitorName}` : '';
        this.state.messages.push({
          role: 'assistant',
          content: `Welcome back${welcomeName}! How can I help you today?`
        });
        this.renderMessages();
      }

      // Auto-open after delay with visual notification only (no sound)
      if (this.config.autoOpenDelay > 0) {
        setTimeout(() => {
          if (!this.state.isOpen && !this.state.hasNotified) {
            this.state.hasNotified = true;
            this.showNotificationBadge();

            // Auto-open after showing notification
            setTimeout(() => {
              if (!this.state.isOpen) {
                this.open();
              }
            }, 1000);
          }
        }, this.config.autoOpenDelay);
      }

      // Analyze on page unload
      window.addEventListener('beforeunload', () => {
        this.analyzeConversation();
      });
    },

    showNotificationBadge() {
      const badge = document.getElementById('chatbot-notification-badge');
      if (badge) {
        badge.style.display = 'flex';
        badge.classList.add('chatbot-pulse');
      }
    },

    hideNotificationBadge() {
      const badge = document.getElementById('chatbot-notification-badge');
      if (badge) {
        badge.style.display = 'none';
      }
    },

    injectStyles() {
      const styles = `
        #chatbot-widget-container * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }

        #chatbot-widget-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
        }

        #chatbot-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
        }

        #chatbot-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }

        #chatbot-button svg {
          width: 28px;
          height: 28px;
          fill: white;
        }

        #chatbot-button img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
        }

        #chatbot-notification-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 20px;
          height: 20px;
          background: #ef4444;
          border-radius: 50%;
          display: none;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .chatbot-pulse {
          animation: chatbot-pulse-animation 1.5s infinite;
        }

        @keyframes chatbot-pulse-animation {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        #chatbot-window {
          display: none;
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 370px;
          height: 520px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 5px 40px rgba(0,0,0,0.16);
          overflow: hidden;
          flex-direction: column;
        }

        #chatbot-window.open {
          display: flex;
          animation: chatbot-slide-up 0.3s ease;
        }

        @keyframes chatbot-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        #chatbot-header {
          background: ${this.config.primaryColor};
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        #chatbot-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        #chatbot-avatar {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #chatbot-avatar svg {
          width: 24px;
          height: 24px;
          fill: white;
        }

        #chatbot-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        #chatbot-title {
          font-weight: 600;
          font-size: 15px;
        }

        #chatbot-status {
          font-size: 12px;
          opacity: 0.8;
        }

        #chatbot-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        #chatbot-close:hover {
          opacity: 1;
        }

        /* Lead Capture Form Styles */
        #chatbot-lead-form {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }

        #chatbot-lead-form h3 {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        #chatbot-lead-form p {
          margin: 0 0 16px;
          font-size: 13px;
          color: #6b7280;
        }

        .chatbot-form-group {
          margin-bottom: 12px;
        }

        .chatbot-form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 4px;
        }

        .chatbot-form-group label .chatbot-optional {
          font-weight: 400;
          color: #9ca3af;
          font-size: 12px;
        }

        .chatbot-form-group input,
        .chatbot-form-group select {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          background: white;
        }

        .chatbot-form-group input:focus,
        .chatbot-form-group select:focus {
          border-color: ${this.config.primaryColor};
          box-shadow: 0 0 0 2px ${this.config.primaryColor}22;
        }

        .chatbot-form-group .chatbot-field-error {
          color: #dc2626;
          font-size: 12px;
          margin-top: 3px;
          display: none;
        }

        .chatbot-form-group.has-error input,
        .chatbot-form-group.has-error select {
          border-color: #dc2626;
        }

        .chatbot-form-group.has-error .chatbot-field-error {
          display: block;
        }

        #chatbot-form-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 12px;
          display: none;
        }

        #chatbot-form-submit {
          width: 100%;
          padding: 11px;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
          margin-top: 4px;
        }

        #chatbot-form-submit:hover {
          opacity: 0.9;
        }

        #chatbot-form-submit:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        /* Chat area styles */
        #chatbot-chat-area {
          display: none;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        #chatbot-chat-area.active {
          display: flex;
        }

        #chatbot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .chatbot-message {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .chatbot-message.user {
          background: ${this.config.primaryColor};
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }

        .chatbot-message.assistant {
          background: #f3f4f6;
          color: #1f2937;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }

        .chatbot-typing {
          display: flex;
          gap: 4px;
          padding: 12px 14px;
        }

        .chatbot-typing span {
          width: 8px;
          height: 8px;
          background: #9ca3af;
          border-radius: 50%;
          animation: chatbot-bounce 1.4s infinite ease-in-out;
        }

        .chatbot-typing span:nth-child(1) { animation-delay: 0s; }
        .chatbot-typing span:nth-child(2) { animation-delay: 0.2s; }
        .chatbot-typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes chatbot-bounce {
          0%, 80%, 100% { transform: scale(0.8); }
          40% { transform: scale(1.2); }
        }

        #chatbot-input-form {
          padding: 12px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
          background: #ffffff;
        }

        #chatbot-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        #chatbot-input:focus {
          border-color: ${this.config.primaryColor};
        }

        #chatbot-input:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        #chatbot-send {
          padding: 10px 16px;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        #chatbot-send:hover {
          opacity: 0.9;
        }

        #chatbot-send:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        @media (max-width: 400px) {
          #chatbot-window {
            width: calc(100vw - 40px);
            height: calc(100vh - 100px);
            bottom: 70px;
            right: 0;
          }
        }
      `;

      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    },

    createWidget() {
      const container = document.createElement('div');
      container.id = 'chatbot-widget-container';

      const logoUrl = this.getLogoUrl();

      container.innerHTML = `
        <div id="chatbot-window">
          <div id="chatbot-header">
            <div id="chatbot-header-info">
              <div id="chatbot-avatar">
                <img src="${logoUrl}" alt="Uplync" onerror="this.style.display='none'">
              </div>
              <div>
                <div id="chatbot-title">${this.config.botName}</div>
                <div id="chatbot-status">Online</div>
              </div>
            </div>
            <button id="chatbot-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Lead Capture Form -->
          <div id="chatbot-lead-form" style="${this.config.leadFormEnabled ? '' : 'display:none;'}">
            <h3>Start a conversation</h3>
            <p>Please share your details so we can assist you better.</p>

            <div id="chatbot-form-error"></div>

            <div class="chatbot-form-group">
              <label for="chatbot-form-name">Name *</label>
              <input type="text" id="chatbot-form-name" placeholder="Your name" autocomplete="name">
              <div class="chatbot-field-error">Please enter your name</div>
            </div>

            <div class="chatbot-form-group">
              <label for="chatbot-form-email">Email *</label>
              <input type="email" id="chatbot-form-email" placeholder="you@example.com" autocomplete="email">
              <div class="chatbot-field-error">Please enter a valid email</div>
            </div>

            <div class="chatbot-form-group">
              <label for="chatbot-form-phone">Phone <span class="chatbot-optional">(optional)</span></label>
              <input type="tel" id="chatbot-form-phone" placeholder="Your phone number" autocomplete="tel">
            </div>

            <div class="chatbot-form-group">
              <label for="chatbot-form-purpose">How can we help? *</label>
              <select id="chatbot-form-purpose">
                <option value="">Select a topic...</option>
                <option value="Want to see pricing">Want to see pricing</option>
                <option value="Interested in features">Interested in features</option>
                <option value="Technical support">Technical support</option>
                <option value="General inquiry">General inquiry</option>
                <option value="Partnership opportunity">Partnership opportunity</option>
              </select>
              <div class="chatbot-field-error">Please select a topic</div>
            </div>

            <button id="chatbot-form-submit" type="button">Start Chat</button>
          </div>

          <!-- Chat Interface (hidden until form submitted) -->
          <div id="chatbot-chat-area" class="${this.config.leadFormEnabled ? '' : 'active'}">
            <div id="chatbot-messages"></div>
            <form id="chatbot-input-form">
              <input type="text" id="chatbot-input" placeholder="Type a message..." autocomplete="off">
              <button type="submit" id="chatbot-send">Send</button>
            </form>
          </div>
        </div>
        <button id="chatbot-button">
          <img src="${logoUrl}" alt="Chat" onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\'><path d=\\'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z\\'/></svg>'">
          <span id="chatbot-notification-badge">1</span>
        </button>
      `;

      document.body.appendChild(container);

      // Event listeners
      document.getElementById('chatbot-button').addEventListener('click', () => this.toggle());
      document.getElementById('chatbot-close').addEventListener('click', () => this.close());
      document.getElementById('chatbot-input-form').addEventListener('submit', (e) => this.handleSubmit(e));
      document.getElementById('chatbot-form-submit').addEventListener('click', () => this.handleFormSubmit());

      // Mark conversation as closed when user leaves the page
      window.addEventListener('beforeunload', () => {
        if (this.state.conversationId) {
          // Use sendBeacon for reliable delivery during page unload
          const url = this.getApiUrl('/api/widget/close');
          const data = JSON.stringify({ conversationId: this.state.conversationId });
          if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
          } else {
            fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: data,
              keepalive: true
            });
          }
        }
      });
    },

    // Show chat interface (hide form)
    showChatInterface() {
      const form = document.getElementById('chatbot-lead-form');
      const chat = document.getElementById('chatbot-chat-area');
      if (form) form.style.display = 'none';
      if (chat) chat.classList.add('active');
    },

    // Validate and submit the lead capture form
    async handleFormSubmit() {
      const nameInput = document.getElementById('chatbot-form-name');
      const emailInput = document.getElementById('chatbot-form-email');
      const phoneInput = document.getElementById('chatbot-form-phone');
      const purposeInput = document.getElementById('chatbot-form-purpose');
      const submitBtn = document.getElementById('chatbot-form-submit');
      const errorDiv = document.getElementById('chatbot-form-error');

      // Clear previous errors
      document.querySelectorAll('.chatbot-form-group').forEach(g => g.classList.remove('has-error'));
      errorDiv.style.display = 'none';

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const purpose = purposeInput.value;

      // Frontend validation
      let hasError = false;

      if (!name) {
        nameInput.closest('.chatbot-form-group').classList.add('has-error');
        hasError = true;
      }

      if (!email || !email.includes('@') || !email.includes('.')) {
        emailInput.closest('.chatbot-form-group').classList.add('has-error');
        hasError = true;
      }

      if (!purpose) {
        purposeInput.closest('.chatbot-form-group').classList.add('has-error');
        hasError = true;
      }

      if (hasError) return;

      // Submit form
      submitBtn.disabled = true;
      submitBtn.textContent = 'Starting...';

      try {
        const response = await fetch(this.getApiUrl('/api/widget/submit-form'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.config.userId,
            visitorId: this.state.visitorId,
            name,
            email,
            phone: phone || null,
            purpose,
            sourcePageUrl: window.location.href
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit form');
        }

        // Success - save state and show chat
        this.state.formSubmitted = true;
        this.state.conversationId = data.conversationId;
        this.state.visitorName = name;
        this.state.visitorPurpose = purpose;

        // Remember in localStorage
        this.saveFormSubmitted(data.conversationId, name, purpose);

        // Switch to chat interface
        this.showChatInterface();

        // Add personalized welcome message
        this.state.messages.push({
          role: 'assistant',
          content: `Hi ${name}! Thanks for reaching out. I see you're interested in "${purpose}". How can I help you with that?`
        });
        this.renderMessages();

      } catch (error) {
        console.error('Form submission error:', error);
        errorDiv.textContent = error.message || 'Something went wrong. Please try again.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Start Chat';
      }
    },

    open() {
      this.state.isOpen = true;
      document.getElementById('chatbot-window').classList.add('open');
      document.getElementById('chatbot-button').style.display = 'none';
      this.hideNotificationBadge();

      // Focus appropriate input
      if (this.state.formSubmitted) {
        const chatInput = document.getElementById('chatbot-input');
        if (chatInput) chatInput.focus();
      } else {
        const nameInput = document.getElementById('chatbot-form-name');
        if (nameInput) nameInput.focus();
      }
    },

    close() {
      this.state.isOpen = false;
      document.getElementById('chatbot-window').classList.remove('open');
      document.getElementById('chatbot-button').style.display = 'flex';

      // Analyze conversation when closing
      if (this.state.messages.length > 1) {
        this.analyzeConversation();
      }

      // Mark conversation as closed
      if (this.state.conversationId) {
        try {
          fetch(this.getApiUrl('/api/widget/close'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: this.state.conversationId
            })
          });
        } catch (e) {
          // Silent fail
        }
      }
    },

    toggle() {
      if (this.state.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    renderMessages() {
      const container = document.getElementById('chatbot-messages');
      if (!container) return;
      container.innerHTML = '';

      this.state.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `chatbot-message ${msg.role}`;
        div.textContent = msg.content;
        container.appendChild(div);
      });

      if (this.state.isLoading) {
        const typing = document.createElement('div');
        typing.className = 'chatbot-message assistant chatbot-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(typing);
      }

      container.scrollTop = container.scrollHeight;
    },

    async handleSubmit(e) {
      e.preventDefault();

      const input = document.getElementById('chatbot-input');
      const text = input.value.trim();

      if (!text || this.state.isLoading) return;

      input.value = '';

      // Add user message
      this.state.messages.push({ role: 'user', content: text });
      this.state.isLoading = true;
      this.renderMessages();

      try {
        const response = await fetch(this.getApiUrl('/api/widget/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.config.userId,
            visitorId: this.state.visitorId,
            conversationId: this.state.conversationId,
            message: text,
            model: this.config.model,
            sourcePageUrl: window.location.href,
            chatPurpose: this.state.visitorPurpose
          })
        });

        const data = await response.json();

        if (data.conversationId) {
          this.state.conversationId = data.conversationId;
        }

        const aiMessage = data.message || 'Sorry, I encountered an error. Please try again.';
        this.state.messages.push({ role: 'assistant', content: aiMessage });

      } catch (error) {
        console.error('Chat error:', error);
        this.state.messages.push({
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        });
      } finally {
        this.state.isLoading = false;
        this.renderMessages();
      }
    }
  };

  // Expose to global scope
  window.ChatBotWidget = ChatBotWidget;
})();
