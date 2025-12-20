/**
 * Authentication Service
 * 
 * Central service for all authentication-related API calls.
 * This service communicates with the backend Auth-service.
 * 
 * BACKEND BASE URL: /api/auth
 * 
 * AUTHENTICATION FLOW:
 * 1. Signup → Verify OTP → Login → Store Tokens → Access Protected Routes
 * 2. OAuth → Callback → Store Tokens → Access Protected Routes
 * 
 * TOKEN MANAGEMENT:
 * - accessToken: Short-lived (1 hour), used for API requests
 * - idToken: Contains user claims, used for user info
 * - refreshToken: Long-lived (30 days), used to get new access tokens
 * 
 * STORAGE:
 * - All tokens stored in localStorage
 * - User data stored as JSON string
 * - Tokens automatically included in requests via axios interceptor
 * 
 * ERROR HANDLING:
 * - All functions return response.data on success
 * - Errors are thrown and should be caught by caller
 * - Use try-catch in components when calling these functions
 */

import axiosInstance from "../../axios";

// Base URL for auth endpoints
const AUTH_BASE = "/auth";

// ============= PUBLIC ENDPOINTS =============

/**
 * Health Check
 * GET /health
 */
export const healthCheck = async () => {
  const response = await axiosInstance.get("/health");
  return response.data;
};

/**
 * User Signup
 * POST /api/auth/signup
 */
export const signup = async (userData) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/signup`, {
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    password: userData.password,
  });
  return response.data;
};

/**
 * Verify OTP
 * POST /api/auth/verify-otp
 */
export const verifyOTP = async (email, otp) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/verify-otp`, {
    email,
    otp,
  });
  return response.data;
};

/**
 * Resend OTP
 * POST /api/auth/resend-otp
 */
export const resendOTP = async (email) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/resend-otp`, {
    email,
  });
  return response.data;
};

/**
 * User Login
 * 
 * Authenticates user with email and password.
 * 
 * BACKEND: POST /api/auth/login
 * 
 * REQUEST:
 * {
 *   email: string,
 *   password: string
 * }
 * 
 * RESPONSE:
 * {
 *   message: "Login successful",
 *   user: {
 *     userId: string,           // Unique user ID from DynamoDB
 *     email: string,
 *     firstName: string,
 *     lastName: string,
 *     isVerified: boolean,
 *     onboardingCompleted: boolean,  // CRITICAL for navigation
 *     onboardingStep: number         // Current onboarding step (1-5)
 *   },
 *   tokens: {
 *     accessToken: string,      // JWT for API requests (1 hour)
 *     idToken: string,          // JWT with user claims
 *     refreshToken: string      // For getting new access tokens (30 days)
 *   }
 * }
 * 
 * USAGE:
 * const response = await login(email, password);
 * storeTokens(response.tokens);
 * storeUserData(response.user);
 * 
 * NAVIGATION LOGIC:
 * if (response.user.onboardingCompleted) {
 *   navigate('/dashboard');
 * } else {
 *   navigate('/onboarding');
 * }
 */
export const login = async (email, password) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/login`, {
    email,
    password,
  });
  return response.data;
};

/**
 * Refresh Token
 * POST /api/auth/refresh-token
 */
export const refreshToken = async (refreshToken) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/refresh-token`, {
    refreshToken,
  });
  return response.data;
};

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (email) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/forgot-password`, {
    email,
  });
  return response.data;
};

/**
 * Verify Reset OTP (Step 2 of password reset)
 * POST /api/auth/verify-reset-otp
 * Returns: { message, accessToken } - Token valid for 10 minutes
 */
export const verifyResetOTP = async (email, code) => {
  console.log('Calling verify-reset-otp endpoint with:', { email, code });
  const response = await axiosInstance.post(`${AUTH_BASE}/verify-reset-otp`, {
    email,
    code,
  });
  console.log('verify-reset-otp response:', response.data);
  return response.data;
};

/**
 * Resend Reset OTP
 * POST /api/auth/resend-reset-otp
 */
export const resendResetOTP = async (email) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/resend-reset-otp`, {
    email,
  });
  return response.data;
};

/**
 * Reset Password (Step 3 of password reset)
 * POST /api/auth/reset-password
 * Requires: accessToken from verify-reset-otp
 */
export const resetPassword = async (accessToken, newPassword) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/reset-password`, {
    newPassword,
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

/**
 * Confirm Forgot Password (Legacy - combined step 2 & 3)
 * POST /api/auth/confirm-forgot-password
 * @deprecated Use verifyResetOTP + resetPassword instead
 */
export const confirmForgotPassword = async (email, code, newPassword) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/confirm-forgot-password`, {
    email,
    code,
    newPassword,
  });
  return response.data;
};

// ============= OAUTH ENDPOINTS =============

/**
 * Get OAuth URL
 * GET /api/auth/oauth/url
 */
export const getOAuthURL = async (provider) => {
  const response = await axiosInstance.get(`${AUTH_BASE}/oauth/url`, {
    params: { provider },
  });
  return response.data;
};

/**
 * OAuth Callback
 * GET /api/auth/oauth/callback
 */
export const oauthCallback = async (code) => {
  const response = await axiosInstance.get(`${AUTH_BASE}/oauth/callback`, {
    params: { code },
  });
  return response.data;
};

// ============= PROTECTED ENDPOINTS =============

/**
 * Get User Profile
 * GET /api/auth/profile
 * Requires: Authorization header with Bearer token
 */
export const getUserProfile = async () => {
  const response = await axiosInstance.get(`${AUTH_BASE}/profile`);
  return response.data;
};

/**
 * Logout
 * POST /api/auth/logout
 * Requires: Authorization header with Bearer token
 */
export const logout = async () => {
  const response = await axiosInstance.post(`${AUTH_BASE}/logout`);
  return response.data;
};

/**
 * Change Password
 * POST /api/auth/change-password
 * Requires: Authorization header with Bearer token
 */
export const changePassword = async (oldPassword, newPassword) => {
  const response = await axiosInstance.post(`${AUTH_BASE}/change-password`, {
    oldPassword,
    newPassword,
  });
  return response.data;
};

// ============= ADMIN ENDPOINTS =============

/**
 * Get Dashboard Statistics
 * GET /api/admin/stats
 * Requires: x-admin-key header
 */
export const getAdminStats = async (adminKey) => {
  const response = await axiosInstance.get("/admin/stats", {
    headers: { "x-admin-key": adminKey },
  });
  return response.data;
};

/**
 * Get All Users
 * GET /api/admin/users
 * Requires: x-admin-key header
 */
export const getAllUsers = async (adminKey) => {
  const response = await axiosInstance.get("/admin/users", {
    headers: { "x-admin-key": adminKey },
  });
  return response.data;
};

/**
 * Get User by ID
 * GET /api/admin/users/:userId
 * Requires: x-admin-key header
 */
export const getUserById = async (userId, adminKey) => {
  const response = await axiosInstance.get(`/admin/users/${userId}`, {
    headers: { "x-admin-key": adminKey },
  });
  return response.data;
};

/**
 * Delete User
 * DELETE /api/admin/users/:userId
 * Requires: x-admin-key header
 */
export const deleteUser = async (userId, adminKey) => {
  const response = await axiosInstance.delete(`/admin/users/${userId}`, {
    headers: { "x-admin-key": adminKey },
  });
  return response.data;
};

/**
 * Update User Status
 * PATCH /api/admin/users/:userId/status
 * Requires: x-admin-key header
 */
export const updateUserStatus = async (userId, isActive, adminKey) => {
  const response = await axiosInstance.patch(
    `/admin/users/${userId}/status`,
    { isActive },
    { headers: { "x-admin-key": adminKey } }
  );
  return response.data;
};

// ============= TOKEN MANAGEMENT HELPERS =============

// ============= TOKEN MANAGEMENT HELPERS =============

/**
 * Store Authentication Tokens
 * 
 * Saves JWT tokens to localStorage for persistent authentication.
 * These tokens are used for all authenticated API requests.
 * 
 * TOKEN TYPES:
 * - accessToken: Used in Authorization header for API requests (expires in 1 hour)
 * - idToken: Contains user claims (name, email, etc.)
 * - refreshToken: Used to get new access tokens (expires in 30 days)
 * 
 * USAGE:
 * const response = await login(email, password);
 * storeTokens(response.tokens);
 * 
 * SECURITY NOTE:
 * - Tokens are stored in localStorage (vulnerable to XSS)
 * - In production, consider using httpOnly cookies for better security
 * - Always use HTTPS to prevent token interception
 */
export const storeTokens = (tokens) => {
  if (tokens.accessToken) {
    localStorage.setItem("accessToken", tokens.accessToken);
  }
  if (tokens.idToken) {
    localStorage.setItem("idToken", tokens.idToken);
  }
  if (tokens.refreshToken) {
    localStorage.setItem("refreshToken", tokens.refreshToken);
  }
};

/**
 * Get Stored Tokens
 * 
 * Retrieves all authentication tokens from localStorage.
 * 
 * RETURNS:
 * {
 *   accessToken: string | null,
 *   idToken: string | null,
 *   refreshToken: string | null
 * }
 * 
 * USAGE:
 * const tokens = getStoredTokens();
 * if (tokens.accessToken) {
 *   // User is logged in
 * }
 */
export const getStoredTokens = () => {
  return {
    accessToken: localStorage.getItem("accessToken"),
    idToken: localStorage.getItem("idToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
};

/**
 * Clear All Stored Tokens
 * 
 * Removes all authentication tokens from localStorage.
 * Called during logout to ensure user is fully logged out.
 * 
 * CLEARS:
 * - accessToken, idToken, refreshToken (new structure)
 * - token, userId (legacy structure for backward compatibility)
 * 
 * USAGE:
 * clearTokens();
 * navigate('/login');
 */
export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("idToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("token"); // Legacy token
  localStorage.removeItem("userId"); // Legacy userId
};

/**
 * Store User Data
 * 
 * Saves user information to localStorage.
 * This data is used throughout the app for:
 * - Displaying user name
 * - Checking onboarding status
 * - User-specific features
 * 
 * STORED DATA:
 * {
 *   userId: string,
 *   email: string,
 *   firstName: string,
 *   lastName: string,
 *   isVerified: boolean,
 *   onboardingCompleted: boolean,
 *   onboardingStep: number
 * }
 * 
 * USAGE:
 * const response = await login(email, password);
 * storeUserData(response.user);
 */
export const storeUserData = (user) => {
  if (user.userId) {
    localStorage.setItem("userId", user.userId);
  }
  localStorage.setItem("userData", JSON.stringify(user));
};

/**
 * Get Stored User Data
 * 
 * Retrieves user information from localStorage.
 * 
 * RETURNS:
 * {
 *   userId: string,
 *   email: string,
 *   firstName: string,
 *   lastName: string,
 *   isVerified: boolean,
 *   onboardingCompleted: boolean,
 *   onboardingStep: number
 * } | null
 * 
 * USAGE:
 * const user = getStoredUserData();
 * if (user) {
 *   console.log(`Welcome ${user.firstName}!`);
 * }
 */
export const getStoredUserData = () => {
  const userData = localStorage.getItem("userData");
  return userData ? JSON.parse(userData) : null;
};

export default {
  // Public
  healthCheck,
  signup,
  verifyOTP,
  resendOTP,
  login,
  refreshToken,
  forgotPassword,
  verifyResetOTP,
  resendResetOTP,
  resetPassword,
  confirmForgotPassword,
  // OAuth
  getOAuthURL,
  oauthCallback,
  // Protected
  getUserProfile,
  logout,
  changePassword,
  // Admin
  getAdminStats,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserStatus,
  // Helpers
  storeTokens,
  getStoredTokens,
  clearTokens,
  storeUserData,
  getStoredUserData,
};
