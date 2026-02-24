/**
 * WebSocket Service
 * Centralized broadcast helper for Socket.io rooms
 */

const logger = require('../config/logger');

class WebSocketService {
  constructor(io) {
    this.io = io;
  }

  // Broadcast to ALL connected clients
  broadcastToAll(event, data) {
    this.io.emit(event, { ...data, _ts: Date.now() });
    logger.debug(`[WS] → ALL | ${event}`);
  }

  // Broadcast to all agents
  broadcastToAgents(event, data) {
    this.io.to('agent').emit(event, { ...data, _ts: Date.now() });
    logger.debug(`[WS] → agents | ${event}`);
  }

  // Broadcast to all managers
  broadcastToManagers(event, data) {
    this.io.to('manager').emit(event, { ...data, _ts: Date.now() });
    logger.debug(`[WS] → managers | ${event}`);
  }

  // Broadcast to a specific user (by userId)
  broadcastToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, { ...data, _ts: Date.now() });
    logger.debug(`[WS] → user:${userId} | ${event}`);
  }

  // Broadcast to agents AND managers
  broadcastToStaff(event, data) {
    this.broadcastToAgents(event, data);
    this.broadcastToManagers(event, data);
  }
}

module.exports = WebSocketService;
