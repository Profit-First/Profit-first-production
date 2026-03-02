import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const CampaignDetails = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  
  // Mock data for different campaigns
  const campaignsData = {
    "abcd": {
      name: "ABCD Campaign",
      publishDate: "11/07/2025",
      adSets: [
        { name: "Audience A - Interests", dailySpend: "$50/day" },
        { name: "Audience B - Lookalike", dailySpend: "$35/day" },
        { name: "Audience C - Retargeting", dailySpend: "$20/day" }
      ],
      metrics: {
        revenue: "₹12,300",
        roas: "4.28x",
        totalPurchase: "10,000",
        adsSpent: "₹1000",
        impressions: "1,24,300",
        clicks: "29,000",
        ctr: "2.4%",
        cpm: "₹4.75",
        cpc: "₹0.02",
        addToCarts: "₹0.02",
        conversionRate: "3.7%",
        cpr: "₹17"
      },
      creatives: [
        { name: "Summer Collection 1", impressions: "300k" },
        { name: "Summer Collection 2", impressions: "300k" },
        { name: "Summer Collection 3", impressions: "300k" }
      ]
    },
    "defg": {
      name: "DEFG Campaign",
      publishDate: "10/15/2025",
      adSets: [
        { name: "Audience A - Interests", dailySpend: "$45/day" },
        { name: "Audience B - Lookalike", dailySpend: "$30/day" },
        { name: "Audience C - Retargeting", dailySpend: "$25/day" }
      ],
      metrics: {
        revenue: "₹15,800",
        roas: "5.12x",
        totalPurchase: "12,500",
        adsSpent: "₹1200",
        impressions: "1,45,600",
        clicks: "32,000",
        ctr: "2.8%",
        cpm: "₹5.20",
        cpc: "₹0.03",
        addToCarts: "₹0.03",
        conversionRate: "4.2%",
        cpr: "₹19"
      },
      creatives: [
        { name: "Winter Collection 1", impressions: "350k" },
        { name: "Winter Collection 2", impressions: "320k" },
        { name: "Winter Collection 3", impressions: "280k" }
      ]
    },
    "hijkl": {
      name: "HIJKL Campaign",
      publishDate: "09/22/2025",
      adSets: [
        { name: "Audience A - Interests", dailySpend: "$60/day" },
        { name: "Audience B - Lookalike", dailySpend: "$40/day" },
        { name: "Audience C - Retargeting", dailySpend: "$30/day" }
      ],
      metrics: {
        revenue: "₹18,500",
        roas: "6.15x",
        totalPurchase: "15,200",
        adsSpent: "₹1500",
        impressions: "1,78,900",
        clicks: "38,500",
        ctr: "3.1%",
        cpm: "₹6.10",
        cpc: "₹0.04",
        addToCarts: "₹0.04",
        conversionRate: "5.1%",
        cpr: "₹22"
      },
      creatives: [
        { name: "Spring Collection 1", impressions: "400k" },
        { name: "Spring Collection 2", impressions: "380k" },
        { name: "Spring Collection 3", impressions: "350k" }
      ]
    },
    "mnrop": {
      name: "MNROP Campaign",
      publishDate: "08/10/2025",
      adSets: [
        { name: "Audience A - Interests", dailySpend: "$55/day" },
        { name: "Audience B - Lookalike", dailySpend: "$38/day" },
        { name: "Audience C - Retargeting", dailySpend: "$22/day" }
      ],
      metrics: {
        revenue: "₹14,200",
        roas: "4.85x",
        totalPurchase: "11,800",
        adsSpent: "₹1100",
        impressions: "1,35,400",
        clicks: "30,200",
        ctr: "2.6%",
        cpm: "₹5.50",
        cpc: "₹0.03",
        addToCarts: "₹0.03",
        conversionRate: "4.0%",
        cpr: "₹18"
      },
      creatives: [
        { name: "Fall Collection 1", impressions: "320k" },
        { name: "Fall Collection 2", impressions: "310k" },
        { name: "Fall Collection 3", impressions: "290k" }
      ]
    },
    "stuv": {
      name: "STUV Campaign",
      publishDate: "07/05/2025",
      adSets: [
        { name: "Audience A - Interests", dailySpend: "$48/day" },
        { name: "Audience B - Lookalike", dailySpend: "$32/day" },
        { name: "Audience C - Retargeting", dailySpend: "$18/day" }
      ],
      metrics: {
        revenue: "₹11,900",
        roas: "3.95x",
        totalPurchase: "9,500",
        adsSpent: "₹950",
        impressions: "1,18,700",
        clicks: "27,800",
        ctr: "2.3%",
        cpm: "₹4.50",
        cpc: "₹0.02",
        addToCarts: "₹0.02",
        conversionRate: "3.5%",
        cpr: "₹16"
      },
      creatives: [
        { name: "Casual Collection 1", impressions: "280k" },
        { name: "Casual Collection 2", impressions: "270k" },
        { name: "Casual Collection 3", impressions: "260k" }
      ]
    }
  };

  const campaign = campaignsData[campaignId] || campaignsData["abcd"];

  // Placeholder images for t-shirts
  const tshirtImages = [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop"
  ];

  return (
    <div className="h-screen bg-[#0D1D1E] text-white overflow-y-auto scrollbar-hide" style={{
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      {/* Header Section with Green Gradient */}
      <div className="bg-gradient-to-r from-[#0a3d2e] via-[#0d4d3a] to-[#0a3d2e] py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-center mb-6 text-white">
            Almost There !
          </h1>

          {/* Steps Progress */}
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              {/* Step 1 */}
              <div className="flex flex-col items-center relative">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-400 mb-2 z-10"></div>
                <span className="text-sm font-medium text-white">Step 1</span>
              </div>
              
              {/* Line 1 - Animating to fill */}
              <div className="relative" style={{ width: '120px', marginTop: '-22px' }}>
                <div className="absolute w-full h-0.5 bg-gray-500"></div>
                <div 
                  className="absolute h-0.5 bg-green-500 transition-all duration-1000 ease-out"
                  style={{ width: '100%', animation: 'fillLine 1s ease-out forwards' }}
                ></div>
              </div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center relative">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-400 mb-2 z-10"></div>
                <span className="text-sm font-medium text-white">Step 2</span>
              </div>
              
              {/* Line 2 - Not filled yet */}
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Campaign Header */}
        <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl p-6 border border-gray-800 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-2">{campaign.name}</h2>
          <p className="text-gray-400 text-sm">Published Date: {campaign.publishDate}</p>
        </div>

        {/* Ad Sets Section */}
        <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl p-6 border border-gray-800 shadow-2xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Ad Sets (3)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaign.adSets.map((adSet, index) => (
              <div key={index} className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-lg p-4 border border-gray-800">
                <h4 className="text-white font-medium mb-2">{adSet.name}</h4>
                <p className="text-gray-400 text-sm">Daily Spend: {adSet.dailySpend}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics Section */}
        <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl p-6 border border-gray-800 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Performance Metrics
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Oct 1, 2025 - Oct 2, 2025
            </div>
          </div>

          {/* Top Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-lg p-4 border border-gray-800 relative">
              <div className="absolute top-4 right-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-500 text-lg">₹</span>
                </div>
              </div>
              <span className="text-gray-400 text-sm block mb-2">Revenue</span>
              <p className="text-2xl font-bold text-white">{campaign.metrics.revenue}</p>
            </div>

            <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-lg p-4 border border-gray-800 relative">
              <div className="absolute top-4 right-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <span className="text-gray-400 text-sm block mb-2">ROAS</span>
              <p className="text-2xl font-bold text-white">{campaign.metrics.roas}</p>
            </div>

            <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-lg p-4 border border-gray-800 relative">
              <div className="absolute top-4 right-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              <span className="text-gray-400 text-sm block mb-2">Total Purchase</span>
              <p className="text-2xl font-bold text-white">{campaign.metrics.totalPurchase}</p>
            </div>

            <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-lg p-4 border border-gray-800 relative">
              <div className="absolute top-4 right-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <span className="text-gray-400 text-sm block mb-2">Ads Spent</span>
              <p className="text-2xl font-bold text-white">{campaign.metrics.adsSpent}</p>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              { label: "Impressions", value: campaign.metrics.impressions },
              { label: "Clicks", value: campaign.metrics.clicks },
              { label: "CTR", value: campaign.metrics.ctr },
              { label: "CPM", value: campaign.metrics.cpm },
              { label: "CPC", value: campaign.metrics.cpc },
              { label: "Add to carts", value: campaign.metrics.addToCarts },
              { label: "Conv. Rate", value: campaign.metrics.conversionRate },
              { label: "CPR", value: campaign.metrics.cpr }
            ].map((metric, index) => (
              <div key={index} className="p-3 relative">
                {index < 7 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-px bg-gray-700"></div>
                )}
                <p className="text-gray-400 text-xs mb-1">{metric.label}</p>
                <p className="text-white font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Creatives Section */}
        <div className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl p-6 border border-gray-800 shadow-2xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Creatives
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaign.creatives.map((creative, index) => (
              <div key={index} className="bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-lg overflow-hidden border border-gray-800">
                <img 
                  src={tshirtImages[index]} 
                  alt={creative.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h4 className="text-white font-medium mb-1">{creative.name}</h4>
                  <p className="text-gray-400 text-sm">{creative.impressions} Impressions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Proceed Button */}
        <div className="flex justify-center pb-6">
          <button 
            onClick={() => navigate('/dashboard/meta-ads/carousel-completion')}
            className="bg-green-500 hover:bg-green-600 text-black px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            Proceed
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetails;
