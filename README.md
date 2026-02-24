# InsureDesk 360° — Insurance Customer Service Platform

![InsureDesk](https://img.shields.io/badge/InsureDesk-360%C2%B0-00d4ff?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

> A real-time, full-stack customer service dashboard for insurance companies — connecting Salesforce & Zendesk with a live 360° view for Agents, Customers, and Managers.

---

## 📸 Portals

| Portal | Description |
|---|---|
| 🎧 **Agent View** | Live call control, customer 360° profile, call queue, sentiment analysis |
| 👤 **Customer View** | Policy details, claim tracker, call history, callback scheduler |
| 📊 **Manager View** | Team scorecards, live alerts, call volume, CSAT/NPS rings |

---

## 🏗 Project Structure

```
insuredesk/
├── frontend/                  # HTML/CSS/JS Dashboard
│   └── index.html             # Main 360° dashboard (all 3 portals)
├── backend/                   # Node.js API + WebSocket server
│   ├── src/
│   │   ├── config/            # Environment & integration config
│   │   ├── routes/            # Express API routes
│   │   ├── controllers/       # Route logic
│   │   ├── services/          # Salesforce & Zendesk integrations
│   │   └── middleware/        # Auth, logging, error handling
│   ├── package.json
│   └── server.js              # Entry point
├── docs/                      # Architecture & API docs
│   ├── ARCHITECTURE.md
│   └── API.md
├── .env.example               # Environment variable template
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm v9+
- Salesforce Connected App (OAuth 2.0)
- Zendesk API Token

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/insuredesk.git
cd insuredesk
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your Salesforce & Zendesk credentials
```

### 4. Start the Backend Server
```bash
npm run dev
```

### 5. Open the Frontend
```bash
# Open frontend/index.html in your browser
# OR serve it with a simple HTTP server:
npx serve frontend
```

---

## 🔌 Integrations

### Salesforce
- OAuth 2.0 Connected App
- Streaming API (PushTopics for Claims & Policies)
- REST API for customer profiles and billing

### Zendesk
- Webhooks for ticket & call events
- Talk API for live call queue
- REST API for agent performance metrics

---

## 📡 Real-Time Features

| Feature | Technology |
|---|---|
| Live call timer | WebSocket broadcast |
| Queue counter | Zendesk Talk API polling |
| Claim status updates | Salesforce PushTopic |
| Agent sentiment | WebSocket + AI scoring |
| Notifications | WebSocket push events |

---

## 🔒 Security

- JWT Authentication on all WebSocket connections
- Role-based access (Agent / Customer / Manager)
- OAuth 2.0 for CRM authentication
- All secrets stored in environment variables
- HTTPS/WSS enforced in production
- HIPAA-ready audit logging

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express.js |
| WebSockets | Socket.io |
| Salesforce SDK | jsforce |
| HTTP Client | Axios |
| Auth | JWT + OAuth 2.0 |
| Cache | Redis (optional) |
| Deployment | AWS / Railway / Vercel |

---

## 📖 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — feel free to use and modify for your project.

---

*Built with ❤️ for insurance customer service teams*
