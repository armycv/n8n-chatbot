import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const PORT = process.env.PORT ?? 3000;

if (!N8N_WEBHOOK_URL) {
  console.error('Missing required env N8N_WEBHOOK_URL. Copy .env.example to .env and set it.');
  process.exit(1);
}

interface ChatRequest {
  message: string;
  sessionId: string;
}

interface ChatResponse {
  reply?: string;
  aiResponse?: string;
  response?: string;
  [key: string]: unknown;
}

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const body = req.body as Partial<ChatRequest>;
  const message = body?.message;
  const sessionId = body?.sessionId;

  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required and must be a non-empty string' });
    return;
  }
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    res.status(400).json({ error: 'sessionId is required and must be a non-empty string' });
    return;
  }

  try {
    const n8nResponse = await axios.post<ChatResponse>(N8N_WEBHOOK_URL!, {
      message: message.trim(),
      sessionId: sessionId.trim(),
    }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });

    if (n8nResponse.status >= 400) {
      const n8nMessage = n8nResponse.data && typeof n8nResponse.data === 'object' && 'message' in n8nResponse.data
        ? String((n8nResponse.data as { message?: unknown }).message)
        : undefined;
      res.status(502).json({
        error: 'n8n webhook error',
        message: n8nMessage || `n8n returned ${n8nResponse.status}`,
        status: n8nResponse.status,
        data: n8nResponse.data,
      });
      return;
    }

    // n8n may return JSON as a string or wrap payload in body/data; normalize to an object
    let payload: ChatResponse = n8nResponse.data as ChatResponse;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload) as ChatResponse;
      } catch {
        payload = { reply: payload as unknown as string };
      }
    } else if (payload && typeof payload === 'object' && !('aiResponse' in payload) && !('reply' in payload) && !('response' in payload)) {
      const body = (payload as { body?: unknown }).body;
      const data = (payload as { data?: unknown }).data;
      if (body && typeof body === 'object') payload = body as ChatResponse;
      else if (data && typeof data === 'object') payload = data as ChatResponse;
    }

    // Normalize: send a single "response" field so frontend always finds the reply
    const replyText =
      (typeof payload?.response === 'string' && payload.response.trim() ? payload.response.trim() : '') ||
      (typeof payload?.aiResponse === 'string' && payload.aiResponse.trim() ? payload.aiResponse.trim() : '') ||
      (typeof payload?.reply === 'string' && payload.reply.trim() ? payload.reply.trim() : '') ||
      (typeof payload?.text === 'string' && payload.text.trim() ? payload.text.trim() : '') ||
      (typeof payload?.message === 'string' && payload.message.trim() ? payload.message.trim() : '') ||
      (typeof payload?.output === 'string' && payload.output.trim() ? payload.output.trim() : '');
    if (replyText) {
      res.json({ response: replyText });
      return;
    }
    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('n8n request failed:', err);
    res.status(503).json({
      error: 'Failed to reach n8n webhook',
      details: message,
    });
  }
});

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
