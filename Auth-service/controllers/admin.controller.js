/**
 * Admin Controller
 * 
 * Handles admin operations like viewing all users, user management
 * All endpoints require admin authentication
 */

const dynamoDBService = require('../services/dynamodb.service');
const cognitoService = require('../services/cognito.service');

class AdminController {
  /**
   * Get All Users
   * Returns list of all registered users
   * 
   * @route GET /api/admin/users
   * @access Admin only
   */
  async getAllUsers(req, res) {
    try {
      const result = await dynamoDBService.getAllUsers();

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Remove sensitive data before sending
      const users = result.data.map(user => ({
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));

      res.status(200).json({
        total: users.length,
        users: users
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: 'Failed to fetch users. Please try again.' });
    }
  }

  /**
   * Get User by ID
   * Returns detailed information about a specific user
   * 
   * @route GET /api/admin/users/:userId
   * @access Admin only
   */
  async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const result = await dynamoDBService.getUserById(userId);

      if (!result.success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove sensitive data
      const user = {
        userId: result.data.userId,
        email: result.data.email,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        isVerified: result.data.isVerified,
        authProvider: result.data.authProvider,
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
        lastLogin: result.data.lastLogin
      };

      res.status(200).json({ user });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({ error: 'Failed to fetch user. Please try again.' });
    }
  }

  /**
   * Delete User
   * Deletes user from both Cognito and DynamoDB
   * 
   * @route DELETE /api/admin/users/:userId
   * @access Admin only
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      // Get user details first
      const userResult = await dynamoDBService.getUserById(userId);
      if (!userResult.success) {
        return res.status(404).json({ error: 'User not found' });
      }

      const email = userResult.data.email;

      // Delete from DynamoDB
      const deleteResult = await dynamoDBService.deleteUser(userId);
      if (!deleteResult.success) {
        return res.status(400).json({ error: deleteResult.error });
      }

      res.status(200).json({
        message: 'User deleted successfully',
        userId: userId
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user. Please try again.' });
    }
  }

  /**
   * Get Dashboard Statistics
   * Returns overview statistics for admin dashboard
   * 
   * @route GET /api/admin/stats
   * @access Admin only
   */
  async getStats(req, res) {
    try {
      const usersResult = await dynamoDBService.getAllUsers();

      if (!usersResult.success) {
        return res.status(400).json({ error: usersResult.error });
      }

      const users = usersResult.data;

      // Calculate statistics
      const stats = {
        totalUsers: users.length,
        verifiedUsers: users.filter(u => u.isVerified).length,
        unverifiedUsers: users.filter(u => !u.isVerified).length,
        authProviders: {
          cognito: users.filter(u => u.authProvider === 'cognito').length,
          google: users.filter(u => u.authProvider === 'google').length,
          facebook: users.filter(u => u.authProvider === 'facebook').length,
          other: users.filter(u => !['cognito', 'google', 'facebook'].includes(u.authProvider)).length
        },
        recentUsers: users
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map(u => ({
            userId: u.userId,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            createdAt: u.createdAt
          }))
      };

      res.status(200).json(stats);
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics. Please try again.' });
    }
  }

  /**
   * Update User Status
   * Enable/disable user account
   * 
   * @route PATCH /api/admin/users/:userId/status
   * @access Admin only
   */
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      const result = await dynamoDBService.updateUserStatus(userId, isActive);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(200).json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: result.data
      });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ error: 'Failed to update user status. Please try again.' });
    }
  }
}

module.exports = new AdminController();
