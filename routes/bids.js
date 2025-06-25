const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');

// List all bids
router.get('/', (req, res) => {
  res.json(mockDB.getBids());
});

// Create a new bid
router.post('/', (req, res) => {
  const { tender_id, supplier_phone, price, currency, delivery_time, availability, language, original_message, transcribed_message } = req.body;
  const bid = {
    id: `bid-${Date.now()}`,
    tender_id,
    supplier_phone,
    price,
    currency,
    delivery_time,
    availability,
    language,
    original_message,
    transcribed_message,
    status: 'pending',
    created_at: new Date()
  };
  mockDB.addBid(bid);
  res.status(201).json(bid);
});

// Get bid by ID
router.get('/:bid_id', (req, res) => {
  const bid = mockDB.getBidById(req.params.bid_id);
  if (!bid) return res.status(404).json({ error: 'Bid not found' });
  res.json(bid);
});

module.exports = router; 