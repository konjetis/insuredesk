# InsureDesk — Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│   frontend/index.html  (Agent | Customer | Manager views)   │
│   WebSocket Client  ←──────────────────────────────────┐    │
└────────────────────────────┬────────────────────────────┼───┘
                             │ HTTPS / WSS                │
┌────────────────────────────▼────────────────────────────┴───┐
│                     BACKEND SERVER                           │
│   Express REST API          Socket.io WebSocket Server       │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Routes: /api/customers /api/calls /api/claims      │   │
│   │          /api/agents   /api/billing                 │   │
│   └────────────────┬──────────────────┬─────────────────┘   │
│                    │                  │                      │
│   ┌────────────────▼───┐  ┌───────────▼───────────────┐    │
│   │  SalesforceService │  │      ZendeskService        │    │
│   │  - REST API        │  │  - REST API                │    │
│   │  - Streaming API   │  │  - Talk API polling        │    │
│   │  - PushTopics      │  │  - Webhook processor       │    │
│   └────────────────────┘  └───────────────────────────┘    │
└──────────────┬──────────────────────────────┬───────────────┘
               │ jsforce OAuth                 │ Axios + API Token
┌──────────────▼──────────────┐  ┌────────────▼────────────────┐
│       SALESFORCE            │  │         ZENDESK              │
│  - Contact / Policy objects │  │  - Tickets                   │
│  - Case / Claim records     │  │  - Talk call queue           │
│  - Payment__c records       │  │  - Agent performance         │
│  - Streaming PushTopics     │  │  - Webhooks                  │
└─────────────────────────────┘  └─────────────────────────────┘
```

## Real-Time Data Flow

```
Salesforce Record Changes
        │
        ▼
PushTopic Subscription (jsforce)
        │
        ▼
SalesforceService.subscribeToClaims()
        │
        ▼
WebSocketService.broadcastToManagers('claim.updated', data)
        │
        ▼
Socket.io → room: 'manager'
        │
        ▼
InsureDesk Dashboard updates claim stepper card
```

```
Zendesk Call Queued
        │
        ▼
Webhook fires → POST /api/calls/webhook
        │
        ▼
ZendeskService.processWebhook('ticket.created', payload)
        │
        ▼
WebSocketService.broadcastToAgents('call.incoming', data)
        │
        ▼
Socket.io → room: 'agent'
        │
        ▼
InsureDesk Dashboard adds call to queue, flashes notification
```

## Security Model

```
Browser (Frontend)
  └── Sends JWT in WebSocket handshake: socket.auth = { token }
  └── Sends JWT in REST API: Authorization: Bearer <token>

Backend
  └── authenticateSocket middleware validates JWT on WS connect
  └── authenticateToken middleware validates JWT on REST calls
  └── requireRole('manager') blocks non-manager access
  └── Role-based Socket.io rooms: 'agent', 'manager', 'customer'
  └── User-specific room: 'user:{userId}' for private events

CRM Auth
  └── Salesforce: OAuth 2.0 with username + password + security token
  └── Zendesk: Basic Auth with email/token (server-side only)
  └── ALL credentials in .env — never exposed to frontend
```

## WebSocket Event Reference

| Event | Direction | Audience | Payload |
|---|---|---|---|
| `queue.updated` | Server → Client | All | `{ waiting, avgWait, activeCalls }` |
| `call.incoming` | Server → Client | Agents | `{ ticketId, customerName, subject }` |
| `call.started` | Server → Client | Agents | `{ callId, agentId, customerId }` |
| `call.ended` | Server → Client | Agents + Managers | `{ callId, duration, outcome }` |
| `claim.updated` | Server → Client | All | `{ claimId, claimNumber, status }` |
| `agents.updated` | Server → Client | Managers | `{ agents[] }` |
| `csat.received` | Server → Client | Managers | `{ score, ticketId, agentId }` |
| `policy.updated` | Server → Client | Agents | `{ policyId, policyNumber }` |
| `sentiment.update`| Server → Client | Agents + Managers | `{ callId, score, label }` |
