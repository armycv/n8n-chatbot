(function () {
  const messagesEl = document.getElementById('messages');
  const typingEl = document.getElementById('typing');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');

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
})();
