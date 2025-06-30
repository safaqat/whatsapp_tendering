const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const openaiService = require('../services/openaiService');
const mockDB = require('../config/mockDatabase');

// Try to import real database, fallback to mock
let pool;
try {
  const dbConfig = require('../config/database');
  pool = dbConfig.pool;
} catch (error) {
  console.log('⚠️ Using mock database for demo');
}

// Handle incoming WhatsApp messages
router.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 Received webhook from Twilio:', {
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url
    });

    // Verify Twilio signature in production
    if (process.env.NODE_ENV === 'production') {
      const isValid = twilioService.verifyWebhookSignature(req);
      if (!isValid) {
        console.error('❌ Invalid Twilio signature');
        return res.status(403).send('Forbidden');
      }
    }

    const { Body, From, MediaUrl0, MessageType, NumMedia } = req.body;
    
    console.log(`📱 Processing WhatsApp message from ${From}:`, {
      body: Body,
      mediaUrl: MediaUrl0,
      messageType: MessageType,
      numMedia: NumMedia
    });

    // Handle text messages
    if (MessageType === 'text' && Body) {
      await handleTextMessage(From, Body);
    }
    // Handle voice messages
    else if (NumMedia > 0 && MediaUrl0) {
      await handleVoiceMessage(From, MediaUrl0);
    }
    // Handle admin commands
    else if (Body && Body.startsWith('/')) {
      await handleAdminCommand(From, Body);
    }

    // Send TwiML response
    res.status(200).send('<Response></Response>');
  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
    res.status(500).send('<Response></Response>');
  }
});

// Simulation endpoint for testing
router.post('/simulate', async (req, res) => {
  try {
    const { Body, From, MediaUrl0, MessageType, NumMedia } = req.body;
    
    console.log(`🧪 [SIMULATION] Received WhatsApp message from ${From}:`, {
      body: Body,
      mediaUrl: MediaUrl0,
      messageType: MessageType,
      numMedia: NumMedia
    });

    // Handle text messages
    if (MessageType === 'text' && Body) {
      await handleTextMessage(From, Body);
    }
    // Handle voice messages
    else if (NumMedia > 0 && MediaUrl0) {
      await handleVoiceMessage(From, MediaUrl0);
    }
    // Handle admin commands
    else if (Body && Body.startsWith('/')) {
      await handleAdminCommand(From, Body);
    }

    res.json({ success: true, message: 'Simulation completed' });
  } catch (error) {
    console.error('❌ Error in simulation:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// Handle text messages
async function handleTextMessage(from, body) {
  try {
    // Process the text message
    const processed = await openaiService.processTextMessage(body);
    
    // Check if this is a bid response
    const activeTender = await getActiveTender();
    if (activeTender && processed.bidInfo.price) {
      await saveBid(from, processed, activeTender);
      
      // Send confirmation to supplier
      const confirmationMessage = `✅ *Bid Received*

💰 *Price*: ${processed.bidInfo.price} ${processed.bidInfo.currency}
⏰ *Delivery*: ${processed.bidInfo.delivery_time || 'Not specified'}
📋 *Tender*: ${activeTender.title}

We'll review your bid and get back to you soon.

Tender ID: ${activeTender.tender_id}`;

      await twilioService.sendWhatsAppMessage(from, confirmationMessage);
    } else {
      // Send help message
      const helpMessage = `💬 *How to submit a bid*

Reply with your price and delivery time, for example:
• "25 OMR, ready in 2 days"
• "30 OMR, available next week"
• "20 OMR, can deliver tomorrow"

You can also send a voice message with your bid details.`;

      await twilioService.sendWhatsAppMessage(from, helpMessage);
    }
  } catch (error) {
    console.error('❌ Error handling text message:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Sorry, there was an error processing your message. Please try again.');
  }
}

// Handle voice messages
async function handleVoiceMessage(from, mediaUrl) {
  try {
    // Download the audio file
    const audioBuffer = await downloadAudioFile(mediaUrl);
    
    // Process the voice message
    const processed = await openaiService.processVoiceMessage(audioBuffer);
    
    // Check if this is a bid response
    const activeTender = await getActiveTender();
    if (activeTender && processed.bidInfo.price) {
      await saveBid(from, processed, activeTender);
      
      // Send confirmation to supplier
      const confirmationMessage = `✅ *Voice Bid Received*

🎤 *Transcribed*: "${processed.translated}"
💰 *Price*: ${processed.bidInfo.price} ${processed.bidInfo.currency}
⏰ *Delivery*: ${processed.bidInfo.delivery_time || 'Not specified'}
📋 *Tender*: ${activeTender.title}

We'll review your bid and get back to you soon.

Tender ID: ${activeTender.tender_id}`;

      await twilioService.sendWhatsAppMessage(from, confirmationMessage);
    } else {
      // Send help message
      const helpMessage = `🎤 *Voice Message Received*

We couldn't extract bid information from your voice message. Please try again with:
• Clear price (e.g., "25 OMR")
• Delivery time (e.g., "2 days", "next week")
• Or send a text message instead`;

      await twilioService.sendWhatsAppMessage(from, helpMessage);
    }
  } catch (error) {
    console.error('❌ Error handling voice message:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Sorry, there was an error processing your voice message. Please try again.');
  }
}

// Handle admin commands
async function handleAdminCommand(from, body) {
  try {
    // Check if sender is admin
    if (from !== process.env.ADMIN_PHONE) {
      await twilioService.sendWhatsAppMessage(from, '❌ Access denied. Admin privileges required.');
      return;
    }

    const command = body.toLowerCase().trim();
    
    if (command.startsWith('/newtender')) {
      await handleNewTenderCommand(from, body);
    } else if (command.startsWith('/listtenders')) {
      await handleListTendersCommand(from);
    } else if (command.startsWith('/listbids')) {
      await handleListBidsCommand(from);
    } else if (command.startsWith('/winner')) {
      await handleWinnerCommand(from, body);
    } else {
      await twilioService.sendWhatsAppMessage(from, `📋 *Admin Commands*

/newtender [details] - Create new tender
/listtenders - List all tenders
/listbids [tender_id] - List bids for tender
/winner [tender_id] [bid_id] - Mark bid as winner

Example: /newtender "100 A4 Paper Packs" "Stationery" 100 "packs" "2024-06-25"`);
    }
  } catch (error) {
    console.error('❌ Error handling admin command:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Error processing admin command.');
  }
}

// Handle new tender command
async function handleNewTenderCommand(from, body) {
  try {
    const parts = body.split('"').filter(part => part.trim());
    if (parts.length < 5) {
      await twilioService.sendWhatsAppMessage(from, '❌ Invalid format. Use: /newtender "title" "category" quantity "unit" "closing_date"');
      return;
    }

    const tender = {
      tender_id: `tender-${Date.now()}`,
      title: parts[1],
      category: parts[3],
      quantity: parseInt(parts[5]),
      unit: parts[7],
      closing_date: new Date(parts[9]),
      description: parts[1] // Using title as description for now
    };

    // Save tender to database
    if (pool) {
      await pool.query(
        'INSERT INTO tenders (tender_id, title, description, category, quantity, unit, closing_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [tender.tender_id, tender.title, tender.description, tender.category, tender.quantity, tender.unit, tender.closing_date]
      );
    } else {
      mockDB.addTender(tender);
    }

    // Send tender alert to all suppliers
    await twilioService.sendTenderAlert(tender);

    await twilioService.sendWhatsAppMessage(from, `✅ *Tender Created*

📋 *ID*: ${tender.tender_id}
📌 *Title*: ${tender.title}
💰 *Category*: ${tender.category}
📊 *Quantity*: ${tender.quantity} ${tender.unit}
⏳ *Closing*: ${tender.closing_date.toLocaleDateString()}

Tender alert sent to all suppliers.`);
  } catch (error) {
    console.error('❌ Error creating tender:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Error creating tender.');
  }
}

// Handle list tenders command
async function handleListTendersCommand(from) {
  try {
    let tenders;
    if (pool) {
      const result = await pool.query('SELECT tender_id, title, category, status, closing_date FROM tenders ORDER BY created_at DESC LIMIT 10');
      tenders = result.rows;
    } else {
      tenders = mockDB.getTenders().slice(-10).reverse();
    }
    
    if (tenders.length === 0) {
      await twilioService.sendWhatsAppMessage(from, '📋 No tenders found.');
      return;
    }

    let message = '📋 *Recent Tenders*\n\n';
    tenders.forEach(tender => {
      message += `📌 *${tender.tender_id}*\n`;
      message += `📝 ${tender.title}\n`;
      message += `💰 ${tender.category}\n`;
      message += `📅 ${new Date(tender.closing_date).toLocaleDateString()}\n`;
      message += `📊 ${tender.status}\n\n`;
    });

    await twilioService.sendWhatsAppMessage(from, message);
  } catch (error) {
    console.error('❌ Error listing tenders:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Error listing tenders.');
  }
}

// Handle list bids command
async function handleListBidsCommand(from) {
  try {
    let bids;
    if (pool) {
      const result = await pool.query(`
        SELECT b.*, t.title 
        FROM bids b 
        JOIN tenders t ON b.tender_id = t.tender_id 
        ORDER BY b.created_at DESC 
        LIMIT 10
      `);
      bids = result.rows;
    } else {
      bids = mockDB.getBids().slice(-10).reverse();
    }
    
    if (bids.length === 0) {
      await twilioService.sendWhatsAppMessage(from, '📋 No bids found.');
      return;
    }

    let message = '📋 *Recent Bids*\n\n';
    bids.forEach(bid => {
      message += `📞 *${bid.supplier_phone}*\n`;
      message += `📝 ${bid.tender_id}\n`;
      message += `💰 ${bid.price} ${bid.currency}\n`;
      message += `⏰ ${bid.delivery_time || 'Not specified'}\n`;
      message += `🌐 ${bid.language || 'Unknown'}\n\n`;
    });

    await twilioService.sendWhatsAppMessage(from, message);
  } catch (error) {
    console.error('❌ Error listing bids:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Error listing bids.');
  }
}

// Handle winner command
async function handleWinnerCommand(from, body) {
  try {
    const parts = body.split(' ');
    if (parts.length < 3) {
      await twilioService.sendWhatsAppMessage(from, '❌ Invalid format. Use: /winner [tender_id] [bid_id]');
      return;
    }

    const tenderId = parts[1];
    const bidId = parts[2];

    // Get bid details
    let bid, tender;
    if (pool) {
      const bidResult = await pool.query('SELECT * FROM bids WHERE id = $1 AND tender_id = $2', [bidId, tenderId]);
      if (bidResult.rows.length === 0) {
        await twilioService.sendWhatsAppMessage(from, '❌ Bid not found.');
        return;
      }
      bid = bidResult.rows[0];
      const tenderResult = await pool.query('SELECT * FROM tenders WHERE tender_id = $1', [tenderId]);
      tender = tenderResult.rows[0];

      // Update bid status
      await pool.query('UPDATE bids SET status = $1 WHERE id = $2', ['winner', bidId]);
    } else {
      bid = mockDB.getBidById(bidId);
      tender = mockDB.getTenderById(tenderId);
      if (!bid || !tender) {
        await twilioService.sendWhatsAppMessage(from, '❌ Bid or tender not found.');
        return;
      }
      mockDB.updateBidStatus(bidId, 'winner');
    }

    // Send winning notification to supplier
    await twilioService.sendWinningBidNotification(bid, tender);

    await twilioService.sendWhatsAppMessage(from, `✅ *Winner Selected*

📞 Supplier: ${bid.supplier_phone}
💰 Price: ${bid.price} ${bid.currency}
📋 Tender: ${tender.title}

Winner notification sent to supplier.`);
  } catch (error) {
    console.error('❌ Error selecting winner:', error);
    await twilioService.sendWhatsAppMessage(from, '❌ Error selecting winner.');
  }
}

// Get active tender
async function getActiveTender() {
  try {
    let tender;
    if (pool) {
      const result = await pool.query(
        'SELECT * FROM tenders WHERE status = $1 AND closing_date > NOW() ORDER BY created_at DESC LIMIT 1',
        ['active']
      );
      tender = result.rows[0] || null;
    } else {
      const tenders = mockDB.getTenders();
      tender = tenders.find(t => t.status === 'active' && new Date(t.closing_date) > new Date()) || null;
    }
    return tender;
  } catch (error) {
    console.error('❌ Error getting active tender:', error);
    return null;
  }
}

// Save bid to database
async function saveBid(supplierPhone, processed, tender) {
  try {
    const bid = {
      id: `bid-${Date.now()}`,
      tender_id: tender.tender_id,
      supplier_phone: supplierPhone,
      price: processed.bidInfo.price,
      currency: processed.bidInfo.currency,
      delivery_time: processed.bidInfo.delivery_time,
      availability: processed.bidInfo.availability,
      language: processed.language,
      original_message: processed.original,
      transcribed_message: processed.translated,
      status: 'pending',
      created_at: new Date()
    };

    if (pool) {
      const result = await pool.query(
        `INSERT INTO bids (
          tender_id, supplier_phone, price, currency, delivery_time, 
          availability, language, original_message, transcribed_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          bid.tender_id, bid.supplier_phone, bid.price, bid.currency,
          bid.delivery_time, bid.availability, bid.language,
          bid.original_message, bid.transcribed_message
        ]
      );
      Object.assign(bid, result.rows[0]);
    } else {
      mockDB.addBid(bid);
    }
    
    // Send notification to coordinators
    await twilioService.sendBidNotification(bid, tender);
    // Send confirmation to supplier (template)
    await twilioService.sendBidConfirmationToSupplier(bid, tender);
    
    console.log(`✅ Bid saved: ${bid.id} for tender ${tender.tender_id}`);
    return bid;
  } catch (error) {
    console.error('❌ Error saving bid:', error);
    throw error;
  }
}

// Download audio file from Twilio
async function downloadAudioFile(mediaUrl) {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('❌ Error downloading audio file:', error);
    throw error;
  }
}

module.exports = router; 