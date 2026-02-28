/**
 * Prediction Routes
 */

const express = require('express');
const router = express.Router();
const { getPredictions } = require('../controllers/prediction.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET /api/predictions - Get AI predictions
router.get('/', getPredictions);

module.exports = router;
