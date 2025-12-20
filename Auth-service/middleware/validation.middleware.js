/**
 * Validation Middleware
 * 
 * Validates request data before processing
 * Ensures data integrity and security
 */

const { validateEmail: checkEmail, validateName: checkName, validatePassword: checkPassword, sanitizeInput } = require('../utils/validators');

/**
 * Validate Signup Request
 * Validates all required fields for user registration
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateSignup = (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  // Sanitize inputs to prevent XSS
  if (firstName) req.body.firstName = sanitizeInput(firstName);
  if (lastName) req.body.lastName = sanitizeInput(lastName);
  if (email) req.body.email = sanitizeInput(email);

  const firstNameValidation = checkName(req.body.firstName);
  if (!firstNameValidation.valid) {
    return res.status(400).json({ error: `First name: ${firstNameValidation.message}` });
  }

  const lastNameValidation = checkName(req.body.lastName);
  if (!lastNameValidation.valid) {
    return res.status(400).json({ error: `Last name: ${lastNameValidation.message}` });
  }

  const emailValidation = checkEmail(req.body.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.message });
  }

  const passwordValidation = checkPassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.message });
  }

  next();
};

/**
 * Validate Login Request
 * Validates email and password for login
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  // Sanitize email input
  if (email) req.body.email = sanitizeInput(email);

  const emailValidation = checkEmail(req.body.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.message });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  next();
};

/**
 * Validate OTP Request
 * Validates email and OTP code format
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateOTP = (req, res, next) => {
  const { email, otp } = req.body;

  // Sanitize email input
  if (email) req.body.email = sanitizeInput(email);

  const emailValidation = checkEmail(req.body.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.message });
  }

  if (!otp || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be a 6-digit code' });
  }

  // Sanitize OTP (remove any non-digit characters)
  req.body.otp = otp.replace(/\D/g, '');

  next();
};

/**
 * Validate Reset OTP Request
 * Validates email and code for password reset verification
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateResetOTP = (req, res, next) => {
  const { email, code } = req.body;

  // Sanitize email input
  if (email) req.body.email = sanitizeInput(email);

  const emailValidation = checkEmail(req.body.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.message });
  }

  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Verification code must be a 6-digit code' });
  }

  // Sanitize code (remove any non-digit characters)
  req.body.code = code.replace(/\D/g, '');

  next();
};

/**
 * Validate Email Request
 * Validates email format
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateEmail = (req, res, next) => {
  const { email } = req.body;

  // Sanitize email input
  if (email) req.body.email = sanitizeInput(email);

  const emailValidation = checkEmail(req.body.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.message });
  }

  next();
};

/**
 * Validate New Password
 * Validates new password format
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateNewPassword = (req, res, next) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  const passwordValidation = checkPassword(newPassword);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.message });
  }

  next();
};

/**
 * Validate Password Reset Request (Legacy)
 * Validates email, code, and new password for password reset
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validatePassword = (req, res, next) => {
  const { newPassword, code, email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Sanitize email input
  req.body.email = sanitizeInput(email);

  const emailValidation = checkEmail(req.body.email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.message });
  }

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  // Validate code format
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Verification code must be a 6-digit code' });
  }

  // Sanitize code
  req.body.code = code.replace(/\D/g, '');

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  const passwordValidation = checkPassword(newPassword);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.message });
  }

  next();
};

module.exports = {
  validateSignup,
  validateLogin,
  validateOTP,
  validateResetOTP,
  validateEmail,
  validateNewPassword,
  validatePassword
};
