import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../axios";
import { PulseLoader } from "react-spinners";
import { toast } from "react-toastify";
import Step1 from "../components/Step1";
import Step2 from "../components/Step2"; 
import Step3 from "../components/Step3";
import Step4 from "../components/Step4";
import Step5 from "../components/Step5";

const Onboarding = () => {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔄 Fetching onboarding step...');
    setLoading(true);
    
    // Show loading toast
    const loadingToast = toast.loading("Loading your onboarding progress...");
    
    axiosInstance
      .get("/onboard/step")
      .then((response) => {
        console.log('✅ Onboarding step response:', response.data);
        const step = response.data.step;
        const isCompleted = response.data.isCompleted;
        
        toast.dismiss(loadingToast);
        
        if (step === 6 || isCompleted) {
          console.log('🎉 Onboarding complete, redirecting to dashboard');
          toast.success("🎉 Welcome back! Redirecting to dashboard...", { autoClose: 2000 });
          setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
        } else {
          console.log('📍 Setting current step to:', step);
          setCurrentStep(step);
          
          // Welcome message based on step
          const stepMessages = {
            1: "👋 Welcome! Let's get started with your business details",
            2: "📊 Great! Now let's set up your financial goals",
            3: "🛍️ Time to connect your Shopify store",
            4: "📈 Almost there! Let's configure your analytics",
            5: "🚚 Final step! Connect your shipping platform"
          };
          
          if (step > 1) {
            toast.info(stepMessages[step] || `Continuing from Step ${step}`, { autoClose: 3000 });
          }
        }
      })
      .catch((error) => {
        console.error("❌ Error fetching onboarding step:", error);
        toast.dismiss(loadingToast);
        
        // Handle specific errors
        if (error.response?.status === 401) {
          console.error('🔒 Unauthorized - redirecting to login');
          toast.error("Session expired. Please login again", { autoClose: 3000 });
          localStorage.clear();
          setTimeout(() => navigate("/login", { replace: true }), 1500);
        } else if (error.response?.status === 404) {
          console.log('📝 User not found in onboarding, starting from step 1');
          toast.info("👋 Welcome! Let's set up your account", { autoClose: 3000 });
          setCurrentStep(1);
        } else {
          console.error('⚠️ Unknown error, starting from step 1');
          toast.warning("Starting fresh onboarding process", { autoClose: 3000 });
          setCurrentStep(1);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const handleStepComplete = async () => {
    console.log(`✅ Step ${currentStep} completed`);
    
    // Start transition animation
    setTransitioning(true);
    
    // Wait for fade out
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Fetch updated step from backend
    try {
      const response = await axiosInstance.get("/onboard/step");
      const nextStep = response.data.step;
      const isCompleted = response.data.isCompleted;
      
      console.log(`📍 Backend says next step is: ${nextStep}, completed: ${isCompleted}`);
      
      if (nextStep === 6 || isCompleted) {
        // Onboarding complete, go to dashboard
        console.log('🎉 Onboarding complete, redirecting to dashboard');
        toast.success("🎉 Onboarding complete! Welcome to your dashboard", { autoClose: 2000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        navigate("/dashboard");
      } else {
        // Move to next step
        setCurrentStep(nextStep);
        // Wait for fade in
        await new Promise(resolve => setTimeout(resolve, 100));
        setTransitioning(false);
      }
    } catch (error) {
      console.error('❌ Error fetching next step:', error);
      // Fallback: increment locally
      const next = currentStep + 1;
      if (next === 6) {
        toast.success("🎉 Onboarding complete! Welcome to your dashboard", { autoClose: 2000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        navigate("/dashboard");
      } else {
        setCurrentStep(next);
        await new Promise(resolve => setTimeout(resolve, 100));
        setTransitioning(false);
      }
    }
  };

  if (loading) { 
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={60} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .step-transition {
          animation: fadeIn 0.5s ease-in;
        }
        
        .step-transition-out {
          animation: fadeOut 0.3s ease-out;
          opacity: 0;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-20px);
          }
        }
      `}</style>
      
      <div className={transitioning ? 'step-transition-out' : 'step-transition'}>
        {currentStep === 1 && <Step1 onComplete={handleStepComplete} />}
        {currentStep === 2 && <Step2 onComplete={handleStepComplete} />}
        {currentStep === 3 && <Step3 onComplete={handleStepComplete} />}
        {currentStep === 4 && <Step4 onComplete={handleStepComplete} />}
        {currentStep === 5 && <Step5 onComplete={handleStepComplete} />}
      </div>
    </div>
  );
};

export default Onboarding;
