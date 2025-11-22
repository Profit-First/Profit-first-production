/**
 * Prediction Controller
 * Handles AI prediction requests
 */

const { generatePredictions } = require('../services/prediction.service');

/**
 * Get predictions for next month
 * GET /api/predictions
 */
const getPredictions = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await generatePredictions(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to generate predictions',
      message: error.message 
    });
  }
};

module.exports = {
  getPredictions
};
