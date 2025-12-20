import React, { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { verifyOTP, resendOTP } from "../services/authService";
import axiosInstance from "../../axios";

const maskEmail = (email) => {
  if (!email) return "your email";
  const [user, domain] = email.split("@");
  return `${user[0]}*****@${domain}`;
};

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useParams();
  const [status, setStatus] = useState("loading");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  
  const email = location.state?.email;
  const maskedEmail = email ? maskEmail(email) : "your email";

  // Timer for OTP
  useEffect(() => {
    if (status === "waiting" && timeLeft > 0) {
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
  }, [status, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let redirectTimeout;

    const verify = async () => {
      if (token) {
        try {
          await axiosInstance.get(`/auth/verify-email/${token}`);
          setStatus("success");
          redirectTimeout = setTimeout(() => {
            navigate("/login");
          }, 3000);
        } catch (err) {
          setStatus("error");
        }
      } else {
        setStatus("waiting");
      }
    };

    verify();

    return () => clearTimeout(redirectTimeout);
  }, [token, navigate]);

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
        const isComplete = newOtp.every(digit => digit !== '');
        if (isComplete) {
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
    
    if (/^\d{6}$/.test(pastedData)) {
      const otpArray = pastedData.split('');
      setOtp(otpArray);
      document.getElementById('otp-5')?.focus();
      toast.success("OTP pasted successfully!");
      
      setTimeout(() => {
        handleVerifyOTP({ preventDefault: () => {} });
      }, 500);
    } else {
      toast.error("Please paste a valid 6-digit OTP");
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Email not found. Please try signing up again.");
      return;
    }

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    
    setLoading(true);
    try {
      const response = await verifyOTP(email, otpCode);
      setStatus("success");
      toast.success(response.message || "Email verified successfully!");
      
      setTimeout(() => {
        navigate("/login", {
          state: { message: "Email verified! You can now login." }
        });
      }, 2000);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "Invalid or expired OTP";
      toast.error(errorMessage);
      setOtp(["", "", "", "", "", ""]);
      document.getElementById('otp-0')?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      toast.error("Email not found. Please try signing up again.");
      return;
    }

    setLoading(true);
    try {
      const response = await resendOTP(email);
      toast.success(response.message || "OTP resent to your email!");
      setTimeLeft(120);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "Failed to resend OTP";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(to bottom, rgb(0, 40, 38), rgb(0, 85, 58))',
    }}>
      <style>{`
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
        
        .otp-input {
          transition: all 0.2s ease;
        }
        
        .otp-input:focus {
          transform: scale(1.05);
        }
        
        .success-animation {
          animation: successPulse 0.6s ease-out;
        }
        
        @keyframes successPulse {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      
      <div className="bg-[#0f1e1c] rounded-3xl p-10 text-center shadow-lg max-w-md w-full mx-4 auth-card-enter">
        <img src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png" alt="Logo" className="mx-auto h-48 mb-6" />
        
        {status === "waiting" && (
          <>
            <h2 className="text-white text-2xl font-bold mb-4">Verify your email</h2>
            <p className="text-gray-300 mb-6">
              We've sent a 6-digit code to <span className="text-green-400">{maskedEmail}</span>.<br />
              Please enter the code below to verify your email.
            </p>

            <form onSubmit={handleVerifyOTP} className="mb-6">
              <div className="flex justify-center gap-2 mb-4">
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
                    className="w-12 h-12 text-center text-xl bg-[#1a2a28] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500 otp-input"
                  />
                ))}
              </div>

              <div className="flex justify-between items-center text-sm mb-4">
                <span className="text-gray-400">
                  Time remaining: <span className="text-green-500 font-mono">{formatTime(timeLeft)}</span>
                </span>
                {canResend && (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 hover:scale-[1.02] text-black font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : "Verify Email"}
              </button>
            </form>

            <Link to="/login" className="text-green-500 hover:text-green-400 transition-colors">
              Back to Login
            </Link>
          </>
        )}

        {status === "success" && (
          <div className="success-animation">
            <div className="mb-4">
              <svg className="w-20 h-20 mx-auto text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-green-400 text-2xl font-bold mb-2">Email Verified!</h2>
            <p className="text-gray-300">Redirecting you to login...</p>
          </div>
        )}

        {status === "error" && (
          <>
            <h2 className="text-red-500 text-2xl font-bold mb-2">Verification Failed</h2>
            <p className="text-gray-300 mb-4">The verification link is invalid or expired.</p>
            <Link to="/signup" className="text-green-500 hover:text-green-400 transition-colors">
              Back to Sign Up
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
