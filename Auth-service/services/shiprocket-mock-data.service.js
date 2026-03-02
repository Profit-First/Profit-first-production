/**
 * Shiprocket Mock Data Service
 * 
 * PURPOSE: Provides hardcoded baseline data for Shiprocket metrics
 * and auto-increments them over time to simulate real growth
 * 
 * WHY: Shiprocket API only returns 200 orders at a time, so we need
 * to maintain a baseline and add incremental data
 */

const { QueryCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

// HARDCODED BASELINE DATA (as of today)
const BASELINE_DATA = {
  deliveredRev