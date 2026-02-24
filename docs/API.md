# InsureDesk — API Reference

## Base URL
```
Development:  http://localhost:3001
Production:   https://api.insuredesk.yourcompany.com
```

## Authentication

All API endpoints require a JWT Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

WebSocket connections require the token in the handshake:
```javascript
const socket = io('wss://api.insuredesk.com', {
  auth: { token: 'Bearer <your_jwt_token>' }
});
```

---

## REST Endpoints

### GET /health
Health check — no auth required.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-02-22T10:00:00.000Z", "version": "1.0.0" }
```

---

### GET /api/customers/:policyNumber
Returns full 360° customer profile including policy, claims, and billing.

**Roles:** agent, manager

**Response:**
```json
{
  "profile": {
    "id": "003xx0000001234",
    "name": "Sarah Anderson",
    "phone": "+1 (555) 204-8821",
    "email": "s.anderson@email.com",
    "location": "Austin, TX",
    "memberSince": 2019,
    "policyNumber": "INS-2024-8821"
  },
  "policy": {
    "type": "Auto + Home Bundle",
    "premiumMonthly": 284,
    "deductible": 1000,
    "coverageAmount": 500000,
    "renewalDate": "2026-03-15",
    "paymentStatus": "Current"
  },
  "claims": [
    {
      "id": "500xx0000001234",
      "claimNumber": "CLM-4471",
      "subject": "Auto Collision - Rear End",
      "status": "In Review",
      "filedDate": "2026-01-28",
      "adjuster": "Mark Davis"
    }
  ],
  "billing": [
    { "amount": 284, "status": "Paid", "date": "2026-02-01", "method": "Visa ···4892" }
  ]
}
```

---

### GET /api/calls/queue
Returns current live call queue stats from Zendesk Talk.

**Roles:** agent, manager

**Response:**
```json
{
  "waiting": 5,
  "avgWait": 222,
  "activeCalls": 18,
  "timestamp": "2026-02-22T10:00:00.000Z"
}
```

---

### POST /api/calls/webhook
Receives Zendesk webhook events. Configure this URL in Zendesk Admin.

**No auth required** (secured by Zendesk webhook signing)

**Body:**
```json
{ "event": "ticket.created", "payload": { ... } }
```

---

### GET /api/claims/:policyId
Returns all claims for a given Salesforce Policy ID.

**Roles:** agent, manager, customer

---

### GET /api/agents/performance
Returns agent scorecards and CSAT data.

**Roles:** manager only

---

### GET /api/billing/:policyId
Returns payment history for a policy.

**Roles:** agent, manager, customer

---

## WebSocket Events

Connect to the WebSocket server:
```javascript
import { io } from 'socket.io-client';

const socket = io('wss://api.insuredesk.com', {
  auth: { token: localStorage.getItem('jwt') }
});

// Handle events
socket.on('queue.updated', (data) => { /* update queue UI */ });
socket.on('claim.updated', (data) => { /* update claim stepper */ });
socket.on('call.incoming', (data) => { /* ring notification */ });
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full event reference table.
