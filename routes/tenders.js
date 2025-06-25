const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');
const { pool, hasRealDatabase } = require('../config/database');

// List all tenders
router.get('/', async (req, res) => {
  try {
    if (hasRealDatabase && pool) {
      const result = await pool.query('SELECT * FROM tenders ORDER BY created_at DESC');
      res.json(result.rows);
    } else {
      res.json(mockDB.getTenders());
    }
  } catch (error) {
    console.error('Error fetching tenders:', error);
    res.status(500).json({ error: 'Failed to fetch tenders' });
  }
});

// Create a new tender
router.post('/', async (req, res) => {
  try {
    const { title, category, quantity, unit, closing_date, description } = req.body;
    const tender = {
      tender_id: `tender-${Date.now()}`,
      title,
      category,
      quantity,
      unit,
      closing_date,
      description,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    if (hasRealDatabase && pool) {
      const result = await pool.query(
        'INSERT INTO tenders (tender_id, title, description, category, quantity, unit, closing_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [tender.tender_id, tender.title, tender.description, tender.category, tender.quantity, tender.unit, tender.closing_date]
      );
      res.status(201).json(result.rows[0]);
    } else {
      mockDB.addTender(tender);
      res.status(201).json(tender);
    }
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