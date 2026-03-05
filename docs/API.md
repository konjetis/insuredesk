# InsureDesk — API Reference

## Base URLs

```
Development:  http://localhost:3001
Stage:        https://insuredesk-production.up.railway.app
```

## Authentication

All protected endpoints require a JWT Bearer token:
```
Authorization: Bearer <your_jwt_token>
```

Obtain a token via `POST /api/auth/login`. Tokens expire after 8 hours.

WebSocket connections pass the token in the handshake:
```javascript
const socket = io('wss://insuredesk-production.up.railway.app', {
  auth: { token: 'Bearer <your_jwt_token>' }
});
```

---

## Endpoints

### GET /health

Health check — no auth required.

**Response `200`:**
```json
{ "status": "ok", "timestamp": "2026-03-05T08:00:00.000Z", "version": "1.0.0" }
```

---

### POST /api/auth/login

Authenticate a user and receive a JWT token.

**No auth required.**

**Body:**
```json
{ "email": "admin@insuredesk.com", "password": "Admin@123" }
```

**Response `200`:**
```json
{
  "token": "<jwt>",
  "user": { "id": 1, "email": "admin@insuredesk.com", "name": "Admin User", "role": "admin" }
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Email or password missing |
| 401 | Invalid credentials or inactive account |
| 500 | Server error |

---

### POST /api/auth/register

Create a new user account. Requires admin or manager role.

**Roles:** `admin`, `manager`

**Body:**
```json
{ "email": "new@insuredesk.com", "password": "NewUser@123", "full_name": "New User", "role": "agent" }
```

Valid roles: `admin`, `manager`, `agent`, `customer`. Only `admin` can create other admins.
Password must be at least 8 characters.

**Response `201`:**
```json
{ "user": { "id": 10, "email": "new@insuredesk.com", "full_name": "New User", "role": "agent" } }
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Missing fields, invalid role, or password too short |
| 401 | No token provided |
| 403 | Caller is not admin/manager, or non-admin trying to create admin |
| 409 | Email already exists |
| 500 | Server error |

---

### GET /api/auth/me

Returns the currently authenticated user's profile.

**Roles:** Any authenticated user.

**Response `200`:**
```json
{
  "user": {
    "id": 1,
    "email": "admin@insuredesk.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": true,
    "last_login": "2026-03-05T07:55:00.000Z"
  }
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 401 | No token, user not found, or account deactivated |
| 500 | Server error |

---

### GET /api/admin/users

Returns a list of all users in the system.

**Roles:** `admin`, `manager`

**Response `200`:**
```json
{
  "users": [
    { "id": 1, "email": "admin@insuredesk.com", "full_name": "Admin User", "role": "admin", "is_active": true, "last_login": "...", "created_at": "..." }
  ]
}
```

---

### POST /api/admin/users

Create a new user (admin panel version — no password length restriction in route, handled by bcrypt).

**Roles:** `admin`, `manager`

**Body:**
```json
{ "email": "new@insuredesk.com", "password": "Test@1234", "full_name": "New User", "role": "agent" }
```

**Response `201`:**
```json
{ "user": { "id": 11, "email": "new@insuredesk.com", "full_name": "New User", "role": "agent", "is_active": true, "created_at": "..." } }
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Missing fields or invalid role |
| 409 | Email already exists |
| 500 | Server error |

---

### PUT /api/admin/users/:id

Update a user's name, role, active status, or password.

**Roles:** `admin`, `manager`

**Body (all fields optional except required by route):**
```json
{ "full_name": "Updated Name", "role": "manager", "is_active": true, "password": "NewPass@123" }
```

**Response `200`:**
```json
{ "user": { "id": 2, "email": "user@insuredesk.com", "full_name": "Updated Name", "role": "manager", "is_active": true } }
```

**Errors:**
| Code | Reason |
|------|--------|
| 403 | Insufficient role |
| 404 | User not found |
| 500 | Server error |

---

### DELETE /api/admin/users/:id

Deactivates a user (sets `is_active = false`). Does not permanently delete.

**Roles:** `admin`, `manager`

**Response `200`:**
```json
{ "message": "User deactivated successfully" }
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Cannot deactivate your own account |
| 403 | Insufficient role |
| 404 | User not found |
| 500 | Server error |

---

### GET /api/admin/agents

Returns agent performance stats for today (joined from `agent_performance` table).

**Roles:** `admin`, `manager`

**Response `200`:**
```json
{
  "agents": [
    {
      "id": 2,
      "full_name": "Alex Johnson",
      "email": "alex.johnson@insuredesk.com",
      "is_active": true,
      "calls_handled": 24,
      "avg_handle_time": 272,
      "first_call_resolution": 87,
      "csat_score": 4.8,
      "escalations": 0
    }
  ]
}
```

---

## Role Summary

| Endpoint | admin | manager | agent | customer |
|----------|-------|---------|-------|----------|
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/register` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/auth/me` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/admin/users` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/admin/users` | ✅ | ✅ | ❌ | ❌ |
| `PUT /api/admin/users/:id` | ✅ | ✅ | ❌ | ❌ |
| `DELETE /api/admin/users/:id` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/admin/agents` | ✅ | ✅ | ❌ | ❌ |

---

## WebSocket Events

Connect to the WebSocket server with your JWT:
```javascript
const socket = io('wss://insuredesk-production.up.railway.app', {
  auth: { token: localStorage.getItem('jwt') }
});

socket.on('queue.updated',  (data) => { /* update call queue UI  */ });
socket.on('claim.updated',  (data) => { /* update claim stepper  */ });
socket.on('call.incoming',  (data) => { /* ring notification     */ });
socket.on('agent.stats',    (data) => { /* update scorecards     */ });
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full event reference.
