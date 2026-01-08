import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../../axios";
import { PulseLoader } from "react-spinners";
import { toast } from "react-toastify";
import Step1 from "../components/Step1";
import Step2 from "../components/Step2"; 
import Step3 from "../components/Step3";
import Step4 from "../components/Step4";
import Step5 from "../components/Step5";

const Onboarding = () => {
  const [loading, setLoading] = useState(true);  // Start with loading = true to prevent flash
  const [currentStep, setCurrentStep] = useState(null);  // Start with null until we know the actual step
  const [transitioning, setTransitioning] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Remove Facebook's #_=_ hash fragment
    if (window.location.hash === '#_=_') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Check if coming back from Meta OAuth
    const metaStatus = searchParams.get('meta');
    if (metaStatus === 'connected' || metaStatus === 'error') {
      // Force step 4 for Meta callback
      console.log('📥 Meta OAuth callback detected, forcing Step 4');
      setCurrentStep(4);
      setLoading(false);
      return;
    }

    console.log('🔄 Fetching onboarding step...');
    // loading is already true by default
    
    axiosInstance
      .get("/onboard/step")
      .then((response) => {
        console.log('✅ Onboarding step response:', response.data);
        const step = response.data.step;
        const isCompleted = response.data.isCompleted;
        
        if (step === 6 || isCompleted) {
          console.log('🎉 Onboarding complete, redirecting to dashboard');
          navigate("/dashboard", { replace: true });
        } else {
          console.log('📍 Setting current step to:', step);
          setCurrentStep(step);
        }
      })
      .catch((error) => {
        console.error("❌ Error fetching onboarding step:", error);
        
        // Handle specific errors
        if (error.response?.status === 401) {
          console.error('🔒 Unauthorized - redirecting to login');
          toast.error("Session expired. Please login again", { autoClose: 3000 });
          localStorage.clear();
          setTimeout(() => navigate("/login", { replace: true }), 1500);
        } else if (error.response?.status === 404) {
          console.log('📝 User not found in onboarding, starting from step 1');
          setCurrentStep(1);
        } else {
          console.error('⚠️ Unknown error, starting from step 1');
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

  if (loading || currentStep === null) { 
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
