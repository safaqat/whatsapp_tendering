const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');

// List all tenders
router.get('/', (req, res) => {
  res.json(mockDB.getTenders());
});

// Create a new tender
router.post('/', (req, res) => {
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
  mockDB.addTender(tender);
  res.status(201).json(tender);
});

// Get tender by ID
router.get('/:tender_id', (req, res) => {
  const tender = mockDB.getTenderById(req.params.tender_id);
  if (!tender) return res.status(404).json({ error: 'Tender not found' });
  res.json(tender);
});

module.exports = router; 