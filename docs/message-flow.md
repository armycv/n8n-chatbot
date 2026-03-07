# Chat message flow

## Sequence diagram

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend (HTML/JS)
    participant Express as Express Backend
    participant n8n as n8n Webhook

    User->>UI: Types message and sends
    UI->>UI: Append user message, show "Bot is typing..."
    UI->>Express: POST /api/chat { message, sessionId }
    Express->>n8n: POST N8N_WEBHOOK_URL { message, sessionId }
    n8n-->>Express: HTTP 200 + JSON body (e.g. { reply: "..." })
    Express-->>UI: 200 + same JSON
    UI->>UI: Remove typing, append bot reply, scroll to bottom
    UI->>User: Display bot response
```

## Steps

1. **User** enters a message and submits (Send or Enter).
2. **Frontend** adds the user message to the chat, shows “Bot is typing...”, and sends `POST /api/chat` with `message` and `sessionId`.
3. **Express** validates the body, then calls the n8n webhook with `POST` and JSON body `{ message, sessionId }`.
4. **n8n** runs the workflow and responds with JSON (e.g. `{ reply: "..." }`).
5. **Express** forwards that JSON as the response to the frontend.
6. **Frontend** hides the typing indicator, appends the bot reply (from `reply`, `text`, `message`, or `output`), and scrolls to the bottom.
