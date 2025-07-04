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
    const results = [];
    for (const supplier of suppliers) {
      try {
        if (this.isMock) {
          // Mock mode: just log
          console.log(`[MOCK] WhatsApp template message to ${supplier.phone}: tender_alert`);
          results.push({ supplier: supplier.phone, success: true, sid: 'MOCK_SID' });
        } else {
          // Use WhatsApp template
          const result = await this.client.messages.create({
            from: this.fromNumber,
            to: supplier.phone,
            contentSid: 'HXe276b83a6d465ed643e2fa9ab252e32e',
            contentVariables: JSON.stringify({
              '1': `${tender.quantity} ${tender.unit} ${tender.title}`,
              '2': tender.category,
              '3': new Date(tender.closing_date).toLocaleDateString(),
              '4': tender.description
            })
          });
          console.log(`✅ WhatsApp template message sent to ${supplier.phone}: ${result.sid}`);
          results.push({ supplier: supplier.phone, success: true, sid: result.sid });
        }
      } catch (error) {
        console.error(`❌ Error sending WhatsApp template message to ${supplier.phone}:`, error);
        results.push({ supplier: supplier.phone, success: false, error: error.message });
      }
    }
    // Log notification
    if (this.isMock) {
      mockDB.addNotification({ type: 'tender_alert', recipient: 'all_suppliers', message: `Tender alert for ${tender.tender_id}`, status: 'mocked', sent_at: new Date(), suppliers: results });
      // Also attach to tender for dashboard tracking
      const tenderObj = mockDB.getTenderById(tender.tender_id);
      if (tenderObj) tenderObj.supplier_alerts = results;
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
    let supplierName = bid.supplier_name;
    if (!supplierName) {
      if (this.isMock) {
        const supplier = mockDB.getSupplierByPhone(bid.supplier_phone);
        supplierName = supplier ? supplier.name : bid.supplier_phone;
      } else {
        try {
          const { pool } = require('../config/database');
          const result = await pool.query('SELECT name FROM suppliers WHERE phone = $1', [bid.supplier_phone]);
          supplierName = result.rows[0] ? result.rows[0].name : bid.supplier_phone;
        } catch (err) {
          supplierName = bid.supplier_phone;
        }
      }
    }

    // Look up client phone
    let clientPhone = process.env.ADMIN_PHONE;
    if (tender.client_id) {
      if (this.isMock) {
        const client = mockDB.getClientById(tender.client_id);
        if (client && client.phone) clientPhone = client.phone;
      } else {
        try {
          const { pool } = require('../config/database');
          const result = await pool.query('SELECT phone FROM clients WHERE id = $1', [tender.client_id]);
          if (result.rows[0] && result.rows[0].phone) clientPhone = result.rows[0].phone;
        } catch (err) {}
      }
    }

    if (this.isMock) {
      const message = `Dear client you have received a bid on your tender ${tender.title} details are below:\n  Price: ${bid.price} ${bid.currency}\n  Delivery: ${bid.delivery_time || 'Not specified'}\n  Supplier: ${supplierName}\nwould you like to select this supplier ? send yes or no`;
      console.log(`[MOCK] WhatsApp template message to client: bid_notification`);
      mockDB.addNotification({ type: 'bid_received', recipient: clientPhone, message, status: 'mocked', sent_at: new Date() });
    } else {
      // Use WhatsApp template message
      await this.client.messages.create({
        from: this.fromNumber,
        to: clientPhone,
        contentSid: process.env.BID_NOTIFICATION_TEMPLATE_SID || 'HXce748e6374552b172107da287803e31e',
        contentVariables: JSON.stringify({
          '1': tender.title,
          '2': `${bid.price} ${bid.currency}`,
          '3': bid.delivery_time || 'Not specified',
          '4': supplierName
        })
      });
      await this.logNotification('bid_received', clientPhone, `New bid for ${bid.tender_id}`, { bid_id: bid.id });
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

  // Send bid confirmation to supplier
  async sendBidConfirmationToSupplier(bid, tender) {
    if (this.isMock) {
      const message = `Dear supplier, your bid for tender ${tender.title} has been received.\nPrice: ${bid.price} ${bid.currency}\nDelivery: ${bid.delivery_time || 'Not specified'}\nThank you for your participation.`;
      console.log(`[MOCK] WhatsApp template message to supplier: bid_confirmation`);
      mockDB.addNotification({ type: 'bid_confirmation', recipient: bid.supplier_phone, message, status: 'mocked', sent_at: new Date() });
      return true;
    }
    await this.client.messages.create({
      from: this.fromNumber,
      to: bid.supplier_phone,
      contentSid: process.env.BID_CONFIRMATION_TEMPLATE_SID || 'YOUR_BID_CONFIRMATION_TEMPLATE_SID',
      contentVariables: JSON.stringify({
        '1': tender.title,
        '2': `${bid.price} ${bid.currency}`,
        '3': bid.delivery_time || 'Not specified'
      })
    });
    await this.logNotification('bid_confirmation', bid.supplier_phone, `Bid confirmation for ${bid.id}`, { bid_id: bid.id });
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