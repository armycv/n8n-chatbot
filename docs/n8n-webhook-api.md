# n8n Workflow API — Webhook Endpoints

This document describes the HTTP API exposed by the n8n workflow: three webhook endpoints on the same URL, distinguished by method. Use it when building or maintaining the workflow or when integrating a service with it.

**Common:**

- **Base URL:** The webhook URL (e.g. the “Production URL” from the n8n Respond to Webhook node). Same URL for all three operations; only HTTP method and parameters differ.
- **Authentication:** The workflow expects every request to include `Authorization: Bearer <token>`. The JWT should have payload `{ sub: "<sessionId>", iat: <unix sec> }` and a 1-hour expiry, signed with the same secret the caller uses.

---

## 1. Chat — POST

**Purpose:** Receive a user message and optional context, run the conversation/LLM logic, and return the bot reply.

### Request

| Item | Description |
|------|-------------|
| **Method** | `POST` |
| **URL** | Webhook URL (no query string) |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer <JWT>` |
| **Query** | None |
| **Body** | JSON object. |

**Body fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User message (non-empty). |
| `sessionId` | string | Yes | Session identifier (non-empty). |
| `trackContext` | string | No | Track context; may be empty string. |
| `subTopicContext` | string | No | Subtopic context; may be empty string. |

Example:

```json
{
  "message": "What is the capital of France?",
  "sessionId": "sess_abc123",
  "trackContext": "",
  "subTopicContext": ""
}
```

### Response

**Success (200)**

- **Body:** JSON. The bot reply must appear in at least one of these fields (top-level or under `body` / `data`): `response`, `aiResponse`, `reply`, `text`, `message`, `output`. Other fields are allowed.

Example:

```json
{ "aiResponse": "Paris is the capital of France." }
```

or

```json
{ "response": "Paris is the capital of France." }
```

**Error (4xx / 5xx)**

- **Body:** JSON recommended. If present, a `message` field (string) may be used as the error message. Callers may surface status code and body for debugging.

**Notes:** Long-running flows may need a timeout of 60 seconds or more on the caller side.

---

## 2. Get conversation — GET

**Purpose:** Return the conversation history for the given session.

### Request

| Item | Description |
|------|-------------|
| **Method** | `GET` |
| **URL** | Webhook URL with query string |
| **Headers** | `Authorization: Bearer <JWT>` |
| **Query parameters** | |

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID (non-empty). |

Example: `GET <webhook-url>?sessionId=sess_abc123`

### Response

**Success (200)**

- **When there is no conversation:** Return an empty payload so the caller can treat it as “no data”. Accepted forms: empty body, `""`, `[]`, `{}`, or `null`. Callers typically map these to a single message like “No conversation found for that session ID.”
- **When there is data:** Return a JSON array or object representing the conversation. Common item fields: `userMessage` or `message`, `aiResponse`, `reply`, or `response`.

Example (with data):

```json
[
  { "userMessage": "Hello", "aiResponse": "Hi! How can I help?" },
  { "userMessage": "What is 2+2?", "aiResponse": "2+2 is 4." }
]
```

**Error (4xx / 5xx)**

- **Body:** Optional JSON; a `message` field may be used as the error message.

**Notes:** Callers may use a timeout of about 15 seconds.

---

## 3. Delete conversation — DELETE

**Purpose:** Delete the conversation (and optionally related data) for the given session.

### Request

| Item | Description |
|------|-------------|
| **Method** | `DELETE` |
| **URL** | Webhook URL with query string |
| **Headers** | `Authorization: Bearer <JWT>` |
| **Query parameters** | |

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID (non-empty). |

Example: `DELETE <webhook-url>?sessionId=sess_abc123`

### Response

**Success (200)**

- **When nothing was found to delete:** Return an empty payload (empty body, `""`, `[]`, `{}`, or `null`). Callers typically treat this as “No conversation found” and may show something like `deletedRowsCount: 0`.
- **When rows were deleted:** Return a JSON object. Including a numeric field such as `deletedCount` or `deletedRowsCount` allows the caller to show how many rows were deleted.

Example (with data):

```json
{ "deletedCount": 3 }
```

or

```json
{ "message": "Conversation deleted.", "deletedRowsCount": 3 }
```

**Error (4xx / 5xx)**

- **Body:** Optional JSON; a `message` field may be used as the error message.

**Notes:** Callers may use a timeout of about 15 seconds.

---

## Summary

| Endpoint | Method | Query | Body | Success (200) response |
|----------|--------|-------|------|-------------------------|
| Chat | POST | — | `message`, `sessionId`, `trackContext`, `subTopicContext` | JSON with reply in `response` / `aiResponse` / `reply` / `text` / `message` / `output` |
| Get conversation | GET | `sessionId` | — | Array/object of messages, or empty (`""` / `[]` / `{}`) for none |
| Delete conversation | DELETE | `sessionId` | — | Optional object (e.g. `deletedCount`); empty when nothing to delete |

All three endpoints use the same webhook URL and expect the same JWT in `Authorization: Bearer <token>`.
