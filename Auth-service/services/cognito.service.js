/**
 * AWS Cognito Service
 * 
 * Handles all AWS Cognito operations for user authentication
 * Includes signup, login, password management, token operations, and OAuth
 */

const {
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminUpdateUserAttributesCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { cognito, clientId, cognitoDomain, redirectUri, userPoolId } = require('../config/aws.config');
const axios = require('axios');

class CognitoService {
  /**
   * Sign Up User
   * Creates new user in Cognito and sends OTP to email
   * 
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @param {string} firstName - User's first name
   * @param {string} lastName - User's last name
   * @returns {Object} Success status and data/error
   */
  async signUp(email, password, firstName, lastName) {
    try {
      const fullName = `${firstName} ${lastName}`;
      
      // Build user attributes
      const userAttributes = [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
        { Name: 'name', Value: fullName }
      ];

      const command = new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes
      });

      const result = await cognito.send(command);
      return { 
        success: true, 
        data: {
          userSub: result.UserSub,
          userConfirmed: result.UserConfirmed
        }
      };
    } catch (error) {
      console.error('Cognito signup error:', error.message);
      
      // Provide helpful error message for name.formatted issue
      if (error.message && error.message.includes('name.formatted')) {
        return { 
          success: false, 
          error: 'Cognito User Pool configuration error: name.formatted is required but cannot be set via API. Please go to AWS Cognito Console → Your User Pool → Sign-up experience → Attributes and make name.formatted optional or remove it. See SOLUTION.md for detailed instructions.' 
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify Email
   * Confirms user's email using OTP code
   * 
   * @param {string} email - User's email address
   * @param {string} otp - 6-digit verification code
   * @returns {Object} Success status and message/error
   */
  async verifyEmail(email, otp) {
    try {
      const cleanOtp = otp.toString().trim();
      console.log(`\n🔐 Verifying email for: ${email}`);
      console.log(`   OTP received: ${cleanOtp.substring(0, 2)}****`);
      console.log(`   OTP length: ${cleanOtp.length}`);
      console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
      
      const command = new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: cleanOtp
      });

      const result = await cognito.send(command);
      console.log(`✅ Email verification successful for: ${email}`);
      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      console.error(`\n❌ Email verification FAILED for ${email}`);
      console.error(`   Error Name: ${error.name}`);
      console.error(`   Error Message: ${error.message}`);
      console.error(`   HTTP Status: ${error.$metadata?.httpStatusCode}`);
      
      // Provide specific error messages
      if (error.name === 'CodeMismatchException') {
        console.error(`   Reason: OTP code does not match what Cognito expects`);
        return { success: false, error: 'Invalid verification code. The code you entered does not match. Please check your email and try again.' };
      } else if (error.name === 'ExpiredCodeException') {
        console.error(`   Reason: OTP code has expired`);
        return { success: false, error: 'Verification code has expired. Please click "Resend Code" to get a new one.' };
      } else if (error.name === 'NotAuthorizedException') {
        if (error.message.includes('Current status is CONFIRMED') || error.message.includes('cannot be confirmed')) {
          console.log(`   ✅ User is already verified in Cognito!`);
          return { success: true, message: 'Email already verified. You can login now.', alreadyVerified: true };
        }
        console.error(`   Reason: User already verified or invalid state`);
        return { success: false, error: 'User is already verified. Please try logging in.' };
      } else if (error.name === 'UserNotFoundException') {
        console.error(`   Reason: User does not exist in Cognito`);
        return { success: false, error: 'User not found. Please sign up first.' };
      } else if (error.name === 'TooManyFailedAttemptsException') {
        console.error(`   Reason: Too many failed verification attempts`);
        return { success: false, error: 'Too many failed attempts. Please wait 15 minutes and try again.' };
      } else if (error.name === 'AliasExistsException') {
        console.error(`   Reason: Email already in use by another account`);
        return { success: false, error: 'This email is already verified with another account.' };
      }
      
      console.error(`   Reason: Unknown error - ${error.name}`);
      return { success: false, error: `Verification failed: ${error.message}` };
    }
  }

  /**
   * Resend OTP
   * Sends a new verification code to user's email
   * 
   * @param {string} email - User's email address
   * @returns {Object} Success status and message/error
   */
  async resendOTP(email) {
    try {
      console.log(`Resending OTP to: ${email}`);
      
      const command = new ResendConfirmationCodeCommand({
        ClientId: clientId,
        Username: email
      });

      const result = await cognito.send(command);
      console.log(`✓ OTP resent successfully to: ${email}`);
      console.log(`  Delivery method: ${result.CodeDeliveryDetails?.DeliveryMedium}`);
      console.log(`  Destination: ${result.CodeDeliveryDetails?.Destination}`);
      
      return { 
        success: true, 
        message: 'OTP resent successfully',
        deliveryDetails: result.CodeDeliveryDetails
      };
    } catch (error) {
      console.error(`✗ Failed to resend OTP to ${email}:`, {
        name: error.name,
        message: error.message
      });
      
      // Provide specific error messages
      if (error.name === 'UserNotFoundException') {
        return { success: false, error: 'User not found. Please sign up first.' };
      } else if (error.name === 'InvalidParameterException') {
        return { success: false, error: 'User is already verified.' };
      } else if (error.name === 'LimitExceededException') {
        return { success: false, error: 'Too many requests. Please wait a few minutes and try again.' };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign In User
   * Authenticates user and returns JWT tokens
   * 
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Object} Success status and authentication tokens/error
   */
  async signIn(email, password) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const result = await cognito.send(command);
      return { success: true, data: result.AuthenticationResult };
    } catch (error) {
      console.error('Cognito sign in error:', error.name, error.message);
      
      // Provide helpful error messages
      if (error.name === 'InvalidParameterException' && error.message.includes('USER_PASSWORD_AUTH')) {
        return { 
          success: false, 
          error: 'Cognito configuration error: USER_PASSWORD_AUTH flow not enabled. Go to AWS Cognito Console → User Pool → App clients → Edit → Enable USER_PASSWORD_AUTH in Authentication flows.' 
        };
      } else if (error.name === 'UserNotConfirmedException') {
        return { success: false, error: 'Email not verified. Please verify your email with OTP.' };
      } else if (error.name === 'NotAuthorizedException') {
        return { success: false, error: 'Invalid email or password' };
      } else if (error.name === 'UserNotFoundException') {
        return { success: false, error: 'User not found. Please sign up first.' };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Get User Details
   * Retrieves user information from Cognito using access token
   * 
   * @param {string} accessToken - JWT access token
   * @returns {Object} Success status and user data/error
   */
  async getUserDetails(accessToken) {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const result = await cognito.send(command);
      return { 
        success: true, 
        data: {
          Username: result.Username,
          UserAttributes: result.UserAttributes,
          UserMFASettingList: result.UserMFASettingList
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh Access Token
   * Gets new access and ID tokens using refresh token
   * 
   * @param {string} refreshToken - JWT refresh token
   * @returns {Object} Success status and new tokens/error
   */
  async refreshToken(refreshToken) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      });

      const result = await cognito.send(command);
      return { success: true, data: result.AuthenticationResult };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign Out User
   * Globally signs out user and invalidates all tokens including refresh tokens
   * 
   * @param {string} accessToken - JWT access token
   * @returns {Object} Success status and message/error
   */
  async signOut(accessToken) {
    try {
      // Global sign out invalidates all tokens including refresh tokens
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken
      });

      await cognito.send(command);
      console.log('User signed out globally - all tokens invalidated');
      return { success: true, message: 'User signed out successfully' };
    } catch (error) {
      console.error('Sign out error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Change Password
   * Updates user's password (requires old password)
   * 
   * @param {string} accessToken - JWT access token
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Object} Success status and message/error
   */
  async changePassword(accessToken, oldPassword, newPassword) {
    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: oldPassword,
        ProposedPassword: newPassword
      });

      await cognito.send(command);
      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Forgot Password
   * Initiates password reset and sends code to email
   * 
   * @param {string} email - User's email address
   * @returns {Object} Success status and message/error
   */
  async forgotPassword(email) {
    try {
      console.log(`Attempting to send forgot password code to: ${email}`);
      
      const command = new ForgotPasswordCommand({
        ClientId: clientId,
        Username: email
      });

      const result = await cognito.send(command);
      console.log(`✓ Forgot password code sent successfully to: ${email}`);
      console.log(`  Delivery method: ${result.CodeDeliveryDetails?.DeliveryMedium || 'EMAIL'}`);
      
      return { success: true, message: 'Password reset code sent to email' };
    } catch (error) {
      console.error(`✗ Forgot password failed for ${email}:`, {
        name: error.name,
        message: error.message,
        code: error.$metadata?.httpStatusCode
      });
      
      return { 
        success: false, 
        error: error.message,
        errorName: error.name 
      };
    }
  }

  /**
   * Mark Email as Verified
   * Administratively marks user's email as verified in Cognito
   * 
   * @param {string} email - User's email address
   * @returns {Object} Success status and message/error
   */
  async markEmailAsVerified(email) {
    try {
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'email_verified',
            Value: 'true'
          }
        ]
      });

      await cognito.send(command);
      console.log(`✓ Email marked as verified in Cognito for: ${email}`);
      return { success: true, message: 'Email marked as verified' };
    } catch (error) {
      console.error(`✗ Failed to mark email as verified for ${email}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Confirm Forgot Password
   * Completes password reset using code from email
   * 
   * @param {string} email - User's email address
   * @param {string} code - Verification code from email
   * @param {string} newPassword - New password
   * @returns {Object} Success status and message/error
   */
  async confirmForgotPassword(email, code, newPassword) {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword
      });

      await cognito.send(command);
      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get OAuth Login URL
   * Generates Cognito Hosted UI URL for social login
   * 
   * @param {string} provider - OAuth provider name (google, facebook, amazon, apple)
   * @returns {string} Cognito Hosted UI URL
   */
  getOAuthUrl(provider) {
    if (!cognitoDomain || cognitoDomain.includes('your-domain')) {
      throw new Error('Cognito domain not configured');
    }

    if (!redirectUri) {
      throw new Error('Redirect URI not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: redirectUri,
      identity_provider: provider.charAt(0).toUpperCase() + provider.slice(1)
    });

    return `${cognitoDomain}/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange Authorization Code for Tokens
   * Exchanges OAuth authorization code for JWT tokens
   * 
   * This is called after user authenticates via Cognito Hosted UI
   * and is redirected back with an authorization code
   * 
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Object} Success status and tokens/error
   */
  async exchangeCodeForTokens(code) {
    try {
      // Cognito token endpoint
      const tokenEndpoint = `${cognitoDomain}/oauth2/token`;

      // Prepare request body (application/x-www-form-urlencoded)
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri
      });

      // Add client secret if it exists (required for confidential clients)
      const clientSecret = process.env.COGNITO_CLIENT_SECRET;
      if (clientSecret) {
        console.log('Using client secret for token exchange');
        params.append('client_secret', clientSecret);
      } else {
        console.log('No client secret configured (public client)');
      }

      console.log('Token exchange request:', {
        endpoint: tokenEndpoint,
        client_id: clientId,
        redirect_uri: redirectUri,
        has_secret: !!clientSecret
      });

      // Make POST request to token endpoint
      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Extract tokens from response
      const { access_token, id_token, refresh_token } = response.data;

      return {
        success: true,
        data: {
          accessToken: access_token,
          idToken: id_token,
          refreshToken: refresh_token
        }
      };
    } catch (error) {
      console.error('Token exchange error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        error: error.response?.data?.error_description || 
               error.response?.data?.error || 
               error.response?.data?.message ||
               error.message
      };
    }
  }

  /**
   * Mark Email as Verified
   * Updates user's email_verified attribute to true
   * Used for OAuth users who authenticate via social providers
   * 
   * @param {string} email - User's email address
   * @returns {Object} Success status and message/error
   */
  async markEmailAsVerified(email) {
    try {
      console.log(`Attempting to mark email as verified for: ${email}`);
      
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'email_verified',
            Value: 'true'
          }
        ]
      });

      await cognito.send(command);
      console.log(`✓ Email marked as verified for user: ${email}`);
      return { success: true, message: 'Email marked as verified' };
    } catch (error) {
      console.error(`✗ Failed to mark email as verified for ${email}:`, {
        name: error.name,
        message: error.message,
        code: error.$metadata?.httpStatusCode
      });
      
      // Check for specific errors
      if (error.name === 'UserNotFoundException') {
        console.error('User not found in Cognito. They may need to sign up first.');
      } else if (error.name === 'NotAuthorizedException') {
        console.error('IAM permissions missing. Need cognito-idp:AdminUpdateUserAttributes permission.');
      }
      
      return { 
        success: false, 
        error: error.message,
        errorName: error.name 
      };
    }
  }
}

module.exports = new CognitoService();
