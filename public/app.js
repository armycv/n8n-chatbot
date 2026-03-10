(function () {
  const messagesEl = document.getElementById('messages');
  const typingEl = document.getElementById('typing');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const trackContextInput = document.getElementById('trackContext');
  const subTopicContextInput = document.getElementById('subTopicContext');
  const conversationSessionIdInput = document.getElementById('conversationSessionId');
  const getConversationBtn = document.getElementById('getConversationBtn');
  const deleteConversationBtn = document.getElementById('deleteConversationBtn');
  const conversationOverlay = document.getElementById('conversationOverlay');
  const conversationModal = document.getElementById('conversationModal');
  const conversationContent = document.getElementById('conversationContent');
  const conversationCloseBtn = document.getElementById('conversationCloseBtn');

  if (conversationSessionIdInput) conversationSessionIdInput.placeholder = 'Session ID';

  function getSessionId() {
    let id = sessionStorage.getItem('chatSessionId');
    if (!id) {
      id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('chatSessionId', id);
    }
    return id;
  }

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function showError(message) {
    addMessage(message || 'Something went wrong. Please try again.', 'error');
  }

  function setTyping(visible) {
    typingEl.classList.toggle('hidden', !visible);
    typingEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    sendBtn.disabled = visible;
    if (visible) scrollToBottom();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function getReplyFromResponse(data) {
    if (!data) return '';
    // Direct fields
    if (typeof data.response === 'string' && data.response.trim()) return data.response;
    if (typeof data.aiResponse === 'string' && data.aiResponse.trim()) return data.aiResponse;
    if (typeof data.reply === 'string' && data.reply.trim()) return data.reply;
    if (typeof data.text === 'string' && data.text.trim()) return data.text;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data.output === 'string' && data.output.trim()) return data.output;
    if (typeof data === 'string' && data.trim()) {
      try {
        var parsed = JSON.parse(data);
        return getReplyFromResponse(parsed) || data;
      } catch (_) {
        return data;
      }
    }
    // Nested: body / data (e.g. n8n wrapper)
    if (data.body && typeof data.body === 'object') return getReplyFromResponse(data.body);
    if (data.data && typeof data.data === 'object') return getReplyFromResponse(data.data);
    // Array (e.g. first item)
    if (Array.isArray(data) && data.length) return getReplyFromResponse(data[0]);
    return '';
  }

  function openConversationModal() {
    if (conversationOverlay) {
      conversationOverlay.classList.remove('hidden');
      conversationOverlay.setAttribute('aria-hidden', 'false');
    }
  }

  function closeConversationModal() {
    if (conversationOverlay) {
      conversationOverlay.classList.add('hidden');
      conversationOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  function renderConversationInModal(data) {
    if (!conversationContent) return;
    conversationContent.innerHTML = '';
    var noConversationMessage = 'No conversation found for that session ID.';
    if (data === '' || (typeof data === 'string' && !data.trim())) {
      var emptyStrMsg = document.createElement('p');
      emptyStrMsg.className = 'message bot';
      emptyStrMsg.textContent = noConversationMessage;
      conversationContent.appendChild(emptyStrMsg);
      return;
    }
    if (data && data.error) {
      var errEl = document.createElement('p');
      errEl.className = 'message error';
      errEl.textContent = data.error;
      conversationContent.appendChild(errEl);
      return;
    }
    if (data && typeof data.message === 'string') {
      var count = data.deletedRowsCount != null ? data.deletedRowsCount : data.deletedCount;
      var p = document.createElement('p');
      p.className = 'message bot';
      p.textContent = count != null && count !== '' ? data.message + ' Deleted rows: ' + count : data.message;
      conversationContent.appendChild(p);
      return;
    }
    var items = Array.isArray(data) ? data : (data && data.data && Array.isArray(data.data) ? data.data : null);
    if (items && items.length) {
      items.forEach(function (item) {
        var userMsg = (item.userMessage != null ? item.userMessage : item.message) || '';
        var botMsg = (item.aiResponse != null ? item.aiResponse : item.reply) || (item.response != null ? item.response : '') || '';
        if (String(userMsg).trim()) {
          var u = document.createElement('div');
          u.className = 'message user';
          u.textContent = userMsg;
          conversationContent.appendChild(u);
        }
        if (String(botMsg).trim()) {
          var b = document.createElement('div');
          b.className = 'message bot';
          b.textContent = botMsg;
          conversationContent.appendChild(b);
        }
      });
      if (conversationContent.children.length === 0) {
        var noConvEl = document.createElement('p');
        noConvEl.className = 'message bot';
        noConvEl.textContent = noConversationMessage;
        conversationContent.appendChild(noConvEl);
      }
    } else if ((Array.isArray(data) && data.length === 0) || (items && items.length === 0) || data == null || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) {
      var emptyMsg = document.createElement('p');
      emptyMsg.className = 'message bot';
      emptyMsg.textContent = noConversationMessage;
      conversationContent.appendChild(emptyMsg);
    } else {
      var pre = document.createElement('pre');
      pre.className = 'conversation-raw';
      pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      conversationContent.appendChild(pre);
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';
    setTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          sessionId: getSessionId(),
          trackContext: (trackContextInput && trackContextInput.value) ? trackContextInput.value.trim() : '',
          subTopicContext: (subTopicContextInput && subTopicContextInput.value) ? subTopicContextInput.value.trim() : '',
        }),
      });

      const data = await res.json().catch(function () {
        return { error: 'Invalid response from server' };
      });

      if (!res.ok) {
        const msg = data.message || data.error || data.details || 'Request failed';
        showError(msg);
        return;
      }

      const reply = getReplyFromResponse(data);
      if (reply) addMessage(reply, 'bot');
      else showError('Bot returned no message. In n8n, set the Respond to Webhook node to send a JSON body with "aiResponse", "reply", or "text".');
    } catch (err) {
      showError('Network error. Check the server and try again.');
    } finally {
      setTyping(false);
    }
  });

  if (getConversationBtn && conversationSessionIdInput) {
    getConversationBtn.addEventListener('click', async function () {
      var sessionId = conversationSessionIdInput.value ? conversationSessionIdInput.value.trim() : '';
      if (!sessionId) {
        sessionId = getSessionId();
        conversationSessionIdInput.value = sessionId;
      }
      if (!sessionId) {
        openConversationModal();
        renderConversationInModal({ error: 'Enter a session ID or start a chat to use the current session.' });
        return;
      }
      getConversationBtn.disabled = true;
      if (conversationContent) conversationContent.innerHTML = '<p class="conversation-loading">Loading…</p>';
      openConversationModal();
      try {
        var res = await fetch('/api/conversation?sessionId=' + encodeURIComponent(sessionId));
        var data = await res.json().catch(function () { return { error: 'Invalid response' }; });
        if (!res.ok) {
          renderConversationInModal({ error: data.message || data.error || data.details || 'Request failed' });
          return;
        }
        renderConversationInModal(data);
      } catch (err) {
        renderConversationInModal({ error: 'Network error. Try again.' });
      } finally {
        getConversationBtn.disabled = false;
      }
    });
  }

  if (deleteConversationBtn && conversationSessionIdInput) {
    deleteConversationBtn.addEventListener('click', async function () {
      var sessionId = conversationSessionIdInput.value ? conversationSessionIdInput.value.trim() : '';
      if (!sessionId) {
        sessionId = getSessionId();
        conversationSessionIdInput.value = sessionId;
      }
      if (!sessionId) {
        openConversationModal();
        renderConversationInModal({ error: 'Enter a session ID or use the current session.' });
        return;
      }
      deleteConversationBtn.disabled = true;
      if (conversationContent) conversationContent.innerHTML = '<p class="conversation-loading">Deleting…</p>';
      openConversationModal();
      try {
        var res = await fetch('/api/conversation?sessionId=' + encodeURIComponent(sessionId), { method: 'DELETE' });
        var data = await res.json().catch(function () { return { error: 'Invalid response' }; });
        if (!res.ok) {
          renderConversationInModal({ error: data.message || data.error || data.details || 'Request failed' });
          return;
        }
        renderConversationInModal(data);
      } catch (err) {
        renderConversationInModal({ error: 'Network error. Try again.' });
      } finally {
        deleteConversationBtn.disabled = false;
      }
    });
  }

  if (conversationCloseBtn) conversationCloseBtn.addEventListener('click', closeConversationModal);
  if (conversationOverlay) {
    conversationOverlay.addEventListener('click', function (e) {
      if (e.target === conversationOverlay) closeConversationModal();
    });
  }
})();
