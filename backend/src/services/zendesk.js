/**
 * Zendesk Service
 * Handles REST API, Talk API polling, and webhook processing
 */

const axios = require('axios');
const logger = require('../config/logger');

class ZendeskService {
  constructor(wsService) {
    this.wsService = wsService;
    this.baseURL = `https://${process.env.ZD_SUBDOMAIN}.zendesk.com/api/v2`;
    this.auth = {
      username: `${process.env.ZD_EMAIL}/token`,
      password: process.env.ZD_API_TOKEN
    };
    this.queueInterval = null;
    this.agentInterval = null;
  }

  // ── Generic API request ─────────────────────
  async request(endpoint, method = 'GET', data = null) {
    try {
      const res = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        auth: this.auth,
        data,
        headers: { 'Content-Type': 'application/json' }
      });
      return res.data;
    } catch (err) {
      logger.error(`Zendesk API error [${endpoint}]:`, err.response?.data || err.message);
      throw err;
    }
  }

  // ── Get Live Queue Stats ────────────────────
  async getQueueStats() {
    const data = await this.request('/channels/voice/stats/current_queue_activity');
    return {
      waiting: data.current_queue_activity?.waiting_in_queue || 0,
      avgWait: data.current_queue_activity?.average_wait_time || 0,
      activeCalls: data.current_queue_activity?.calls_active || 0,
      timestamp: new Date().toISOString()
    };
  }

  // ── Get Agent Performance ───────────────────
  async getAgentPerformance() {
    const data = await this.request('/channels/voice/stats/agents_activity');
    const agents = (data.agents_activity || []).map(a => ({
      id: a.agent_id,
      name: a.agent_name,
      status: a.status, // online, offline, on_call, wrap_up
      callsHandled: a.calls_count || 0,
      avgHandleTime: a.average_handle_time || 0,
      currentCallDuration: a.current_call_duration || 0
    }));
    return agents;
  }

  // ── Get Ticket/Call Details ─────────────────
  async getTicket(ticketId) {
    const data = await this.request(`/tickets/${ticketId}.json`);
    const t = data.ticket;
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      type: t.type,
      assigneeId: t.assignee_id,
      requesterId: t.requester_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      tags: t.tags,
      satisfactionRating: t.satisfaction_rating
    };
  }

  // ── Get Customer CSAT Scores ────────────────
  async getCSATScores(agentId) {
    const data = await this.request(
      `/satisfaction_ratings.json?assignee_id=${agentId}&sort_order=desc&per_page=50`
    );
    const ratings = data.satisfaction_ratings || [];
    const scores = ratings.map(r => r.score === 'good' ? 5 : r.score === 'bad' ? 1 : 3);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
    return { average: parseFloat(avg), count: scores.length, ratings };
  }

  // ── Process Incoming Webhook ────────────────
  async processWebhook(event, payload) {
    logger.info(`Zendesk webhook: ${event}`);

    switch (event) {
      case 'ticket.created':
        this.wsService.broadcastToAgents('call.incoming', {
          ticketId: payload.id,
          customerName: payload.requester?.name,
          subject: payload.subject,
          priority: payload.priority,
          timestamp: new Date().toISOString()
        });
        break;

      case 'ticket.assigned':
        this.wsService.broadcastToAgents('call.assigned', {
          ticketId: payload.id,
          agentId: payload.assignee_id,
          timestamp: new Date().toISOString()
        });
        break;

      case 'ticket.updated':
        this.wsService.broadcastToManagers('ticket.updated', {
          ticketId: payload.id,
          status: payload.status,
          agentId: payload.assignee_id,
          timestamp: new Date().toISOString()
        });
        break;

      case 'satisfaction_rating.created':
        this.wsService.broadcastToManagers('csat.received', {
          score: payload.score,
          ticketId: payload.ticket_id,
          agentId: payload.assignee_id,
          timestamp: new Date().toISOString()
        });
        break;

      default:
        logger.warn(`Unhandled Zendesk event: ${event}`);
    }
  }

  // ── Poll Queue Every 3 Seconds ──────────────
  startQueuePolling(intervalMs = 3000) {
    this.queueInterval = setInterval(async () => {
      try {
        const stats = await this.getQueueStats();
        this.wsService.broadcastToAll('queue.updated', stats);
      } catch (err) {
        logger.error('Queue polling error:', err.message);
      }
    }, intervalMs);
    logger.info(`Zendesk queue polling started (every ${intervalMs}ms)`);
  }

  // ── Poll Agent Statuses Every 10 Seconds ────
  startAgentPolling(intervalMs = 10000) {
    this.agentInterval = setInterval(async () => {
      try {
        const agents = await this.getAgentPerformance();
        this.wsService.broadcastToManagers('agents.updated', { agents });
      } catch (err) {
        logger.error('Agent polling error:', err.message);
      }
    }, intervalMs);
    logger.info(`Zendesk agent polling started (every ${intervalMs}ms)`);
  }

  // ── Stop Polling ────────────────────────────
  stopPolling() {
    if (this.queueInterval) clearInterval(this.queueInterval);
    if (this.agentInterval) clearInterval(this.agentInterval);
    logger.info('Zendesk polling stopped');
  }
}

module.exports = ZendeskService;
