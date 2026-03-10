# n8n-webapp API Reference

Short reference for all HTTP endpoints. The server proxies to an n8n webhook; requests to n8n use a JWT signed with `JWT_SECRET` and `sub` set to the session ID.

---

## POST /api/chat

**Purpose:** Sends a user message to the n8n webhook and returns the bot reply.

### Request

| Item | Description |
|------|-------------|
| **Headers** | `Content-Type: application/json` (required for JSON body). No client-side `Authorization`; the server adds a Bearer JWT when calling n8n. |
| **Query** | None. |
| **Body** | JSON object. |

**Body fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Non-empty user message (trimmed). |
| `sessionId` | string | Yes | Non-empty session identifier (trimmed). |
| `trackContext` | string | No | Track context; sent as empty string if omitted. |
| `subTopicContext` | string | No | Subtopic context; sent as empty string if omitted. |

### Response

**Success (200)**

- If n8n returns a reply in a recognized field (`response`, `aiResponse`, `reply`, `text`, `message`, or `output`), the API normalizes to:
  - `{ "response": "<reply text>" }`
- If no reply text is found, the raw n8n payload is returned as-is (object).

Example:

```json
{ "response": "Here is the answer." }
```

**Errors**

| Status | When | Body shape |
|--------|------|------------|
| 400 | Missing or invalid `message` or `sessionId` | `{ "error": "message is required and must be a non-empty string" }` or `{ "error": "sessionId is required and must be a non-empty string" }` |
| 502 | n8n returned HTTP status ≥ 400 | `{ "error": "n8n webhook error", "message": "<from n8n or default>", "status": <number>, "data": <n8n body> }` |
| 503 | Request to n8n failed (network/timeout) | `{ "error": "Failed to reach n8n webhook", "details": "<error message>" }` |

**Notes:** The server calls n8n with a JWT (`Authorization: Bearer <token>`, 1h expiry). n8n response is normalized from `body`/`data` wrappers or string JSON. Timeout to n8n: 60 seconds.

---

## GET /api/conversation

**Purpose:** Fetches the conversation history for a session from n8n.

### Request

| Item | Description |
|------|-------------|
| **Headers** | None required. Server adds `Authorization: Bearer <token>` when calling n8n. |
| **Query** | |
| **Body** | None. |

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID (trimmed). Must be non-empty. |

### Response

**Success (200)**

- If n8n returns empty (null, `""`, `[]`, `{}`, or whitespace-only string), the API returns:
  - `{ "message": "No conversation found for that session ID." }`
- Otherwise the n8n response body is forwarded as-is (array or object).

Example (no conversation):

```json
{ "message": "No conversation found for that session ID." }
```

Example (with data): shape depends on n8n; often an array of items with fields such as `userMessage`, `aiResponse`, `reply`, or `response`.

**Errors**

| Status | When | Body shape |
|--------|------|------------|
| 400 | Missing or empty `sessionId` | `{ "error": "sessionId is required" }` |
| 502 | n8n returned HTTP status ≥ 400 | `{ "error": "n8n webhook error", "message": "...", "status": <number>, "data": <n8n body> }` |
| 503 | Request to n8n failed | `{ "error": "Failed to reach n8n webhook", "details": "<error message>" }` |

**Notes:** JWT is sent to n8n with the same `sessionId`. Timeout: 15 seconds. Empty response from n8n is normalized to the single `message` object above.

---

## DELETE /api/conversation

**Purpose:** Deletes the conversation for a session via the n8n webhook.

### Request

| Item | Description |
|------|-------------|
| **Headers** | None required. Server adds `Authorization: Bearer <token>` when calling n8n. |
| **Query** | |
| **Body** | None. |

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID (trimmed). Must be non-empty. |

### Response

**Success (200)**

- If n8n returns empty (null, `""`, `[]`, `{}`, or whitespace-only string), the API returns:
  - `{ "message": "No conversation found for that session ID.", "deletedRowsCount": 0 }`
- Otherwise the n8n response body is forwarded as-is (e.g. may include `deletedCount` or similar).

Example (no conversation):

```json
{ "message": "No conversation found for that session ID.", "deletedRowsCount": 0 }
```

**Errors**

| Status | When | Body shape |
|--------|------|------------|
| 400 | Missing or empty `sessionId` | `{ "error": "sessionId is required" }` |
| 502 | n8n returned HTTP status ≥ 400 | `{ "error": "n8n webhook error", "message": "...", "status": <number>, "data": <n8n body> }` |
| 503 | Request to n8n failed | `{ "error": "Failed to reach n8n webhook", "details": "<error message>" }` |

**Notes:** Same JWT and timeout (15s) as GET. Empty n8n response is normalized to the message plus `deletedRowsCount: 0`.

---

## Common

- **Base URL:** Server runs on `PORT` (default 3000); e.g. `http://localhost:3000`.
- **CORS:** Enabled for all origins.
- **n8n:** All three endpoints use the same `N8N_WEBHOOK_URL`; only HTTP method and parameters differ. The server never exposes the webhook URL or JWT secret to the client.
