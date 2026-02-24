/**
 * InsureDesk — Production WebSocket Integration
 *
 * Replace the mock setInterval data in index.html with this
 * to connect to the real backend server.
 *
 * 1. Add Socket.io client to your HTML <head>:
 *    <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
 *
 * 2. Replace the mock JS block at the bottom of index.html with this file's contents.
 */

const BACKEND_URL = 'https://api.insuredesk.yourcompany.com'; // change this
const JWT_TOKEN = localStorage.getItem('insuredesk_token');    // set after login

// ── Connect to WebSocket ─────────────────────
const socket = io(BACKEND_URL, {
  auth: { token: `Bearer ${JWT_TOKEN}` },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 10
});

// ── Connection Events ────────────────────────
socket.on('connect', () => {
  showToast('🟢', 'Live data connected', 'Salesforce + Zendesk streaming active');
  console.log('InsureDesk WebSocket connected');
});

socket.on('disconnect', (reason) => {
  showToast('🔴', 'Connection lost', 'Reconnecting automatically...');
  console.warn('Disconnected:', reason);
});

socket.on('connect_error', (err) => {
  showToast('⚠️', 'Connection error', err.message);
  console.error('Socket error:', err.message);
});

// ── Real-Time Event Handlers ─────────────────

// Live call queue updates (from Zendesk Talk)
socket.on('queue.updated', (data) => {
  const qNum = document.getElementById('q-num');
  const qBadge = document.getElementById('q-badge');
  const mqStat = document.getElementById('mq-stat');
  const qWait = document.getElementById('q-wait');

  if (qNum) qNum.textContent = data.waiting;
  if (qBadge) qBadge.textContent = `${data.waiting} waiting`;
  if (mqStat) mqStat.textContent = data.waiting;
  if (qWait) qWait.textContent = `Avg wait: ${Math.floor(data.avgWait / 60)}m ${data.avgWait % 60}s`;

  if (data.waiting > 9) {
    showToast('🕒', 'High Queue Alert', `${data.waiting} customers waiting`);
  }
});

// Incoming call (from Zendesk webhook)
socket.on('call.incoming', (data) => {
  showToast('📞', `Incoming call: ${data.customerName}`, data.subject);
  const nbadge = document.getElementById('nbadge');
  if (nbadge) {
    nbadge.textContent = parseInt(nbadge.textContent) + 1;
    nbadge.style.display = 'flex';
  }
});

// Claim status updated (from Salesforce PushTopic)
socket.on('claim.updated', (data) => {
  showToast('📋', `Claim ${data.claimNumber} Updated`, `Status → ${data.status}`);
  // Update the claim stepper if this claim is currently visible
  const stepEls = document.querySelectorAll('.step-info .st');
  stepEls.forEach(el => {
    if (el.closest('.card')?.textContent.includes(data.claimNumber)) {
      // Trigger a UI refresh for this claim
      console.log(`Refreshing claim ${data.claimNumber}`);
    }
  });
});

// Agent performance update (from Zendesk polling)
socket.on('agents.updated', (data) => {
  const tbody = document.getElementById('agent-tbody');
  if (!tbody || !data.agents) return;

  data.agents.forEach(agent => {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      if (row.textContent.includes(agent.name)) {
        // Update calls count, status indicator
        const dot = row.querySelector('.adot');
        if (dot) dot.style.background = agent.status === 'on_call' ? 'var(--accent3)' : 'var(--muted)';
      }
    });
  });
});

// CSAT score received
socket.on('csat.received', (data) => {
  showToast('⭐', 'New CSAT Rating', `Score: ${data.score} · Ticket #${data.ticketId}`);
});

// Policy updated
socket.on('policy.updated', (data) => {
  console.log('Policy updated:', data.policyNumber);
  // Optionally show a subtle notification
});

// ── Load Customer Profile on Call Start ─────
socket.on('call.started', async (data) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/customers/${data.policyNumber}`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` }
    });
    const customer = await res.json();

    // Populate the 360° profile card
    document.querySelector('.cname')?.textContent && null; // update fields with customer data
    startCallTimer();
    showToast('📞', `Call started: ${customer.profile.name}`, customer.policy.type);
  } catch (err) {
    console.error('Failed to load customer profile:', err);
  }
});
