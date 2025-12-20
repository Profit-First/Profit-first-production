/**
 * Onboarding Service
 * 
 * Handles onboarding data storage and retrieval in separate DynamoDB table
 * Stores detailed step-wise data for better organization and querying
 */

const { PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

// Separate table for onboarding data
const ONBOARDING_TABLE = process.env.ONBOARDING_TABLE_NAME || 'Onboarding';
const USERS_TABLE = process.env.DYNAMODB_TABLE_NAME || 'Users';

class OnboardingService {
  /**
   * Get User Onboarding Status
   * 
   * @param {string} userId - User's unique ID
   * @returns {Object} Onboarding data or null
   */
  async getOnboardingStatus(userId) {
    try {
      const command = new GetCommand({
        TableName: ONBOARDING_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);
      
      if (result.Item) {
        return {
          success: true,
          data: {
            currentStep: result.Item.currentStep || 1,
            isCompleted: result.Item.isCompleted || false,
            step1: result.Item.step1 || null,
            step2: result.Item.step2 || null,
            step3: result.Item.step3 || null,
            step4: result.Item.step4 || null,
            step5: result.Item.step5 || null
          }
        };
      }
      
      // If no onboarding record exists, create initial one
      const initCommand = new PutCommand({
        TableName: ONBOARDING_TABLE,
        Item: {
          userId,
          currentStep: 1,
          isCompleted: false,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
      
      await dynamoDB.send(initCommand);
      
      return {
        success: true,
        data: {
          currentStep: 1,
          isCompleted: false,
          step1: null,
          step2: null,
          step3: null,
          step4: null,
          step5: null
        }
      };
    } catch (error) {
      console.error('Get onboarding status error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update Onboarding Step
   * 
   * @param {string} userId - User's unique ID
   * @param {number} step - Current step (1-5)
   * @param {Object} stepData - Data for the current step
   * @returns {Object} Success status
   */
  async updateOnboardingStep(userId, step, stepData = {}) {
    try {
      console.log(`📝 Updating onboarding step ${step} for user: ${userId}`);
      console.log(`   Data:`, JSON.stringify(stepData, null, 2));
      
      // Add completion timestamp to step data
      const stepDataWithTimestamp = {
        ...stepData,
        completedAt: new Date().toISOString()
      };
      
      // First, ensure the onboarding record exists
      const getCommand = new GetCommand({
        TableName: ONBOARDING_TABLE,
        Key: { userId }
      });
      
      const existingRecord = await dynamoDB.send(getCommand);
      
      // Calculate next step (current step + 1, max 5)
      const nextStep = Math.min(step + 1, 6);
      
      if (!existingRecord.Item) {
        // Create initial record if it doesn't exist
        console.log(`📝 Creating initial onboarding record for user: ${userId}`);
        const putCommand = new PutCommand({
          TableName: ONBOARDING_TABLE,
          Item: {
            userId,
            currentStep: nextStep, // Save next step to complete
            [`step${step}`]: stepDataWithTimestamp,
            isCompleted: false,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
        
        await dynamoDB.send(putCommand);
        console.log(`✅ Initial record created, step ${step} saved, next step: ${nextStep}`);
      } else {
        // Update existing record
        const updateExpression = `SET currentStep = :nextStep, step${step} = :stepData, updatedAt = :updatedAt`;
        const expressionAttributeValues = {
          ':nextStep': nextStep, // Save next step to complete
          ':stepData': stepDataWithTimestamp,
          ':updatedAt': new Date().toISOString()
        };

        const command = new UpdateCommand({
          TableName: ONBOARDING_TABLE,
          Key: { userId },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW'
        });

        await dynamoDB.send(command);
        console.log(`✅ Step ${step} updated successfully, next step: ${nextStep}`);
      }
      
      // Also update the Users table with next step
      await this.updateUserOnboardingStep(userId, nextStep);
      
      return { 
        success: true, 
        data: {
          currentStep: nextStep, // Return next step
          [`step${step}`]: stepDataWithTimestamp
        }
      };
    } catch (error) {
      console.error(`❌ Update onboarding step ${step} error:`, error.message);
      console.error(`   Full error:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Update User's Onboarding Step in Users Table
   * Keeps Users table in sync with Onboarding table
   * 
   * @param {string} userId - User's unique ID
   * @param {number} step - Current step
   */
  async updateUserOnboardingStep(userId, step) {
    try {
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      
      // Find user by userId
      const scanCommand = new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: 1
      });

      const scanResult = await dynamoDB.send(scanCommand);
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        const user = scanResult.Items[0];
        
        const updateCommand = new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { 
            pk: user.pk,
            sk: user.sk
          },
          UpdateExpression: 'SET onboardingStep = :step, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':step': step,
            ':updatedAt': new Date().toISOString()
          }
        });

        await dynamoDB.send(updateCommand);
        console.log(`✅ Users table updated with step ${step}`);
      }
    } catch (error) {
      console.error('Update user onboarding step error:', error.message);
      // Don't fail the main operation if this fails
    }
  }

  /**
   * Complete Onboarding
   * 
   * @param {string} userId - User's unique ID
   * @param {Object} finalData - Final onboarding data
   * @returns {Object} Success status
   */
  async completeOnboarding(userId, finalData = {}) {
    try {
      console.log(`🎉 Completing onboarding for user: ${userId}`);
      
      const command = new UpdateCommand({
        TableName: ONBOARDING_TABLE,
        Key: { userId },
        UpdateExpression: 'SET isCompleted = :completed, completedAt = :completedAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':completed': true,
          ':completedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamoDB.send(command);
      
      // Update Users table
      await this.updateUserOnboardingCompleted(userId);
      
      console.log(`✅ Onboarding completed successfully`);
      
      return { 
        success: true, 
        message: 'Onboarding completed successfully',
        data: result.Attributes
      };
    } catch (error) {
      console.error('❌ Complete onboarding error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Update User's Onboarding Completed Status in Users Table
   * 
   * @param {string} userId - User's unique ID
   */
  async updateUserOnboardingCompleted(userId) {
    try {
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      
      // Find user by userId
      const scanCommand = new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: 1
      });

      const scanResult = await dynamoDB.send(scanCommand);
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        const user = scanResult.Items[0];
        
        const updateCommand = new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { 
            pk: user.pk,
            sk: user.sk
          },
          UpdateExpression: 'SET onboardingCompleted = :completed, onboardingStep = :step, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':completed': true,
            ':step': 6,
            ':updatedAt': new Date().toISOString()
          }
        });

        await dynamoDB.send(updateCommand);
        console.log(`✅ Users table updated - onboarding completed`);
      }
    } catch (error) {
      console.error('Update user onboarding completed error:', error.message);
      // Don't fail the main operation if this fails
    }
  }

  /**
   * Get Onboarding Data
   * 
   * @param {string} userId - User's unique ID
   * @returns {Object} Complete onboarding data
   */
  async getOnboardingData(userId) {
    try {
      const command = new GetCommand({
        TableName: ONBOARDING_TABLE,
        Key: { userId }
      });

      const result = await dynamoDB.send(command);
      
      if (result.Item) {
        return {
          success: true,
          data: {
            userId: result.Item.userId,
            currentStep: result.Item.currentStep || 1,
            isCompleted: result.Item.isCompleted || false,
            startedAt: result.Item.startedAt,
            completedAt: result.Item.completedAt,
            step1: result.Item.step1 || null,
            step2: result.Item.step2 || null,
            step3: result.Item.step3 || null,
            step4: result.Item.step4 || null,
            step5: result.Item.step5 || null
          }
        };
      }
      
      return { success: false, error: 'Onboarding data not found' };
    } catch (error) {
      console.error('Get onboarding data error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OnboardingService();
