import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const MetaAds = () => {
  const [activeTab, setActiveTab] = useState("Active");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");
  const navigate = useNavigate();

  const loadingMessages = [
    "Analyzing campaign data...",
    "Fetching ad performance...",
    "Loading audience insights...",
    "Calculating metrics...",
    "Preparing creatives...",
    "Optimizing results...",
    "Finalizing data..."
  ];

  const handleCampaignClick = (campaignId) => {
    setIsLoading(true);
    setLoadingProgress(0);
    
    // Progress animation
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 0.5;
      setLoadingProgress(progress);
      if (progress >= 100) {
        clearInterval(progressInterval);
      }
    }, 100);

    // Message rotation every 1 second
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      setCurrentMessage(loadingMessages[messageIndex]);
      messageIndex = (messageIndex + 1) % loadingMessages.length;
    }, 1000);

    // Navigate after 20 seconds
    setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
      setIsLoading(false);
      navigate(`/dashboard/meta-ads/campaign/${campaignId}`);
    }, 20000);
  };
  
  const campaigns = [
    { name: "ABCD Campaign", spend: 16.00, roas: 16.00, rto: 16500 },
    { name: "DEFG Campaign", spend: 16.00, roas: 16.00, rto: 16500 },
    { name: "HIJKL Campaign", spend: 16.00, roas: 16.00, rto: 16500 },
    { name: "MNROP Campaign", spend: 16.00, roas: 16.00, rto: 16500 },
    { name: "STUV Campaign", spend: 16.00, roas: 16.00, rto: 16500 },
  ];

  return (
    <div className="h-screen text-white overflow-hidden flex flex-col relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-6">
            <svg className="w-32 h-32" viewBox="0 0 120 120">
              {/* Outer ring - Dark green */}
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="#0d4d3a"
                strokeWidth="8"
                fill="none"
                strokeDasharray="50 250"
                strokeLinecap="butt"
                transform="rotate(0 60 60)"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 60 60"
                  to="360 60 60"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Middle ring - Medium green */}
              <circle
                cx="60"
                cy="60"
                r="40"
                stroke="#10b981"
                strokeWidth="8"
                fill="none"
                strokeDasharray="40 200"
                strokeLinecap="butt"
                transform="rotate(0 60 60)"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="360 60 60"
                  to="0 60 60"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Inner ring - Light green */}
              <circle
                cx="60"
                cy="60"
                r="30"
                stroke="#34d399"
                strokeWidth="8"
                fill="none"
                strokeDasharray="30 150"
                strokeLinecap="butt"
                transform="rotate(0 60 60)"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 60 60"
                  to="360 60 60"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Center ring - Lightest green */}
              <circle
                cx="60"
                cy="60"
                r="20"
                stroke="#6ee7b7"
                strokeWidth="8"
                fill="none"
                strokeDasharray="20 100"
                strokeLinecap="butt"
                transform="rotate(0 60 60)"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="360 60 60"
                  to="0 60 60"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
            </div>
            
            {/* Loading Message */}
            <div className="h-6">
              <p className="text-gray-400 text-sm animate-pulse">{currentMessage}</p>
            </div>
          </div>
        </div>
      )}
      {/* Header Section */}
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-center mb-8 text-white">
            Launch your fully optimized AD in just 3 steps !
          </h1>

          {/* Steps Progress */}
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              {/* Step 1 */}
              <div className="flex flex-col items-center relative">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-400 mb-2 z-10"></div>
                <span className="text-sm font-medium text-white">Step 1</span>
              </div>
              
              {/* Line 1 - Not filled yet */}
              <div className="relative" style={{ width: '120px', marginTop: '-22px' }}>
                <div className="absolute w-full h-0.5 bg-gray-500"></div>
              </div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center relative">
                <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500 mb-2 z-10"></div>
                <span className="text-sm font-medium text-gray-400">Step 2</span>
              </div>
              
              {/* Line 2 - Not filled */}
              <div className="relative" style={{ width: '120px', marginTop: '-22px' }}>
                <div className="absolute w-full h-0.5 bg-gray-500"></div>
              </div>
              
              {/* Step 3 */}
              <div className="flex flex-col items-center relative">
                <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500 mb-2 z-10"></div>
                <span className="text-sm font-medium text-gray-400">Step 3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 max-w-7xl mx-auto p-6 w-full">
        {/* Campaigns Table */}
        <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl p-6 h-full flex flex-col border border-gray-800 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">All Campaigns</h2>
            <button className="bg-black hover:bg-[#1a1a1a] text-white px-6 py-2 rounded-lg font-medium transition-colors border border-gray-800">
              {activeTab}
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black bg-black">
                  <th className="text-left py-4 px-4 text-gray-300 font-normal text-base">
                    Campaign ⇅
                  </th>
                  <th className="text-left py-4 px-4 text-gray-300 font-normal text-base">
                    Amount Spend ⇅
                  </th>
                  <th className="text-left py-4 px-4 text-gray-300 font-normal text-base">
                    ROAS ⇅
                  </th>
                  <th className="text-left py-4 px-4 text-gray-300 font-normal text-base">
                    RTO ⇅
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign, index) => {
                  const campaignId = campaign.name.split(' ')[0].toLowerCase();
                  return (
                    <tr 
                      key={index} 
                      onClick={() => handleCampaignClick(campaignId)}
                      className="border-b border-gray-900 hover:bg-[#151515] transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4 text-white font-normal">{campaign.name}</td>
                      <td className="py-4 px-4 text-white font-normal">₹{campaign.spend.toFixed(2)}</td>
                      <td className="py-4 px-4 text-white font-normal">₹{campaign.roas.toFixed(2)}</td>
                      <td className="py-4 px-4 text-white font-normal">₹{campaign.rto.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaAds;
