/**
 * Authentication Routes
 * 
 * Defines all authentication-related API endpoints
 * Includes both public routes (signup, login) and protected routes (profile, logout)
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { validateSignup, validateLogin, validateOTP, validateResetOTP, validateEmail, validateNewPassword, validatePassword } = require('../middleware/validation.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// User registration with email verification
router.post('/signup', validateSignup, authController.signup);

// Verify email with OTP code sent to user's email
router.post('/verify-otp', validateOTP, authController.verifyOTP);

// Resend OTP code if user didn't receive it
router.post('/resend-otp', validateEmail, authController.resendOTP);

// Check user status (exists, verified, etc.)
router.post('/check-user', validateEmail, authController.checkUserStatus);

// User login - returns JWT tokens
router.post('/login', validateLogin, authController.login);

// Refresh access token using refresh token
router.post('/refresh-token', authController.refreshToken);

// Initiate password reset - sends code to email
router.post('/forgot-password', validateEmail, authController.forgotPassword);

// Verify password reset OTP code (returns access token)
router.post('/verify-reset-otp', validateResetOTP, authController.verifyResetOTP);

// Resend password reset OTP
router.post('/resend-reset-otp', validateEmail, authController.resendResetOTP);

// Reset password with access token from OTP verification
router.post('/reset-password', validateNewPassword, authController.resetPassword);

// Complete password reset with code from email (legacy - combines verify + reset)
router.post('/confirm-forgot-password', validatePassword, authController.confirmForgotPassword);

// ============================================
// PROTECTED ROUTES (Require authentication)
// ============================================

// Logout user and invalidate all tokens
router.post('/logout', authenticateToken, authController.logout);

// Change password for authenticated user
router.post('/change-password', authenticateToken, validateNewPassword, authController.changePassword);

// Get current user profile information
router.get('/profile', authenticateToken, authController.getProfile);

// ============================================
// OAUTH ROUTES (Social Login)
// ============================================

// Get OAuth login URL for social providers (Google, Facebook, etc.)
// Supports both backend (code) and frontend (token) flows
router.get('/oauth/url', authController.getOAuthUrl);

// OAuth callback - handles redirect from Cognito Hosted UI (backend flow)
router.get('/oauth/callback', authController.handleOAuthCallback);

// Verify OAuth tokens - for frontend OIDC flow (validates and creates user)
router.post('/oauth/verify', authController.verifyOAuthTokens);

module.exports = router;
