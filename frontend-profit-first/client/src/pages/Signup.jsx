import { useState } from "react";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { PulseLoader } from "react-spinners";
import { FiArrowLeft, FiEye, FiEyeOff } from "react-icons/fi";
import { signup, verifyOTP, resendOTP } from "../services/authService";
import axiosInstance from "../../axios";

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.804 8.841C34.522 4.938 29.521 2.5 24 2.5C11.454 2.5 2.5 11.454 2.5 24s8.954 21.5 21.5 21.5S45.5 36.546 45.5 24c0-1.573-.154-3.097-.439-4.561z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691L12.05 19.12C14.473 14.018 18.907 10.5 24 10.5c3.059 0 5.842 1.154 7.961 3.039L38.804 8.841C34.522 4.938 29.521 2.5 24 2.5C16.318 2.5 9.642 6.713 6.306 12.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 45.5c5.521 0 10.522-2.438 14.804-6.359L32.039 32.84c-2.119 2.885-5.41 4.66-9.039 4.66c-5.093 0-9.527-3.518-11.95-8.62L6.306 33.309C9.642 39.287 16.318 43.5 24 43.5z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l7.764 6.203C42.818 36.142 45.5 30.492 45.5 24c0-1.573-.154-3.097-.439-4.561z"
    />
  </svg>
);

const SignUp = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    rePassword: "",
    terms: false,
  });
  const [step, setStep] = useState(1); // Track step (1, 2, or 3)
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // Cooldown timer in seconds
  const [otpData, setOtpData] = useState({
    code: '',
    isVerified: false,
    error: '',
    timeLeft: 3600, // 1 hour in seconds
    canResend: false,
    isExpired: false,
    attempts: 0,
    maxAttempts: 3
  });

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === "checkbox" ? checked : value,
    }));
  };

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);
      // Get OAuth URL from backend
      const response = await axiosInstance.get("/auth/oauth/url", {
        params: { provider: "google" },
      });
      
      console.log('OAuth URL response:', response.data);
      
      if (!response.data.url) {
        throw new Error('No OAuth URL received from backend');
      }
      
      // Redirect to Google OAuth
      window.location.href = response.data.url;
    } catch (error) {
      console.error("OAuth URL error:", error);
      const errorMsg = error.response?.data?.error || error.message || "Failed to initiate Google signup";
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  // Validation functions
  const validateName = (name, fieldName) => {
    if (!name || name.trim().length === 0) {
      return `${fieldName} is required`;
    }
    if (name.trim().length < 2) {
      return `${fieldName} must be at least 2 characters`;
    }
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      return `${fieldName} must contain only letters`;
    }
    return null;
  };

  const validateEmail = (email) => {
    if (!email || email.trim().length === 0) {
      return "Email is required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return null;
  };

  const validatePassword = (password) => {
    if (!password || password.length === 0) {
      return "Password is required";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleSubmitStepOne = () => {
    // Validate first name
    const firstNameError = validateName(formData.firstName, "First name");
    if (firstNameError) {
      toast.error(firstNameError);
      return;
    }

    // Validate last name
    const lastNameError = validateName(formData.lastName, "Last name");
    if (lastNameError) {
      toast.error(lastNameError);
      return;
    }

    setStep(2);
  };

  const handleSubmitStepTwo = async (e) => {
    e.preventDefault();

    // Validate email
    const emailError = validateEmail(formData.email);
    if (emailError) {
      toast.error(emailError);
      return;
    }

    // Validate password
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    // Validate password confirmation
    if (!formData.rePassword || formData.rePassword.length === 0) {
      toast.error("Please confirm your password");
      return;
    }

    if (formData.password !== formData.rePassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Validate terms acceptance
    if (!formData.terms) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);
    
    console.log("=== SIGNUP ATTEMPT ===");
    console.log("Form data:", {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      password: "***hidden***"
    });
    
    try {
      const response = await signup({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      console.log("=== SIGNUP SUCCESS ===");
      console.log("Full response:", response);
      console.log("Response type:", typeof response);
      console.log("Response keys:", Object.keys(response || {}));
      
      toast.success(response.message || "Verification code sent to your email!");
      
      console.log("Moving to step 3 (OTP page)");
      setStep(3);
      startOTPTimer();
      console.log("OTP timer started");
      
    } catch (error) {
      console.error("=== SIGNUP ERROR ===");
      console.error("Error object:", error);
      console.error("Error type:", typeof error);
      console.error("Error keys:", Object.keys(error || {}));
      console.error("Error response:", error.response);
      console.error("Error status:", error.response?.status);
      console.error("Error data:", error.response?.data);
      
      // Extract error message from various possible formats
      let errorMessage = "Signup failed. Please try again.";
      
      if (error.response) {
        // Backend returned an error response
        const data = error.response.data;
        console.error("Backend error data:", data);
        console.error("Data type:", typeof data);
        console.error("Data keys:", Object.keys(data || {}));
        
        errorMessage = data.error || data.message || data.msg || JSON.stringify(data) || errorMessage;
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received from server");
        errorMessage = "No response from server. Please check your connection.";
      } else {
        // Something else happened
        console.error("Error message:", error.message);
        errorMessage = error.message || errorMessage;
      }
      
      console.error("Final error message to show:", errorMessage);
      
      // Use setTimeout to ensure toast appears after render
      setTimeout(() => {
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        console.log("Toast.error called with:", errorMessage);
      }, 100);
    } finally {
      setLoading(false);
      console.log("=== SIGNUP COMPLETE ===");
    }
  };

  const startOTPTimer = () => {
    const timer = setInterval(() => {
      setOtpData(prev => {
        if (prev.timeLeft <= 1) {
          clearInterval(timer);
          return {
            ...prev,
            timeLeft: 0,
            isExpired: true,
            canResend: true
          };
        }
        return {
          ...prev,
          timeLeft: prev.timeLeft - 1
        };
      });
    }, 1000);
  };

  const handleOTPChange = (e) => {
    const value = e.target.value;
    setOtpData(prev => ({
      ...prev,
      code: value,
      error: ''
    }));
  };

  const handleConfirmAccount = async () => {
    // Validate OTP code
    if (!otpData.code || otpData.code.trim().length === 0) {
      const errorMsg = 'Please enter the verification code';
      setOtpData(prev => ({ ...prev, error: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    // Check if OTP is 6 digits
    if (!/^\d{6}$/.test(otpData.code.trim())) {
      const errorMsg = 'Verification code must be 6 digits';
      setOtpData(prev => ({ ...prev, error: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    if (otpData.attempts >= otpData.maxAttempts) {
      const errorMsg = 'Maximum attempts reached. Please request a new code';
      setOtpData(prev => ({
        ...prev,
        error: errorMsg,
        isExpired: true
      }));
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOTP(formData.email.trim().toLowerCase(), otpData.code.trim());

      console.log("OTP verification success:", response);
      setOtpData(prev => ({ ...prev, isVerified: true }));
      
      // Show success toast
      setTimeout(() => {
        toast.success(response.message || "Email verified successfully!", {
          position: "top-right",
          autoClose: 5000,
        });
      }, 100);

      setTimeout(() => {
        navigate("/login", {
          state: {
            verified: true,
            email: formData.email,
            message: "Your account has been verified. Please login to continue."
          }
        });
      }, 1500);
    } catch (error) {
      console.error("OTP verification error:", error);
      console.error("Error response:", error.response);
      
      // Extract error message
      let errorMessage = 'Invalid verification code. Please try again.';
      if (error.response?.data) {
        const data = error.response.data;
        errorMessage = data.error || data.message || data.msg || errorMessage;
      } else if (error.request) {
        errorMessage = "No response from server. Please check your connection.";
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setOtpData(prev => ({
        ...prev,
        error: errorMessage,
        attempts: prev.attempts + 1,
        code: ''
      }));
      
      // Show error toast
      setTimeout(() => {
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
        });
      }, 100);
      
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    // Prevent spam clicking
    if (resendCooldown > 0) {
      toast.warning(`Please wait ${resendCooldown} seconds before resending.`, {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await resendOTP(formData.email.trim().toLowerCase());

      console.log("Resend OTP success:", response);
      
      // Set 60-second cooldown
      setResendCooldown(60);
      
      // Start cooldown timer
      const cooldownInterval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(cooldownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setOtpData({
        code: '',
        isVerified: false,
        error: '',
        timeLeft: 3600,
        canResend: false,
        isExpired: false,
        attempts: 0,
        maxAttempts: 3
      });
      startOTPTimer();
      
      // Show success toast after state updates
      setTimeout(() => {
        toast.success(response.message || "OTP resent successfully. Please check your email.", {
          position: "top-right",
          autoClose: 5000,
        });
      }, 100);
      
    } catch (error) {
      console.error("Resend OTP error:", error);
      console.error("Error response:", error.response);
      
      // Extract error message
      let errorMessage = "Failed to resend code. Please try again.";
      if (error.response?.data) {
        const data = error.response.data;
        errorMessage = data.error || data.message || data.msg || errorMessage;
      }
      
      // Show error toast after state updates
      setTimeout(() => {
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
        });
      }, 100);
      
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101218] text-white relative overflow-hidden">
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
        
        /* Toast styling */
        .Toastify__toast-container {
          z-index: 9999 !important;
        }
        .Toastify__toast--error {
          background-color: #ef4444 !important;
          color: white !important;
          font-weight: 500;
        }
        .Toastify__toast--success {
          background-color: #10b981 !important;
          color: white !important;
          font-weight: 500;
        }
        
        /* Smooth step transitions */
        .step-content {
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
      `}</style>
      <div className="bg-blob blob-left"></div>
      <div className="bg-blob blob-right"></div>
      <ToastContainer 
        position="top-right" 
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        style={{ zIndex: 9999 }}
      />

      <div className="relative z-10 w-full max-w-sm mx-4 auth-card-enter">
        <div className="bg-[#1E1E1E] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="p-1 rounded-full hover:bg-white/5 transition"
            >
              <FiArrowLeft size={20} />
            </button>
            <h2 className="text-2xl font-semibold text-white">Sign Up</h2>
          </div>

          {step === 1 ? (
            <div className="step-content">
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="mb-4">
                  <label htmlFor="firstName" className="text-xs text-gray-300 block mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-white text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="John"
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="lastName" className="text-xs text-gray-300 block mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-white text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="Doe"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmitStepOne}
                  className="w-full bg-white text-black py-2 rounded-full font-semibold hover:opacity-95 hover:scale-[1.02] button-transition"
                >
                  Next
                </button>
                <div className="flex items-center my-6">
                  <hr className="flex-grow border-t border-gray-600" />
                  <span className="px-4 text-white text-sm">or</span>
                  <hr className="flex-grow border-t border-gray-600" />
                </div>


                <div className="flex flex-col sm:flex-row mb-4 mt-4">
                  <button
                    type="button"
                    onClick={() => handleGoogleSignup()}
                    className="flex-1 py-2.5 flex items-center justify-center text-white rounded-md transition-colors border border-[#12EB8E] hover:bg-[#12EB8E] hover:text-black font-semibold"
                  >
                    <GoogleIcon />
                    Sign up with Google
                  </button>
                </div>
              </form>
            </div>
          ) : step === 2 ? (
            <div className="step-content">
              <form onSubmit={handleSubmitStepTwo}>
                <div className="mb-4">
                  <label htmlFor="email" className="text-xs text-gray-300 block mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-white text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="password" className="text-xs text-gray-300 block mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-2 pr-10 rounded-lg border border-white text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="rePassword" className="text-xs text-gray-300 block mb-2">
                    Re-enter Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRePassword ? "text" : "password"}
                      id="rePassword"
                      value={formData.rePassword}
                      onChange={handleChange}
                      className="w-full px-4 py-2 pr-10 rounded-lg border border-white text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRePassword(!showRePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                      aria-label={showRePassword ? "Hide password" : "Show password"}
                    >
                      {showRePassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="mb-6 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.terms}
                    onChange={handleChange}
                    className="h-5 w-5 text-green-400 accent-green-400 focus:ring-green-400 mt-1"
                  />
                  <label htmlFor="terms" className="text-xs text-gray-300 block mb-2">
                    I’ve read and agree with Terms of Service and Privacy Policy
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black py-2 rounded-full font-semibold hover:opacity-95 hover:scale-[1.02] button-transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : "Sign Up"}
                </button>


              </form>
            </div>
          ) : (
            <div className="step-content">
              <div className="py-4">
                <h2 className="text-2xl font-semibold text-white mb-6">Confirm your Account</h2>

                <div className="flex items-start gap-3 mb-6">
                  <div className="mt-1">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      {otpData.isVerified && (
                        <circle cx="18" cy="18" r="5" fill="#12EB8E" stroke="none" />
                      )}
                      {otpData.isVerified && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="white" d="M16 18l1.5 1.5L20 17" />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      We have sent a code in an email message to{" "}
                      <span className="text-white">
                        {formData.email.substring(0, 3)}***@{formData.email.split('@')[1]}
                      </span>
                      . To confirm your account enter your code.
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="otpCode" className="text-sm text-white block mb-2">
                    Code
                  </label>
                  <input
                    type="text"
                    id="otpCode"
                    value={otpData.code}
                    onChange={handleOTPChange}
                    disabled={otpData.isVerified || otpData.attempts >= otpData.maxAttempts}
                    className={`w-full px-4 py-2.5 rounded-lg border text-white bg-[#2A2A2A] focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${otpData.error
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-600 focus:ring-green-400 focus:border-transparent'
                      }`}
                    placeholder="Enter Code"
                  />
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading || otpData.isVerified}
                    className="text-[#12EB8E] text-sm mt-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    {resendCooldown > 0 
                      ? `Resend Code (${resendCooldown}s)` 
                      : "Resend Code"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmAccount}
                  disabled={otpData.isVerified || otpData.attempts >= otpData.maxAttempts || loading}
                  className="w-full text-black py-2.5 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'rgba(37, 193, 127, 1)' }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgba(37, 193, 127, 0.9)')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgba(37, 193, 127, 1)')}
                >
                  {loading ? "Verifying..." : "Confirm Account"}
                </button>

                {otpData.error && (
                  <div className="mt-4 p-3 rounded-lg border border-red-500/50 bg-red-500/10 flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 text-sm">{otpData.error}</p>
                  </div>
                )}

                {otpData.isVerified && (
                  <div className="mt-4 p-3 rounded-lg border border-green-500/50 bg-green-500/10 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-400 text-sm font-medium">Account verified successfully!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step !== 3 && (
            <p className="text-center text-sm text-gray-400 mt-4">
              Already have an account?{" "}
              <Link to="/login" className="text-green-400 hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignUp;
