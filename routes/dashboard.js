const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');

// Dashboard summary
router.get('/summary', (req, res) => {
  res.json({
    tenders: mockDB.getTenders().length,
    bids: mockDB.getBids().length,
    suppliers: mockDB.suppliers.length,
    notifications: mockDB.getNotifications().length
  });
});

// Recent tenders
router.get('/tenders', (req, res) => {
  res.json(mockDB.getTenders().slice(-10).reverse());
});

// Recent bids
router.get('/bids', (req, res) => {
  res.json(mockDB.getBids().slice(-10).reverse());
});

module.exports = router; 