const express = require('express');
const router = express.Router();
const callingAgentController = require('../controllers/calling-agent.controller');

// Get order confirmation script
router.post('/script/order-confirmation', callingAgentController.getOrderConfirmationScript);

// Get abandoned cart script
router.post('/script/abandoned-cart', callingAgentController.getAbandonedCartScript);

// Get all available scripts
router.get('/scripts', callingAgentController.getAllScripts);

// Test script with sample data
router.get('/test/:scriptType', callingAgentController.testScript);

module.exports = router;
