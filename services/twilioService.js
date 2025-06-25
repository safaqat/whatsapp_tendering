const twilio = require('twilio');
const mockDB = require('../config/mockDatabase');

class TwilioService {
  constructor() {
    // Real Twilio client (uncomment when ready for production)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      this.isMock = false;
    } else {
      this.isMock = true;
      console.log('⚠️ Running in MOCK mode - no real Twilio credentials found');
    }
  }

  // Send text message via WhatsApp
  async sendWhatsAppMessage(to, message) {
    if (this.isMock) {
      console.log(`[MOCK] WhatsApp message to ${to}: ${message}`);
      mockDB.addNotification({ type: 'whatsapp', recipient: to, message, status: 'mocked', sent_at: new Date() });
      return { sid: 'MOCK_SID', to, message };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
      });

      console.log(`✅ WhatsApp message sent to ${to}: ${result.sid}`);
      return result;
    } catch (error) {
      console.error(`❌ Error sending WhatsApp message to ${to}:`, error);
      throw error;
    }
  }

  // Send voice message via WhatsApp
  async sendWhatsAppVoice(to, mediaUrl) {
    if (this.isMock) {
      console.log(`[MOCK] WhatsApp voice message to ${to}: ${mediaUrl}`);
      mockDB.addNotification({ type: 'whatsapp_voice', recipient: to, message: mediaUrl, status: 'mocked', sent_at: new Date() });
      return { sid: 'MOCK_SID', to, mediaUrl };
    }

    try {
      const result = await this.client.messages.create({
        mediaUrl: [mediaUrl],
        from: this.fromNumber,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
      });

      console.log(`✅ WhatsApp voice message sent to ${to}: ${result.sid}`);
      return result;
    } catch (error) {
      console.error(`❌ Error sending WhatsApp voice message to ${to}:`, error);
      throw error;
    }
  }

  // Send tender alert to all suppliers
  async sendTenderAlert(tender) {
    const suppliers = this.isMock ? mockDB.getActiveSuppliers() : await this.getActiveSuppliers();
    const message = this.formatTenderMessage(tender);
    
    const results = [];
    for (const supplier of suppliers) {
      try {
        const result = await this.sendWhatsAppMessage(supplier.phone, message);
        results.push({ supplier: supplier.phone, success: true, sid: result.sid });
      } catch (error) {
        results.push({ supplier: supplier.phone, success: false, error: error.message });
      }
    }

    // Log notification
    if (this.isMock) {
      mockDB.addNotification({ type: 'tender_alert', recipient: 'all_suppliers', message: `Tender alert for ${tender.tender_id}`, status: 'mocked', sent_at: new Date() });
    } else {
      await this.logNotification('tender_alert', 'all_suppliers', `Tender alert sent for ${tender.tender_id}`, results);
    }
    
    return results;
  }

  formatTenderMessage(tender) {
    return `🚨 *New Tender Alert* 🚨

📌 *Item*: ${tender.quantity} ${tender.unit} ${tender.title}
💰 *Category*: ${tender.category}
⏳ *Tender closing date*: ${new Date(tender.closing_date).toLocaleDateString()}
📝 *Description*: ${tender.description}

💬 *Reply with your price & availability (text/voice)*

Tender ID: ${tender.tender_id}`;
  }

  // Get active suppliers from database
  async getActiveSuppliers() {
    if (this.isMock) {
      return mockDB.getActiveSuppliers();
    }

    try {
      const { pool } = require('../config/database');
      const result = await pool.query(
        'SELECT phone, name, language FROM suppliers WHERE is_active = true'
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching suppliers:', error);
      return [];
    }
  }

  // Send bid notification to coordinators
  async sendBidNotification(bid, tender) {
    const message = `🔔 *New Bid Received*

📋 *Tender*: ${tender.title}
💰 *Price*: ${bid.price} ${bid.currency}
⏰ *Delivery*: ${bid.delivery_time || 'Not specified'}
📞 *Supplier*: ${bid.supplier_phone}
🌐 *Language*: ${bid.language || 'Unknown'}

Tender ID: ${bid.tender_id}`;

    // Send to admin phone
    if (process.env.ADMIN_PHONE) {
      await this.sendWhatsAppMessage(process.env.ADMIN_PHONE, message);
    }

    // Log notification
    if (this.isMock) {
      mockDB.addNotification({ type: 'bid_received', recipient: 'admin', message, status: 'mocked', sent_at: new Date() });
    } else {
      await this.logNotification('bid_received', 'admin', `New bid for ${bid.tender_id}`, { bid_id: bid.id });
    }

    return true;
  }

  // Send winning bid notification to supplier
  async sendWinningBidNotification(bid, tender) {
    const message = `🎉 *Congratulations! Your Bid Won*

📋 *Tender*: ${tender.title}
💰 *Your Price*: ${bid.price} ${bid.currency}
📅 *Closing Date*: ${new Date(tender.closing_date).toLocaleDateString()}

Please contact us for further details.

Tender ID: ${bid.tender_id}`;

    await this.sendWhatsAppMessage(bid.supplier_phone, message);
    
    // Log notification
    if (this.isMock) {
      mockDB.addNotification({ type: 'winning_bid', recipient: bid.supplier_phone, message, status: 'mocked', sent_at: new Date() });
    } else {
      await this.logNotification('winning_bid', bid.supplier_phone, `Winning bid notification for ${bid.tender_id}`, { bid_id: bid.id });
    }

    return true;
  }

  // Log notification to database
  async logNotification(type, recipient, message, metadata = {}) {
    try {
      const { pool } = require('../config/database');
      await pool.query(
        'INSERT INTO notifications (type, recipient, message, metadata) VALUES ($1, $2, $3, $4)',
        [type, recipient, message, JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error('❌ Error logging notification:', error);
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(req) {
    if (this.isMock) return true;
    
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    return twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      req.body
    );
  }
}

module.exports = new TwilioService(); 