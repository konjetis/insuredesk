require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./src/config/logger');
const { authenticateSocket } = require('./src/middleware/auth');
const customerRoutes = require('./src/routes/customers');
const callRoutes = require('./src/routes/calls');
const claimRoutes = require('./src/routes/claims');
const agentRoutes = require('./src/routes/agents');
const billingRoutes = require('./src/routes/billing');
const SalesforceService = require('./src/services/salesforce');
const ZendeskService = require('./src/services/zendesk');
const WebSocketService = require('./src/services/websocket');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/customers', customerRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/billing', billingRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});
io.use(authenticateSocket);
io.on('connection', (socket) => {
  const { userId, role } = socket.user;
  logger.info('Client connected: ' + userId + ' (' + role + ')');
  socket.join(role);
  socket.join('user:' + userId);
  socket.on('disconnect', () => {
    logger.info('Client disconnected: ' + userId);
  });
});
const wsService = new WebSocketService(io);
const sfService = new SalesforceService(wsService);
sfService.connect().then(() => {
  sfService.subscribeToClaims();
  sfService.subscribeToPolicies();
  logger.info('Salesforce streaming active');
}).catch(err => logger.error('Salesforce connection failed: ' + err.message));
const zdService = new ZendeskService(wsService);
zdService.startQueuePolling();
zdService.startAgentPolling();
logger.info('Zendesk polling active');
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info('InsureDesk server running on port ' + PORT);
  logger.info('Environment: ' + process.env.NODE_ENV);
});
module.exports = { app, io };
