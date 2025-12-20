import { useState, useEffect, useRef } from "react";
import { FiCheck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import profitLogo from "../assets/Group 3.svg";

const MetaAdsMerge = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [shouldShift, setShouldShift] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [typewriterText, setTypewriterText] = useState("");
  const [deepAnalysisText, setDeepAnalysisText] = useState("");
  const [parsingText, setParsingText] = useState("");
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [showGoals, setShowGoals] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const chatContainerRef = useRef(null);

  const campaignTips = [
    "AI analyzes your product page to create targeted ad campaigns",
    "Set daily budgets and optimize spending automatically",
    "Track CTR, CPC, CPA, and ROAS in real-time",
    "Auto-pause underperforming ads and boost winners",
    "Get AI-powered creative suggestions for better engagement",
    "Target the right audience with smart demographic insights"
  ];

  const goals = [
    { 
      id: "roas", 
      label: "Highest ROAS",
      description: "Maximize return on ad spend",
      icon: "📈"
    },
    { 
      id: "paid", 
      label: "Highest Paid Order",
      description: "Optimize for maximum orders",
      icon: "💰"
    },
    { 
      id: "rto", 
      label: "Lowest RTO",
      description: "Minimize return to origin",
      icon: "📦"
    }
  ];

  const toggleGoal = (goalId) => {
    setSelectedGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleCreateCampaign = () => {
    if (selectedGoals.length > 0) {
      navigate("/dashboard/campaign-setup", { state: { goals: selectedGoals } });
    }
  };

  // Rotate campaign tips every 3.5 seconds
  useEffect(() => {
    if (!isValidated) {
      const interval = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % campaignTips.length);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [isValidated, campaignTips.length]);

  // Auto-scroll to bottom when new content appears
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [analysisStep, parsingText, typewriterText, deepAnalysisText]);

  const handleValidate = () => {
    if (url.trim()) {
      setIsValidated(true);
      setShouldShift(true);
      setIsAnalyzing(true);
      setAnalysisStep(0);
      setTypewriterText("");
      setParsingText("");
      setDeepAnalysisText("");
      
      // Section 1: Parsing URL (0-1.5s)
      setTimeout(() => setAnalysisStep(0), 0);
      const parsingFullText = "Extracting URL structure and identifying page type. Validating domain and checking SSL certificate.";
      const parsingWords = parsingFullText.split(" ");
      let currentParsingText = "";
      
      parsingWords.forEach((word, index) => {
        setTimeout(() => {
          currentParsingText += (index === 0 ? "" : " ") + word;
          setParsingText(currentParsingText);
        }, 100 + (index * 80));
      });
      
      // Move to Section 2 after parsing completes (1.5s)
      setTimeout(() => {
        setAnalysisStep(1);
      }, 1500);
      
      // Section 3: Goal Summary starts after image loads (3s)
      setTimeout(() => {
        setAnalysisStep(2);
        const fullText = "Your goal is to increase sales and reach more customers through targeted advertising campaigns.";
        const words = fullText.split(" ");
        let currentText = "";
        
        words.forEach((word, index) => {
          setTimeout(() => {
            currentText += (index === 0 ? "" : " ") + word;
            setTypewriterText(currentText);
          }, index * 150);
        });
      }, 3000);
      
      // Section 4: Deep Analysis starts after goal summary (4.5s)
      setTimeout(() => {
        setAnalysisStep(3);
        const analysisText = "Analyzing your product catalog and pricing strategy. Identifying target audience and demographics. Evaluating competitor landscape and market positioning. Generating optimal ad copy and creative recommendations.";
        const analysisWords = analysisText.split(" ");
        let currentAnalysisText = "";
        
        analysisWords.forEach((word, index) => {
          setTimeout(() => {
            currentAnalysisText += (index === 0 ? "" : " ") + word;
            setDeepAnalysisText(currentAnalysisText);
          }, index * 120);
        });
      }, 4500);
      
      // Show completion message at the end (7s)
      setTimeout(() => {
        setAnalysisStep(4);
        setIsAnalyzing(false);
      }, 7000);
      
      // Show goals after completion message (8s)
      setTimeout(() => {
        setShowGoals(true);
      }, 8000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a3d2e] to-[#0a1f1a] flex items-center justify-center p-4 relative overflow-hidden">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideInRight {
          0% {
            opacity: 0;
            transform: translateX(50px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes shiftToLeft {
          from {
            transform: translateX(0) scale(1);
          }
          to {
            transform: translateX(-35%) scale(0.65);
          }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.8s ease-out forwards;
        }
        
        .animate-shift-left {
          animation: shiftToLeft 0.8s ease-out forwards;
        }
        
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .analyzing-border {
          position: relative;
        }
        
        .analyzing-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 1rem;
          padding: 2px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.3) 45%,
            rgba(255, 255, 255, 0.9) 50%, 
            rgba(255, 255, 255, 0.3) 55%,
            transparent 100%
          );
          background-size: 200% 100%;
          -webkit-mask: 
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: borderSlide 3s linear infinite;
          pointer-events: none;
        }
        
        @keyframes borderSlide {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 200% 0%;
          }
        }
        
        @keyframes slideInFromRightSide {
          from {
            opacity: 0;
            transform: translateX(100px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        .animate-slide-in-from-right {
          animation: slideInFromRightSide 0.8s ease-out 0.3s forwards;
          opacity: 0;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
      
      <div className={`w-full max-w-4xl 2xl:max-w-5xl relative ${shouldShift ? 'animate-shift-left' : ''}`}>
        {/* Logo and Name - Above Heading, Centered */}
        <div className="flex items-center justify-center gap-4 2xl:gap-5 mb-8 2xl:mb-10">
          <img 
            src={profitLogo} 
            alt="Profit First Logo" 
            className="w-16 h-16 2xl:w-20 2xl:h-20 object-contain"
          />
          <span className="text-white font-bold text-3xl 2xl:text-4xl">Profit First</span>
        </div>

        {/* Main Heading - "Set your AD Campaign in few clicks" */}
        <div className="text-center mb-16 2xl:mb-20">
          <h1 className="text-5xl 2xl:text-6xl font-bold text-white flex flex-nowrap items-center justify-center gap-3 2xl:gap-4 whitespace-nowrap">
            <span>Set your</span>
            <span className="text-[#4DD19D]">AD Campaign</span>
            <span className="inline-flex items-center gap-3 2xl:gap-4">
              in few clicks
              <svg className="w-10 h-10 2xl:w-12 2xl:h-12 text-[#4DD19D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </span>
          </h1>
        </div>
        
        {/* Background Container for URL Section */}
        <div className="bg-[#051410]/80 backdrop-blur-sm rounded-3xl p-10 2xl:p-12">
          <label className="block text-white text-lg 2xl:text-xl font-medium mb-6 2xl:mb-8">
            URL
          </label>
          
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleValidate();
                }
              }}
              placeholder="http://yourstore/service/product"
              className="w-full px-6 py-5 2xl:px-8 2xl:py-6 pr-20 2xl:pr-24 rounded-xl text-lg 2xl:text-xl bg-[#0a2820] border-2 border-gray-700 focus:outline-none focus:border-green-500 text-white placeholder-gray-500"
            />
            <button
              onClick={handleValidate}
              className={`absolute right-4 2xl:right-5 top-1/2 -translate-y-1/2 w-12 h-12 2xl:w-14 2xl:h-14 rounded-lg flex items-center justify-center transition-colors ${
                isValidated 
                  ? "bg-green-500 text-white" 
                  : "bg-gray-700 text-gray-400 hover:bg-green-500 hover:text-white"
              }`}
            >
              <FiCheck className="w-7 h-7 2xl:w-8 2xl:h-8" />
            </button>
          </div>
        </div>

        {/* Rotating Campaign Tips - Outside Container */}
        {!isValidated && (
          <div className="mt-8 2xl:mt-10 min-h-[32px] 2xl:min-h-[40px]">
            <p 
              key={currentTipIndex}
              className="text-base 2xl:text-lg text-gray-300 text-center animate-fade-in-up"
            >
              {campaignTips[currentTipIndex]}
            </p>
          </div>
        )}
      </div>
      
      {/* Chatbot Container / Goals Container - Always visible after shift */}
      {shouldShift && !showGoals && (
        <div className="absolute right-16 2xl:right-20 top-1/2 -translate-y-1/2 animate-slide-in-from-right">
          <div className={`bg-[#051410]/80 backdrop-blur-sm rounded-3xl p-8 2xl:p-10 shadow-2xl w-[500px] 2xl:w-[600px] max-h-[550px] 2xl:max-h-[650px] flex flex-col ${isAnalyzing ? 'analyzing-border' : ''}`}>
            {/* Chatbot Header */}
            <div className="flex items-center gap-4 2xl:gap-5 mb-8 2xl:mb-10 relative z-10">
              <img 
                src={profitLogo} 
                alt="Profit Logo" 
                className="w-16 h-16 2xl:w-20 2xl:h-20 object-contain"
              />
              <div>
                <h3 className="text-2xl 2xl:text-3xl font-bold text-white">AI Assistant</h3>
                <p className="text-sm 2xl:text-base text-gray-400">Analyzing your page...</p>
              </div>
            </div>
            
            {/* Chat Messages Area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-5 2xl:space-y-6 mb-6 2xl:mb-8 scrollbar-hide relative z-10">
              {/* Message 1 - Parsing URL with Typewriter */}
              {analysisStep >= 0 && (
                <div className="space-y-3 2xl:space-y-4 animate-fade-in-up">
                  <p className="text-gray-400 text-sm 2xl:text-base">
                    {analysisStep === 0 ? (
                      <span>Parsing your URL<span className="animate-pulse">...</span></span>
                    ) : (
                      "✓ Parsing your URL"
                    )}
                  </p>
                  {analysisStep === 0 && parsingText && (
                    <div className="bg-[#0a2820] rounded-xl p-4 2xl:p-5">
                      <p className="text-gray-300 text-sm 2xl:text-base leading-relaxed">
                        {parsingText}<span className="animate-pulse">|</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Message 2 - Checking page with Image Preview - WEBSITE MOCKUP IMAGE DISPLAYED HERE */}
              {analysisStep >= 1 && (
                <div className="space-y-3 2xl:space-y-4 animate-fade-in-up">
                  <p className="text-gray-400 text-sm 2xl:text-base">Checking what's on your page...</p>
                  <div className="bg-[#0a2820] rounded-xl p-4 2xl:p-5">
                    {/* Mockup Image of Website - Shows skeleton loading then actual mockup */}
                    <div className="bg-white rounded-xl p-3 2xl:p-4 border-2 border-gray-300">
                      <div className="bg-gray-100 rounded-lg h-40 2xl:h-48 flex items-center justify-center relative overflow-hidden">
                        {analysisStep === 1 ? (
                          /* Skeleton Loading - Animated placeholder while loading */
                          <div className="w-full h-full p-3 2xl:p-4 space-y-3 2xl:space-y-4 animate-pulse">
                            <div className="bg-gray-300 rounded h-4 2xl:h-5 w-3/4"></div>
                            <div className="flex gap-2">
                              <div className="bg-gray-300 rounded h-3 2xl:h-4 w-14 2xl:w-16"></div>
                              <div className="bg-gray-300 rounded h-3 2xl:h-4 w-14 2xl:w-16"></div>
                              <div className="bg-gray-300 rounded h-3 2xl:h-4 w-14 2xl:w-16"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className="bg-gray-300 rounded h-20 2xl:h-24"></div>
                              <div className="bg-gray-300 rounded h-20 2xl:h-24"></div>
                            </div>
                          </div>
                        ) : (
                          /* Actual website mockup after loading - Generated mockup preview */
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 p-3 2xl:p-4">
                            <div className="bg-white rounded mb-2 h-4 2xl:h-5 w-3/4"></div>
                            <div className="flex gap-2 mb-3">
                              <div className="bg-blue-400 rounded h-3 2xl:h-4 w-14 2xl:w-16"></div>
                              <div className="bg-blue-400 rounded h-3 2xl:h-4 w-14 2xl:w-16"></div>
                              <div className="bg-blue-400 rounded h-3 2xl:h-4 w-14 2xl:w-16"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white rounded h-20 2xl:h-24 flex items-center justify-center">
                                <div className="w-10 h-10 2xl:w-12 2xl:h-12 bg-blue-400 rounded"></div>
                              </div>
                              <div className="bg-white rounded h-20 2xl:h-24 flex items-center justify-center">
                                <div className="w-10 h-10 2xl:w-12 2xl:h-12 bg-blue-400 rounded"></div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Success message after skeleton loads */}
                    {analysisStep >= 2 && (
                      <div className="mt-3 2xl:mt-4 flex items-center gap-2 2xl:gap-3 text-green-400 text-sm 2xl:text-base">
                        <FiCheck className="w-5 h-5 2xl:w-6 2xl:h-6" />
                        <span>Found products and content</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Message 3 - Summarizing Goal with Typewriter */}
              {analysisStep >= 2 && (
                <div className="space-y-3 2xl:space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <p className="text-gray-400 text-sm 2xl:text-base">Summarizing your goal!</p>
                  <div className="bg-[#0a2820] rounded-xl p-4 2xl:p-5">
                    <p className="text-gray-300 text-base 2xl:text-lg leading-relaxed">
                      {typewriterText}{typewriterText && <span className="animate-pulse">|</span>}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Message 4 - Deep Analysis with Typewriter */}
              {analysisStep >= 3 && (
                <div className="space-y-3 2xl:space-y-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <p className="text-gray-400 text-sm 2xl:text-base">
                    {analysisStep < 4 ? (
                      <span>Making a Deep analysis<span className="animate-pulse">...</span></span>
                    ) : (
                      "Making a Deep analysis"
                    )}
                  </p>
                  <div className="bg-[#0a2820] rounded-xl p-5 2xl:p-6">
                    <p className="text-gray-300 text-sm 2xl:text-base leading-relaxed">
                      {deepAnalysisText}{deepAnalysisText && <span className="animate-pulse">|</span>}
                    </p>
                  </div>
                  {/* Completion Message - Outside container */}
                  {analysisStep >= 4 && (
                    <p className="text-green-400 text-sm 2xl:text-base font-medium animate-fade-in-up">
                      ✓ Analysis complete! Ready to create your campaign.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Goals Selection Container - Shows after analysis */}
      {showGoals && (
        <div className="absolute right-16 2xl:right-20 top-1/2 -translate-y-1/2 animate-slide-in-from-right">
          <div className="bg-[#051410]/80 backdrop-blur-sm rounded-3xl p-8 2xl:p-10 shadow-2xl w-[500px] 2xl:w-[600px] max-h-[600px] 2xl:max-h-[700px] flex flex-col">
            {/* Header */}
            <div className="mb-6 2xl:mb-8">
              <h3 className="text-2xl 2xl:text-3xl font-bold text-white mb-3 2xl:mb-4">Choose Your Goals</h3>
              <p className="text-base 2xl:text-lg text-gray-400">Select one or more campaign objectives</p>
            </div>

            {/* Goals List - Scrollable */}
            <div className="flex-1 overflow-y-auto space-y-4 2xl:space-y-5 mb-6 2xl:mb-8 scrollbar-hide">
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={`w-full p-5 2xl:p-6 rounded-2xl border-2 transition-all flex items-center gap-4 2xl:gap-5 ${
                    selectedGoals.includes(goal.id)
                      ? "bg-black border-green-500 shadow-lg shadow-green-500/20"
                      : "bg-black/60 border-gray-600 hover:border-green-500/50"
                  }`}
                >
                  <div className="text-3xl 2xl:text-4xl">
                    {goal.icon}
                  </div>
                  
                  <div className="flex-1 text-left">
                    <h4 className="text-base 2xl:text-lg font-bold text-white mb-1 2xl:mb-1.5">{goal.label}</h4>
                    <p className="text-sm 2xl:text-base text-gray-400">{goal.description}</p>
                  </div>

                  <div className={`w-6 h-6 2xl:w-7 2xl:h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedGoals.includes(goal.id) 
                      ? "border-green-500 bg-green-500" 
                      : "border-gray-600"
                  }`}>
                    {selectedGoals.includes(goal.id) && (
                      <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Create Campaign Button */}
            <button
              onClick={handleCreateCampaign}
              disabled={selectedGoals.length === 0}
              className={`w-full px-8 py-4 2xl:px-10 2xl:py-5 rounded-xl text-base 2xl:text-lg font-bold transition-all ${
                selectedGoals.length > 0
                  ? "bg-green-500 hover:bg-green-400 text-black cursor-pointer shadow-lg shadow-green-500/30"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              Create Campaign {selectedGoals.length > 0 && `(${selectedGoals.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaAdsMerge;
