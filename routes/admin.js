const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');
const { pool, hasRealDatabase } = require('../config/database');
const twilioService = require('../services/twilioService');

// Get system status
router.get('/status', async (req, res) => {
  try {
    const status = {
      database: hasRealDatabase ? 'connected' : 'mock',
      twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not_configured',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
      admin_phone: process.env.ADMIN_PHONE ? 'configured' : 'not_configured',
      suppliers: 0,
      tenders: 0,
      bids: 0
    };

    if (hasRealDatabase && pool) {
      const suppliersResult = await pool.query('SELECT COUNT(*) FROM suppliers WHERE is_active = true');
      const tendersResult = await pool.query('SELECT COUNT(*) FROM tenders');
      const bidsResult = await pool.query('SELECT COUNT(*) FROM bids');
      
      status.suppliers = parseInt(suppliersResult.rows[0].count);
      status.tenders = parseInt(tendersResult.rows[0].count);
      status.bids = parseInt(bidsResult.rows[0].count);
    } else {
      status.suppliers = mockDB.getActiveSuppliers().length;
      status.tenders = mockDB.getTenders().length;
      status.bids = mockDB.getBids().length;
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// Get all suppliers
router.get('/suppliers', async (req, res) => {
  try {
    let suppliers;
    if (hasRealDatabase && pool) {
      const result = await pool.query('SELECT * FROM suppliers ORDER BY created_at DESC');
      suppliers = result.rows;
    } else {
      suppliers = mockDB.getActiveSuppliers();
    }
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Add new supplier
router.post('/suppliers', async (req, res) => {
  try {
    const { phone, name, email, categories, language } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const supplier = {
      phone: phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
      name: name || 'Unknown Supplier',
      email: email || null,
      categories: categories ? categories.split(',') : [],
      language: language || 'English',
      is_active: true,
      created_at: new Date()
    };

    if (hasRealDatabase && pool) {
      const result = await pool.query(
        'INSERT INTO suppliers (phone, name, email, categories, language) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [supplier.phone, supplier.name, supplier.email, supplier.categories, supplier.language]
      );
      res.status(201).json(result.rows[0]);
    } else {
      mockDB.addSupplier(supplier);
      res.status(201).json(supplier);
    }
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

// Update supplier
router.put('/suppliers/:id', async (req, res) => {
  try {
    const { name, email, categories, language, is_active } = req.body;
    
    if (hasRealDatabase && pool) {
      const result = await pool.query(
        'UPDATE suppliers SET name = $1, email = $2, categories = $3, language = $4, is_active = $5 WHERE id = $6 RETURNING *',
        [name, email, categories ? categories.split(',') : [], language, is_active, req.params.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      res.json(result.rows[0]);
    } else {
      const supplier = mockDB.updateSupplier(req.params.id, { name, email, categories, language, is_active });
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      res.json(supplier);
    }
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete supplier
router.delete('/suppliers/:id', async (req, res) => {
  try {
    if (hasRealDatabase && pool) {
      const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      res.json({ message: 'Supplier deleted successfully' });
    } else {
      const deleted = mockDB.deleteSupplier(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      res.json({ message: 'Supplier deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Send test message to supplier
router.post('/suppliers/:id/test', async (req, res) => {
  try {
    let supplier;
    if (hasRealDatabase && pool) {
      const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      supplier = result.rows[0];
    } else {
      supplier = mockDB.getSupplierById(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
    }

    const testMessage = `🧪 *Test Message*

This is a test message from the WhatsApp Tendering System.

If you receive this message, your WhatsApp integration is working correctly!

📞 Phone: ${supplier.phone}
👤 Name: ${supplier.name}
🌐 Language: ${supplier.language}`;

    await twilioService.sendWhatsAppMessage(supplier.phone, testMessage);
    
    res.json({ message: 'Test message sent successfully' });
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// Get system logs
router.get('/logs', async (req, res) => {
  try {
    let notifications;
    if (hasRealDatabase && pool) {
      const result = await pool.query('SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 50');
      notifications = result.rows;
    } else {
      notifications = mockDB.getNotifications().slice(-50).reverse();
    }
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Clear old logs
router.delete('/logs', async (req, res) => {
  try {
    if (hasRealDatabase && pool) {
      await pool.query('DELETE FROM notifications WHERE sent_at < NOW() - INTERVAL \'30 days\'');
      res.json({ message: 'Old logs cleared successfully' });
    } else {
      mockDB.clearOldNotifications();
      res.json({ message: 'Old logs cleared successfully' });
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

module.exports = router; 