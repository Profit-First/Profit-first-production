import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import profitLogo from "../assets/Group 3.svg";

const CampaignSetup = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("Lab experimented watch for luxury looks.");
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [budget, setBudget] = useState(100);
  const [startDate, setStartDate] = useState("2024-11-07");
  const [endDate, setEndDate] = useState("2024-11-07");
  const [selectedAdSet, setSelectedAdSet] = useState(0);
  const [selectedLocations, setSelectedLocations] = useState(["India"]);
  const [bidStrategy, setBidStrategy] = useState("automatic");
  const [campaignStatus, setCampaignStatus] = useState("active");
  const [manualBidAmount, setManualBidAmount] = useState("2.50");
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const fileInputRef = useRef(null);
  const [adSetsData, setAdSetsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Loading effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const goals = [
    { 
      id: "roas", 
      label: "Highest ROAS",
      description: "Maximize return on ad spend",
      icon: "M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
      color: "emerald"
    },
    { 
      id: "paid", 
      label: "Highest Paid Order",
      description: "Optimize for maximum orders",
      icon: "M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z",
      color: "blue"
    },
    { 
      id: "rto", 
      label: "Lowest RTO",
      description: "Minimize return to origin",
      icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
      color: "purple"
    }
  ];

  // AI Recommendations
  const aiRecommendations = {
    ageGroup: "25-44",
    gender: "Men",
    bestTime: "6 PM - 10 PM",
    interests: ["Fashion", "Luxury"],
    locations: ["India", "UAE"]
  };

  const applyAIRecommendations = () => {
    // Update ad sets with AI recommendations
    const updatedAdSets = adSets.map(adSet => ({
      ...adSet,
      age: aiRecommendations.ageGroup,
      gender: aiRecommendations.gender,
      tags: [...aiRecommendations.interests, "High spending"]
    }));
    
    setAdSetsData(updatedAdSets);
    
    // Update locations
    setSelectedLocations(aiRecommendations.locations);
    
    // Show visual feedback with close button
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-[9999] animate-fade-in';
    successDiv.innerHTML = `
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold">AI Recommendations Applied!</span>
        <button class="ml-2 hover:bg-green-700 rounded p-1 transition-colors" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(successDiv);
    
    // Auto-dismiss after 3 seconds
    const timeoutId = setTimeout(() => {
      if (successDiv && successDiv.parentElement) {
        successDiv.style.opacity = '0';
        successDiv.style.transform = 'translateX(100%)';
        successDiv.style.transition = 'all 0.3s ease-out';
        setTimeout(() => {
          if (successDiv.parentElement) {
            successDiv.remove();
          }
        }, 300);
      }
    }, 3000);
    
    // Store timeout ID so it can be cleared if manually closed
    successDiv.dataset.timeoutId = timeoutId;
  };

  const adSets = [
    {
      id: 1,
      name: "Ad Sets - 01",
      title: "Luxury watches for men",
      image: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=300&fit=crop",
      age: "18",
      gender: "Men",
      adsSpent: "$12.09",
      tags: ["Luxury Goods", "Co-operate", "High spending"],
      adContent: {
        headline: "Premium Titan Watches - Up to 40% Off",
        description: "Discover our exclusive collection of luxury watches. Crafted with precision, designed for elegance. Limited time offer!",
        cta: "Shop Now",
        link: "https://yourstore.com/watches"
      }
    },
    {
      id: 2,
      name: "Ad Sets - 02",
      title: "Premium accessories",
      image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=300&fit=crop",
      age: "25",
      gender: "Men",
      adsSpent: "$15.50",
      tags: ["Premium", "Fashion", "Accessories"],
      adContent: {
        headline: "Elevate Your Style with Premium Accessories",
        description: "Complete your look with our handpicked collection of premium accessories. Quality meets sophistication.",
        cta: "Explore Collection",
        link: "https://yourstore.com/accessories"
      }
    },
    {
      id: 3,
      name: "Ad Sets - 03",
      title: "Elegant timepieces",
      image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&h=300&fit=crop",
      age: "30",
      gender: "All",
      adsSpent: "$18.75",
      tags: ["Elegant", "Timepiece", "Luxury"],
      adContent: {
        headline: "Timeless Elegance - Swiss Movement Watches",
        description: "Experience the perfect blend of tradition and innovation. Each timepiece tells a unique story of craftsmanship.",
        cta: "View Details",
        link: "https://yourstore.com/timepieces"
      }
    }
  ];

  const [showAdContent, setShowAdContent] = useState(false);

  // Handle video upload
  const handleVideoUpload = (event) => {
    const files = Array.from(event.target.files);
    const videoFiles = files.map(file => ({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2), // Convert to MB
      type: file.type,
      url: URL.createObjectURL(file),
      file: file
    }));
    setUploadedVideos([...uploadedVideos, ...videoFiles]);
  };

  // Remove video
  const removeVideo = (index) => {
    const newVideos = uploadedVideos.filter((_, i) => i !== index);
    setUploadedVideos(newVideos);
  };

  // Skeleton Loader Component
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1612] text-white">
        <div className="border-b border-emerald-900/20 bg-[#0d1a16]/80">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6 animate-pulse">
            <div className="w-8 h-8 bg-emerald-900/30 rounded-lg"></div>
            <div className="h-5 w-16 bg-emerald-900/30 rounded"></div>
            <div className="h-5 w-16 bg-emerald-900/30 rounded"></div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column Skeleton */}
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-96 bg-emerald-900/30 rounded mb-8"></div>
              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <div className="h-4 w-32 bg-emerald-900/30 rounded mb-3"></div>
                    <div className="h-12 bg-emerald-900/30 rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="bg-[#0d1a16]/60 rounded-2xl p-6 border border-emerald-900/20 animate-pulse">
              <div className="h-6 w-40 bg-emerald-900/30 rounded mb-6"></div>
              <div className="space-y-6">
                <div className="h-40 bg-emerald-900/30 rounded-lg"></div>
                <div className="h-64 bg-emerald-900/30 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .budget-slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4DD19D;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(77, 209, 157, 0.5);
        }
        
        .budget-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4DD19D;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(77, 209, 157, 0.5);
        }
      `}</style>
      <div className="min-h-screen text-white">
      {/* Top Navigation */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-8 2xl:px-12 py-5 2xl:py-6 flex items-center gap-8 2xl:gap-10">
          <img 
            src={profitLogo} 
            alt="Profit Logo" 
            className="w-10 h-10 2xl:w-12 2xl:h-12 object-contain"
          />
          <button className="text-emerald-100 hover:text-white transition-colors font-medium text-base 2xl:text-lg">
            Create
          </button>
          <button className="text-gray-500 hover:text-gray-400 transition-colors text-base 2xl:text-lg">
            Projects
          </button>
        </div>
      </div>

      <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-8 2xl:px-12 py-10 2xl:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 2xl:gap-12">
          {/* Left Column - No Container */}
          <div>
            <div className="space-y-8 2xl:space-y-10">

              {/* Project Name */}
              <div>
                <div className="flex items-center gap-3 2xl:gap-4 mb-4 2xl:mb-5">
                  <div className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 bg-emerald-500 rounded-full"></div>
                  <label className="text-base 2xl:text-lg text-white font-medium">Project Name</label>
                </div>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#0a2820]/60 border-2 border-gray-600 rounded-xl px-5 2xl:px-6 py-4 2xl:py-5 text-base 2xl:text-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-all"
                />
              </div>

              {/* Date */}
              <div>
                <div className="flex items-center gap-3 2xl:gap-4 mb-4 2xl:mb-5">
                  <div className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 bg-emerald-500 rounded-full"></div>
                  <label className="text-base 2xl:text-lg text-white font-medium">Date</label>
                </div>
                <div className="grid grid-cols-2 gap-5 2xl:gap-6">
                  <div>
                    <label className="text-sm 2xl:text-base text-gray-400 mb-3 2xl:mb-4 block">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#0a2820]/60 border-2 border-gray-600 rounded-xl px-5 2xl:px-6 py-3.5 2xl:py-4 text-base 2xl:text-lg text-gray-300 focus:outline-none focus:border-gray-500 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-sm 2xl:text-base text-gray-400 mb-3 2xl:mb-4 block">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full bg-[#0a2820]/60 border-2 border-gray-600 rounded-xl px-5 2xl:px-6 py-3.5 2xl:py-4 text-base 2xl:text-lg text-gray-300 focus:outline-none focus:border-gray-500 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
                <p className="text-sm 2xl:text-base text-gray-400 mt-3 2xl:mt-4">
                  Run Ads for at-least <span className="text-white font-medium">3 days</span> as per your advantage.
                </p>
              </div>

              {/* Cities and countries to target */}
              <div>
                <div className="flex items-center gap-3 2xl:gap-4 mb-4 2xl:mb-5">
                  <div className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 bg-emerald-500 rounded-full"></div>
                  <label className="text-base 2xl:text-lg text-white font-medium">Cities and countries to target</label>
                </div>
                <input
                  type="text"
                  placeholder="Add a city or pick one"
                  className="w-full bg-[#0a2820]/60 border-2 border-gray-600 rounded-xl px-5 2xl:px-6 py-4 2xl:py-5 text-base 2xl:text-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-all mb-4 2xl:mb-5"
                />
                <div className="flex flex-wrap gap-3 2xl:gap-4">
                  {["United States", "Toronto", "India"].map((location, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 2xl:gap-3 bg-[#4DD19D]/20 text-[#4DD19D] text-base 2xl:text-lg px-5 2xl:px-6 py-2.5 2xl:py-3 rounded-xl"
                    >
                      {location}
                      <button className="hover:text-white transition-colors">
                        <svg className="w-5 h-5 2xl:w-6 2xl:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Bid Strategy */}
              <div>
                <div className="flex items-center gap-3 2xl:gap-4 mb-4 2xl:mb-5">
                  <div className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 bg-emerald-500 rounded-full"></div>
                  <label className="text-base 2xl:text-lg text-white font-medium">Bid Strategy</label>
                </div>
                <div className="space-y-4 2xl:space-y-5">
                  {/* Strategy Selection */}
                  <div className="grid grid-cols-2 gap-4 2xl:gap-5">
                    <button
                      onClick={() => setBidStrategy("automatic")}
                      className={`p-4 2xl:p-5 rounded-xl border-2 transition-all ${
                        bidStrategy === "automatic"
                          ? "bg-[#4DD19D]/20 border-[#4DD19D]"
                          : "bg-[#0a2820]/60 border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-base 2xl:text-lg text-white font-medium mb-1.5 2xl:mb-2">Automatic</p>
                        <p className="text-sm 2xl:text-base text-gray-400">AI optimizes bids</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setBidStrategy("manual")}
                      className={`p-4 2xl:p-5 rounded-xl border-2 transition-all ${
                        bidStrategy === "manual"
                          ? "bg-[#4DD19D]/20 border-[#4DD19D]"
                          : "bg-[#0a2820]/60 border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-base 2xl:text-lg text-white font-medium mb-1.5 2xl:mb-2">Manual</p>
                        <p className="text-sm 2xl:text-base text-gray-400">Set your own bid</p>
                      </div>
                    </button>
                  </div>

                  {/* Manual Bid Amount */}
                  {bidStrategy === "manual" && (
                    <div className="bg-[#0a2820]/60 border border-gray-600 rounded-lg p-4">
                      <label className="text-xs text-gray-400 mb-2 block">Bid Amount ($)</label>
                      <input
                        type="number"
                        value={manualBidAmount}
                        onChange={(e) => setManualBidAmount(e.target.value)}
                        placeholder="2.50"
                        className="w-full bg-[#0a2820] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#4DD19D] transition-all"
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        Recommended: $1.50 - $5.00
                      </p>
                    </div>
                  )}

                  {/* Automatic Strategy Info */}
                  {bidStrategy === "automatic" && (
                    <div className="bg-[#0a2820]/60 border border-gray-600 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-[#4DD19D] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-xs text-white font-medium mb-1">AI-Powered Optimization</p>
                          <p className="text-xs text-gray-400">
                            Our AI automatically adjusts bids to maximize your campaign performance and ROI.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Right Column */}
          <div className="bg-gradient-to-br from-[#1a4d3a] via-[#164a36] to-[#1a4d3a] rounded-3xl p-10 2xl:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="bg-[#0d2820]/60 rounded-2xl p-6 2xl:p-8 shadow-[0_15px_50px_rgba(0,0,0,0.8)]">
            {/* Daily Budgets */}
            <div className="mb-8 2xl:mb-10">
              <div className="flex items-center gap-3 2xl:gap-4 mb-5 2xl:mb-6">
                <svg className="w-6 h-6 2xl:w-7 2xl:h-7 text-[#4DD19D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <h3 className="text-xl 2xl:text-2xl font-semibold text-white">Daily Budgets</h3>
              </div>
              
              <div className="relative mb-4">
                <div 
                  className="absolute -top-2 bg-white text-gray-900 text-xs font-bold px-2 py-0.5 rounded shadow-lg transition-all"
                  style={{ left: `calc(${(budget-10)/190*100}% - 16px)` }}
                >
                  {budget}
                </div>
                <div className="pt-4">
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer budget-slider"
                    style={{
                      background: `linear-gradient(to right, #4DD19D 0%, #4DD19D ${(budget-10)/190*100}%, rgba(255,255,255,0.2) ${(budget-10)/190*100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-emerald-200/70 mt-2">
                    <span>Limited</span>
                    <span>Basic</span>
                    <span>2x reach</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 2xl:gap-4 bg-[#0a2820]/60 rounded-xl p-4 2xl:p-5">
                <svg className="w-5 h-5 2xl:w-6 2xl:h-6 text-[#4DD19D] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-base 2xl:text-lg text-white">
                  Your budget is limited, increase budget to perform better
                </p>
              </div>
            </div>

            {/* Ad Sets */}
            <div>
              <div className="flex items-center justify-between mb-5 2xl:mb-6">
                <div className="flex items-center gap-3 2xl:gap-4">
                  <svg className="w-6 h-6 2xl:w-7 2xl:h-7 text-[#4DD19D]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl 2xl:text-2xl font-semibold text-white">Ad Sets</h3>
                </div>
                
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*"
                  multiple
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                
                {/* Ad Media Button */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex items-center gap-2 2xl:gap-3 bg-transparent border-2 px-5 2xl:px-6 py-2.5 2xl:py-3 rounded-xl text-base 2xl:text-lg font-medium transition-colors hover:bg-[#4DD19D]/10"
                  style={{ 
                    borderColor: 'rgba(77, 209, 157, 1)', 
                    color: 'rgba(77, 209, 157, 1)' 
                  }}
                >
                  <svg className="w-5 h-5 2xl:w-6 2xl:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Ad Media
                  {uploadedVideos.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#4DD19D] text-black text-xs 2xl:text-sm w-6 h-6 2xl:w-7 2xl:h-7 rounded-full flex items-center justify-center font-bold">
                      {uploadedVideos.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Uploaded Videos List */}
              {uploadedVideos.length > 0 && (
                <div className="mb-6 bg-[#0f1f1a]/30 rounded-lg p-5">
                  <h4 className="text-sm text-emerald-300/60 mb-4">Uploaded Videos ({uploadedVideos.length})</h4>
                  <div className="space-y-2">
                    {uploadedVideos.map((video, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#0f1f1a]/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 6v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-emerald-100 truncate">{video.name}</p>
                            <p className="text-xs text-emerald-400/50">{video.size} MB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeVideo(index)}
                          className="ml-3 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ad Set Tabs - Centered with Navigation */}
              <div className="flex justify-center items-center mb-5 2xl:mb-6">
                <div className="flex items-center gap-3 2xl:gap-4 bg-[#4DD19D] hover:bg-[#3bc18a] text-black px-6 2xl:px-8 py-3 2xl:py-4 rounded-xl text-base 2xl:text-lg font-semibold transition-all shadow-lg">
                  {/* Left Arrow - Hidden on first ad set */}
                  {selectedAdSet > 0 && (
                    <button 
                      onClick={() => setSelectedAdSet(selectedAdSet - 1)}
                      className="hover:scale-110 transition-transform"
                    >
                      <svg className="w-5 h-5 2xl:w-6 2xl:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Center Content */}
                  <div className="flex items-center gap-2 2xl:gap-3 px-3 2xl:px-4">
                    <svg className="w-5 h-5 2xl:w-6 2xl:h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{adSets[selectedAdSet].name}</span>
                  </div>

                  {/* Right Arrow */}
                  <button 
                    onClick={() => setSelectedAdSet(selectedAdSet < adSets.length - 1 ? selectedAdSet + 1 : 0)}
                    className="hover:scale-110 transition-transform"
                  >
                    <svg className="w-5 h-5 2xl:w-6 2xl:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Ad Set Content */}
              <div className="bg-[#0d2820]/60 rounded-2xl overflow-hidden shadow-xl">
                {/* Ad Image - Removed */}

                <div className="p-5 2xl:p-6">
                  <h4 className="text-base 2xl:text-lg font-semibold mb-3 2xl:mb-4 text-center text-white">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].title}</h4>
                  
                  <div className="grid grid-cols-3 gap-3 2xl:gap-4 mb-3 2xl:mb-4">
                    <div className="text-center">
                      <p className="text-sm 2xl:text-base text-emerald-300/70 mb-1 2xl:mb-1.5">Age</p>
                      <p className="text-base 2xl:text-lg font-bold text-white">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].age}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm 2xl:text-base text-emerald-300/70 mb-1 2xl:mb-1.5">Gender</p>
                      <p className="text-base 2xl:text-lg font-bold text-white">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].gender}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm 2xl:text-base text-emerald-300/70 mb-1 2xl:mb-1.5">Ads spent</p>
                      <p className="text-base 2xl:text-lg font-bold text-white">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].adsSpent}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowAdContent(!showAdContent)}
                    className="w-full flex items-center justify-center gap-2 2xl:gap-3 text-white hover:text-emerald-300 transition-colors py-3 2xl:py-4 border-t-2 border-gray-700 mb-3 2xl:mb-4"
                  >
                    <span className="text-sm 2xl:text-base font-semibold">Ad Content</span>
                    <svg 
                      className={`w-4 h-4 2xl:w-5 2xl:h-5 transition-transform ${showAdContent ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Ad Content Expandable Section */}
                  {showAdContent && (
                    <div className="bg-[#0f1f1a]/50 rounded-lg p-3 mb-2 space-y-2">
                      <div>
                        <p className="text-xs text-emerald-300/70 mb-1">Headline</p>
                        <p className="text-sm text-white font-medium">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].adContent.headline}</p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-300/70 mb-1">Description</p>
                        <p className="text-xs text-emerald-100/80">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].adContent.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-emerald-300/70 mb-1">CTA</p>
                          <p className="text-sm text-white font-medium">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].adContent.cta}</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-300/70 mb-1">Link</p>
                          <p className="text-xs text-emerald-400 truncate">{(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].adContent.link}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-t-2 border-gray-700 pt-4 2xl:pt-5">
                    <h5 className="text-sm 2xl:text-base font-semibold mb-3 2xl:mb-4 text-center text-white">Audience Tags</h5>
                    <div className="flex flex-wrap justify-center gap-2 2xl:gap-3 mb-4 2xl:mb-5">
                      {(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].tags.map((tag, index) => (
                        <span key={index} className="bg-emerald-700/40 text-emerald-200 text-sm 2xl:text-base px-3 2xl:px-4 py-1.5 2xl:py-2 rounded-lg font-medium shadow-md">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Preview Image */}
                    <div className="mt-4 2xl:mt-5">
                      <img
                        src={(adSetsData.length > 0 ? adSetsData : adSets)[selectedAdSet].image}
                        alt="Ad Preview"
                        className="w-full h-56 2xl:h-64 object-cover rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
                      />
                    </div>

                    {/* Publish Button */}
                    <div className="mt-4 2xl:mt-5">
                      <button 
                        className="w-full text-black px-6 2xl:px-8 py-3.5 2xl:py-4 rounded-xl text-base 2xl:text-lg font-semibold transition-all shadow-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(77, 209, 157, 1)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(77, 209, 157, 0.8)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(77, 209, 157, 1)'}
                      >
                        Publish
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default CampaignSetup;
