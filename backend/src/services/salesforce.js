/**
 * Salesforce Service
 * Handles OAuth login, REST API queries, and Streaming API subscriptions
 */

const jsforce = require('jsforce');
const logger = require('../config/logger');

class SalesforceService {
  constructor(wsService) {
    this.wsService = wsService;
    this.conn = new jsforce.Connection({ loginUrl: process.env.SF_LOGIN_URL });
    this.connected = false;
  }

  // ── Connect & Authenticate ──────────────────
  async connect() {
    try {
      await this.conn.login(
        process.env.SF_USERNAME,
        process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN
      );
      this.connected = true;
      logger.info('Salesforce authenticated successfully');
    } catch (err) {
      logger.error('Salesforce login failed:', err.message);
      throw err;
    }
  }

  // ── Get Customer 360° Profile ───────────────
  async getCustomerProfile(policyNumber) {
    try {
      const result = await this.conn.query(`
        SELECT Id, FirstName, LastName, Phone, Email, MailingCity, MailingState,
               CreatedDate, Account.Name, Account.Type
        FROM Contact
        WHERE Policy_Number__c = '${policyNumber}'
        LIMIT 1
      `);
      if (!result.records.length) return null;

      const contact = result.records[0];
      return {
        id: contact.Id,
        name: `${contact.FirstName} ${contact.LastName}`,
        phone: contact.Phone,
        email: contact.Email,
        location: `${contact.MailingCity}, ${contact.MailingState}`,
        memberSince: new Date(contact.CreatedDate).getFullYear(),
        policyNumber
      };
    } catch (err) {
      logger.error('getCustomerProfile error:', err.message);
      throw err;
    }
  }

  // ── Get Policy Details ──────────────────────
  async getPolicyDetails(policyNumber) {
    try {
      const result = await this.conn.query(`
        SELECT Id, Name, Policy_Type__c, Premium_Monthly__c, Deductible__c,
               Coverage_Amount__c, Renewal_Date__c, Payment_Status__c
        FROM Policy__c
        WHERE Name = '${policyNumber}'
        LIMIT 1
      `);
      if (!result.records.length) return null;

      const p = result.records[0];
      return {
        id: p.Id,
        policyNumber: p.Name,
        type: p.Policy_Type__c,
        premiumMonthly: p.Premium_Monthly__c,
        deductible: p.Deductible__c,
        coverageAmount: p.Coverage_Amount__c,
        renewalDate: p.Renewal_Date__c,
        paymentStatus: p.Payment_Status__c
      };
    } catch (err) {
      logger.error('getPolicyDetails error:', err.message);
      throw err;
    }
  }

  // ── Get Claims for Policy ───────────────────
  async getClaims(policyId) {
    try {
      const result = await this.conn.query(`
        SELECT Id, CaseNumber, Subject, Status, Description,
               CreatedDate, ClosedDate, OwnerId, Owner.Name
        FROM Case
        WHERE Policy__c = '${policyId}' AND Type = 'Claim'
        ORDER BY CreatedDate DESC
      `);
      return result.records.map(c => ({
        id: c.Id,
        claimNumber: c.CaseNumber,
        subject: c.Subject,
        status: c.Status,
        description: c.Description,
        filedDate: c.CreatedDate,
        closedDate: c.ClosedDate,
        adjuster: c.Owner?.Name
      }));
    } catch (err) {
      logger.error('getClaims error:', err.message);
      throw err;
    }
  }

  // ── Get Billing History ─────────────────────
  async getBillingHistory(policyId) {
    try {
      const result = await this.conn.query(`
        SELECT Id, Amount, Status, Payment_Date__c, Payment_Method__c
        FROM Payment__c
        WHERE Policy__c = '${policyId}'
        ORDER BY Payment_Date__c DESC
        LIMIT 12
      `);
      return result.records.map(p => ({
        id: p.Id,
        amount: p.Amount,
        status: p.Status,
        date: p.Payment_Date__c,
        method: p.Payment_Method__c
      }));
    } catch (err) {
      logger.error('getBillingHistory error:', err.message);
      throw err;
    }
  }

  // ── Subscribe to Claim Updates (Streaming API) ──
  subscribeToClaims() {
    this.conn.streaming.topic('/topic/ClaimUpdates').subscribe((message) => {
      logger.info(`Claim update received: ${message.sobject?.CaseNumber}`);
      this.wsService.broadcastToManagers('claim.updated', {
        claimId: message.sobject.Id,
        claimNumber: message.sobject.CaseNumber,
        status: message.sobject.Status,
        timestamp: new Date().toISOString()
      });
      // Also notify the specific customer
      if (message.sobject.ContactId) {
        this.wsService.broadcastToUser(message.sobject.ContactId, 'claim.updated', {
          claimNumber: message.sobject.CaseNumber,
          status: message.sobject.Status
        });
      }
    });
    logger.info('Subscribed to Salesforce ClaimUpdates PushTopic');
  }

  // ── Subscribe to Policy Updates ─────────────
  subscribeToPolicies() {
    this.conn.streaming.topic('/topic/PolicyUpdates').subscribe((message) => {
      logger.info(`Policy update received: ${message.sobject?.Name}`);
      this.wsService.broadcastToAgents('policy.updated', {
        policyId: message.sobject.Id,
        policyNumber: message.sobject.Name,
        changes: message.sobject,
        timestamp: new Date().toISOString()
      });
    });
    logger.info('Subscribed to Salesforce PolicyUpdates PushTopic');
  }
}

module.exports = SalesforceService;
