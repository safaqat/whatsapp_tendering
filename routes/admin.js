const express = require('express');
const router = express.Router();
const mockDB = require('../config/mockDatabase');

// List all suppliers
router.get('/suppliers', (req, res) => {
  res.json(mockDB.suppliers);
});

// List all notifications
router.get('/notifications', (req, res) => {
  res.json(mockDB.getNotifications());
});

module.exports = router; 