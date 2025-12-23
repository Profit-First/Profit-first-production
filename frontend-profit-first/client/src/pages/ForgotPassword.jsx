import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiArrowLeft, FiEye, FiEyeOff } from "react-icons/fi";
import { forgotPassword, verifyResetOTP, resendResetOTP, resetPassword } from "../services/authService";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resetAccessToken, setResetAccessToken] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Password validation states
  const [passwordValidation, setPasswordValidation] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasSpecialChar: false,
    hasNumber: false,
    hasMinLength: false,
  });

  // Password match validation
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [showMatchError, setShowMatchError] = useState(false);

  // Validate password on change
  useEffect(() => {
    if (newPassword) {
      setPasswordValidation({
        hasUpperCase: /[A-Z]/.test(newPassword),
        hasLowerCase: /[a-z]/.test(newPassword),
        hasSpecialChar: /[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
        hasNumber: /\d/.test(newPassword),
        hasMinLength: newPassword.length >= 8,
      });
    } else {
      setPasswordValidation({
        hasUpperCase: false,
        hasLowerCase: false,
        hasSpecialChar: false,
        hasNumber: false,
        hasMinLength: false,
      });
    }
  }, [newPassword]);

  // Check password match
  useEffect(() => {
    if (confirmPassword) {
      const match = newPassword === confirmPassword;
      setPasswordsMatch(match);
      setShowMatchError(!match);
    } else {
      setShowMatchError(false);
    }
  }, [newPassword, confirmPassword]);

  // Timer for OTP
  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  // Security: Prevent access to step 3 without OTP verification and access token
  useEffect(() => {
    // Don't run security check if we're navigating away
    if (isNavigating) return;
    
    if (step === 3 && (!otpVerified || !resetAccessToken)) {
      setStep(2);
      setOtp(["", "", "", "", "", ""]);
      setOtpVerified(false);
      setResetAccessToken(null);
      toast.error("Please verify OTP first before resetting password");
    }
  }, [step, otpVerified, resetAccessToken, isNavigating]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    
    setLoading(true);
    try {
      const response = await forgotPassword(email.trim().toLowerCase());
      
      toast.success(response.message || "Password reset code sent to your email!");
      
      setStep(2);
      setTimeLeft(120); // 2 minutes
      setCanResend(false);
      setOtpVerified(false);
      
      // Try to auto-fill OTP using Web OTP API
      if ('OTPCredential' in window) {
        const ac = new AbortController();
        navigator.credentials.get({
          otp: { transport: ['sms'] },
          signal: ac.signal
        }).then(otp => {
          if (otp && otp.code) {
            const otpArray = otp.code.split('');
            setOtp(otpArray);
            setTimeout(() => {
              toast.success("OTP auto-filled!");
            }, 100);
          }
        }).catch(() => {
          // OTP auto-fill not available
        });
      }
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error || errorData?.message || "Failed to send reset code. Please try again.";
      
      // Check if user needs to verify email first
      if (errorData?.requiresVerification) {
        toast.error(errorMessage, { autoClose: 5000 });
        // Optionally redirect to verify email page after a delay
        setTimeout(() => {
          navigate('/verify-email', { state: { email: email.trim().toLowerCase() } });
        }, 3000);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        document.getElementById(`otp-${index + 1}`)?.focus();
      }

      // Auto-submit when all digits are filled
      if (value && index === 5) {
        const isComplete = newOtp.every(digit => digit !== '' && /^\d$/.test(digit));
        const otpCode = newOtp.join('');
        
        // Only auto-submit if we have exactly 6 digits
        if (isComplete && otpCode.length === 6 && /^\d{6}$/.test(otpCode)) {
          setTimeout(() => {
            handleVerifyOTP({ preventDefault: () => {} });
          }, 500);
        }
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const otpArray = pastedData.split('');
      setOtp(otpArray);
      document.getElementById('otp-5')?.focus();
      toast.success("OTP pasted successfully!");
      
      // Auto-submit after paste
      setTimeout(() => {
        handleVerifyOTP({ preventDefault: () => {} });
      }, 500);
    } else {
      toast.error("Please paste a valid 6-digit OTP");
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    
    // Validate OTP before sending to backend
    if (!otpCode || otpCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Verification code must be a 6-digit code");
      return;
    }
    
    setLoading(true);
    try {
      // Step 2: Verify OTP with backend - MUST succeed to proceed
      const response = await verifyResetOTP(email.trim().toLowerCase(), otpCode);
      
      // Backend must return accessToken AND verified=true for password reset
      if (response && response.accessToken && response.verified === true) {
        // Store the access token (valid for 10 minutes)
        setResetAccessToken(response.accessToken);
        setOtpVerified(true);
        
        toast.success(response.message || "OTP verified! Now create your new password");
        
        setStep(3);
      } else {
        // Backend didn't confirm verification
        throw new Error('OTP verification failed - invalid response from server');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      
      // OTP verification failed - stay on step 2
      let errorMessage = "Invalid or expired OTP. Please try again.";
      
      if (error.response?.data) {
        errorMessage = error.response.data.error || 
                      error.response.data.message || 
                      errorMessage;
      } else if (error.message && error.message.includes('no access token')) {
        errorMessage = "Invalid or expired OTP. Please try again.";
      }
      
      // CRITICAL: Do NOT move to step 3
      setOtpVerified(false);
      setResetAccessToken(null);
      setStep(2);
      
      // Clear OTP fields and stay on step 2
      setOtp(["", "", "", "", "", ""]);
      document.getElementById('otp-0')?.focus();
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill all fields");
      return;
    }

    // Check all password requirements
    if (!passwordValidation.hasUpperCase || !passwordValidation.hasLowerCase || 
        !passwordValidation.hasSpecialChar || !passwordValidation.hasNumber || 
        !passwordValidation.hasMinLength) {
      toast.error("Please meet all password requirements");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Check if we have the access token
    if (!resetAccessToken) {
      toast.error("Session expired. Please verify OTP again.");
      setStep(2);
      setOtpVerified(false);
      setOtp(["", "", "", "", "", ""]);
      return;
    }

    setLoading(true);
    try {
      // Step 3: Reset password with access token
      const response = await resetPassword(resetAccessToken, newPassword);
      
      toast.success(response.message || "Password reset successfully!");
      
      // Set navigating flag to prevent security check from interfering
      setIsNavigating(true);
      
      // Clear the access token and states
      setResetAccessToken(null);
      setOtpVerified(false);
      
      // Navigate to login after short delay
      setTimeout(() => {
        navigate("/login", {
          state: {
            message: "Password reset successfully. Please login with your new password."
          }
        });
      }, 1500);
    } catch (error) {
      console.error('Password reset error:', error);
      
      // Handle specific error cases
      let errorMessage = "Failed to reset password. Please try again.";
      
      if (error.response?.data) {
        const data = error.response.data;
        errorMessage = data.error || data.message || data.msg || errorMessage;
        
        // If token is invalid/expired, go back to step 2
        if (error.response.status === 401 || error.response.status === 403 || 
            errorMessage.toLowerCase().includes('token') || 
            errorMessage.toLowerCase().includes('expired') ||
            errorMessage.toLowerCase().includes('unauthorized')) {
          setStep(2);
          setOtp(["", "", "", "", "", ""]);
          setOtpVerified(false);
          setResetAccessToken(null);
          errorMessage = "Session expired. Please verify OTP again.";
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) {
      toast.warning(`Please wait ${resendCooldown} seconds before resending.`);
      return;
    }

    setLoading(true);
    try {
      const response = await resendResetOTP(email.trim().toLowerCase());
      
      // Set 60-second cooldown
      setResendCooldown(60);
      const cooldownInterval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(cooldownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setTimeLeft(120); // 2 minutes
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      
      toast.success(response.message || "OTP resent to your email!");
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "Failed to resend OTP. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101218] text-white relative overflow-hidden p-4">
      <style>{`
        .bg-blob {
          position: absolute;
          width: 380px;
          height: 380px;
          filter: blur(80px);
          opacity: 0.14;
          z-index: 0;
          border-radius: 50%;
        }
        .blob-left { left: -120px; top: 100%; background: #5fc61fff; transform: translateY(-50%); }
        .blob-right { right: -120px; top: 0%; background: #5fc61fff; transform: translateY(0%); }
        
        /* Smooth step transitions */
        .step-transition {
          animation: fadeInSlide 0.5s ease-out;
        }
        
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .auth-card-enter {
          animation: fadeInUp 0.6s ease-out;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .input-focus-transition {
          transition: all 0.3s ease;
        }
        
        .button-transition {
          transition: all 0.2s ease;
        }
        
        .otp-input {
          transition: all 0.2s ease;
        }
        
        .otp-input:focus {
          transform: scale(1.05);
        }
      `}</style>
      <div className="bg-blob blob-left"></div>
      <div className="bg-blob blob-right"></div>

      <div className="w-full max-w-md relative z-10 auth-card-enter">
        {/* Back Button */}
        <button
          onClick={() => {
            if (step === 1) {
              navigate("/login");
            } else {
              // Going back from step 3 to step 2 requires re-verification
              if (step === 3) {
                setOtpVerified(false);
                setResetAccessToken(null);
              }
              setStep(step - 1);
            }
          }}
          className="mb-6 flex items-center text-gray-300 hover:text-white transition-colors"
        >
          <FiArrowLeft className="mr-2" />
          Back
        </button>

        <div className="bg-[#1E1E1E] rounded-2xl p-8 shadow-lg">
          {/* Step 1: Email Input */}
          {step === 1 && (
            <div className="step-transition">
              <h2 className="text-3xl font-bold text-white mb-2">Forgot Password?</h2>
              <p className="text-gray-400 mb-6">Enter your email to receive OTP</p>

              <form onSubmit={handleSendOTP}>
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : "Send OTP"}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <div className="step-transition">
              <h2 className="text-3xl font-bold text-white mb-2">Verify OTP</h2>
              <p className="text-gray-400 mb-6">Enter the 6-digit code sent to {email}</p>

              <form onSubmit={handleVerifyOTP}>
                <div className="mb-6">
                  <div className="flex justify-between gap-2 mb-4">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="w-12 h-12 text-center text-xl bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500 otp-input"
                      />
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">
                      Time remaining: <span className="text-green-500 font-mono">{formatTime(timeLeft)}</span>
                    </span>
                    {canResend && (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendCooldown > 0 || loading}
                        className="text-green-500 hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend OTP"}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : "Verify OTP"}
                </button>
              </form>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 3 && otpVerified && resetAccessToken && (
            <div className="step-transition">
              <h2 className="text-3xl font-bold text-white mb-2">Create New Password</h2>
              <p className="text-gray-400 mb-6">Enter your new password</p>

              <form onSubmit={handleResetPassword}>
                <div className="mb-4">
                  <label className="block text-gray-300 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500 transition-colors"
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    >
                      {showNewPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                  
                  {/* Password Requirements */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasMinLength ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm ${passwordValidation.hasMinLength ? 'text-green-500' : 'text-red-500'}`}>
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasUpperCase ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm ${passwordValidation.hasUpperCase ? 'text-green-500' : 'text-red-500'}`}>
                        One uppercase letter (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasLowerCase ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm ${passwordValidation.hasLowerCase ? 'text-green-500' : 'text-red-500'}`}>
                        One lowercase letter (a-z)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasSpecialChar ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm ${passwordValidation.hasSpecialChar ? 'text-green-500' : 'text-red-500'}`}>
                        One special character (@, #, $, etc.)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasNumber ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm ${passwordValidation.hasNumber ? 'text-green-500' : 'text-red-500'}`}>
                        One number (0-9)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 bg-[#1a1a1a] border rounded-lg text-white focus:outline-none transition-colors ${
                        showMatchError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-green-500'
                      }`}
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    >
                      {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                  {showMatchError && (
                    <p className="text-red-500 text-sm mt-2">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resetting...
                    </span>
                  ) : "Reset Password"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
