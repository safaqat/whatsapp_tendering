const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');
const { pool, hasRealDatabase } = require('../config/database');
const twilioService = require('../services/twilioService');

// List all tenders
router.get('/', async (req, res) => {
  try {
    if (hasRealDatabase && pool) {
      const result = await pool.query('SELECT * FROM tenders ORDER BY created_at DESC');
      res.json(result.rows);
    } else {
      res.json(mockDB.getTenders().map(t => ({ ...t, supplier_alerts: t.supplier_alerts || [] })));
    }
  } catch (error) {
    console.error('Error fetching tenders:', error);
    res.status(500).json({ error: 'Failed to fetch tenders' });
  }
});

// Create a new tender
router.post('/', async (req, res) => {
  try {
    const { title, category, quantity, unit, closing_date, description, client_id } = req.body;
    const tender = {
      tender_id: `tender-${Date.now()}`,
      title,
      category,
      quantity,
      unit,
      closing_date,
      description,
      client_id,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    let savedTender;
    if (hasRealDatabase && pool) {
      const result = await pool.query(
        'INSERT INTO tenders (tender_id, title, description, category, quantity, unit, closing_date, client_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [tender.tender_id, tender.title, tender.description, tender.category, tender.quantity, tender.unit, tender.closing_date, tender.client_id]
      );
      savedTender = result.rows[0];
    } else {
      mockDB.addTender(tender);
      savedTender = tender;
    }

    // Send WhatsApp alerts to all suppliers
    try {
      console.log('📱 Sending tender alerts to suppliers...');
      const alertResults = await twilioService.sendTenderAlert(savedTender);
      console.log('✅ Tender alerts sent:', alertResults);
      
      // Add notification to database
      if (hasRealDatabase && pool) {
        await pool.query(
          'INSERT INTO notifications (type, recipient, message, status) VALUES ($1, $2, $3, $4)',
          ['tender_alert', 'all_suppliers', `Tender alert sent for ${savedTender.tender_id}`, 'sent']
        );
      } else {
        mockDB.addNotification({
          type: 'tender_alert',
          recipient: 'all_suppliers',
          message: `Tender alert sent for ${savedTender.tender_id}`,
          status: 'sent',
          sent_at: new Date()
        });
      }
    } catch (alertError) {
      console.error('❌ Error sending tender alerts:', alertError);
      // Don't fail the tender creation if alerts fail
    }

    res.status(201).json({
      ...savedTender,
      alerts_sent: true
    });
  } catch (error) {
    console.error('Error creating tender:', error);
    res.status(500).json({ error: 'Failed to create tender' });
  }
});

// Get tender by ID
router.get('/:tender_id', async (req, res) => {
  try {
    if (hasRealDatabase && pool) {
      const result = await pool.query('SELECT * FROM tenders WHERE tender_id = $1', [req.params.tender_id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Tender not found' });
      }
      res.json(result.rows[0]);
    } else {
      const tender = mockDB.getTenderById(req.params.tender_id);
      if (!tender) return res.status(404).json({ error: 'Tender not found' });
      res.json(tender);
    }
  } catch (error) {
    console.error('Error fetching tender:', error);
    res.status(500).json({ error: 'Failed to fetch tender' });
  }
});

module.exports = router; 