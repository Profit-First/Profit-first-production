/**
 * Validators Utility
 * 
 * Provides validation functions for user input
 * Ensures data integrity and security
 */

/**
 * Validate Email Format
 * @param {string} email - Email address to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
const validateEmail = (email) => {
  if (!email) {
    return { valid: false, message: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }

  return { valid: true, message: 'Valid email' };
};

/**
 * Validate Name Format
 * @param {string} name - Name to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
const validateName = (name) => {
  if (!name) {
    return { valid: false, message: 'Name is required' };
  }

  if (name.length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters long' };
  }

  if (name.length > 50) {
    return { valid: false, message: 'Name must not exceed 50 characters' };
  }

  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(name)) {
    return { valid: false, message: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
  }

  return { valid: true, message: 'Valid name' };
};

/**
 * Validate Password Strength
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
const validatePassword = (password) => {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters' };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }

  return { valid: true, message: 'Valid password' };
};

/**
 * Sanitize Input to Prevent XSS
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
};

module.exports = {
  validateEmail,
  validateName,
  validatePassword,
  sanitizeInput
};
