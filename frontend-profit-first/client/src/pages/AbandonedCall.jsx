import React, { useState } from "react";
import { 
  FiPhone, 
  FiPhoneOff, 
  FiPhoneMissed, 
  FiPhoneIncoming, 
  FiPlay,
  FiFileText,
  FiX,
  FiShoppingCart,
  FiCheckCircle,
  FiMessageSquare,
  FiPause
} from "react-icons/fi";
import aiCalling from "../services/aiCalling";

const AbandonedCall = () => {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("today");
  const [selectedCall, setSelectedCall] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("Last 30 days");
  const [playingCallId, setPlayingCallId] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(null);
  const [isCallingInProgress, setIsCallingInProgress] = useState(false);
  const [callProgress, setCallProgress] = useState({ current: 0, total: 0 });

  // Mock data for call history
  const callHistory = [
    { 
      id: 0, 
      customerName: "Harsh (Test)", 
      phone: "+919322023539", 
      status: "pending", 
      date: "Today", 
      time: "Now", 
      duration: "0:00",
      waveform: [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55], 
      campaign: "Cart Recovery #1",
      cartValue: "₹2,500",
      reason: "Testing",
      hasRecording: false,
      transcript: ""
    },
    { 
      id: 1, 
      customerName: "Rahul Sharma", 
      phone: "+91 98765 43210", 
      status: "recovered", 
      date: "Friday at 8 pm", 
      time: "10:30 AM", 
      duration: "2:45",
      waveform: [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55], 
      campaign: "Cart Recovery #1",
      cartValue: "₹3,450",
      reason: "Forgot",
      hasRecording: true,
      transcript: "AI: Hello, this is a call from ProfitFirst. Am I speaking with Rahul Sharma?\nCustomer: Yes, this is Rahul.\nAI: I noticed you left some items in your cart worth ₹3,450. Would you like to complete your purchase? We're offering 10% off if you complete it now.\nCustomer: Oh yes! I forgot about that. Yes, please process the order.\nAI: Great! I'll send you a payment link right away. Thank you!"
    },
    { 
      id: 2, 
      customerName: "Priya Patel", 
      phone: "+91 98765 43211", 
      status: "voicemail", 
      date: "18 Oct at 8 pm", 
      time: "10:32 AM", 
      duration: "0:15", 
      campaign: "Cart Recovery #1",
      cartValue: "₹1,890",
      reason: "N/A",
      hasRecording: false,
      transcript: "",
      waveform: [50, 70, 40, 85, 60, 75, 45, 90, 55, 65, 50, 80, 45, 70, 60]
    },
    { 
      id: 3, 
      customerName: "Amit Kumar", 
      phone: "+91 98765 43212", 
      status: "no-answer", 
      date: "7 Oct at 4 pm", 
      time: "10:35 AM", 
      duration: "0:00", 
      campaign: "Cart Recovery #1",
      cartValue: "₹2,200",
      reason: "N/A",
      hasRecording: false,
      transcript: "",
      waveform: [40, 55, 70, 45, 80, 50, 65, 75, 40, 85, 60, 70, 50, 60, 45]
    },
    { 
      id: 4, 
      customerName: "Sneha Reddy", 
      phone: "+91 98765 43213", 
      status: "recovered", 
      date: "31 Oct at 8 pm", 
      time: "10:38 AM", 
      duration: "3:12", 
      campaign: "Cart Recovery #1",
      cartValue: "₹5,670",
      reason: "Wanted Discount",
      hasRecording: true,
      transcript: "AI: Hello, am I speaking with Sneha Reddy?\nCustomer: Yes.\nAI: I'm calling from ProfitFirst. You have items worth ₹5,670 in your cart. Would you like to complete your purchase?\nCustomer: Yes, but I was waiting for a discount.\nAI: Good news! I can offer you 15% off right now if you complete the purchase.\nCustomer: Perfect! Please send me the link.\nAI: I'll send it to your phone immediately. Thank you!",
      waveform: [60, 80, 50, 90, 65, 75, 55, 85, 45, 70, 60, 80, 50, 65, 75]
    },
    { 
      id: 5, 
      customerName: "Vikram Singh", 
      phone: "+91 98765 43214", 
      status: "busy", 
      date: "19 Oct at 4 pm", 
      time: "10:40 AM", 
      duration: "0:00", 
      campaign: "Cart Recovery #1",
      cartValue: "₹980",
      reason: "N/A",
      hasRecording: false,
      transcript: "",
      waveform: [45, 65, 55, 75, 50, 80, 60, 70, 45, 85, 55, 75, 50, 65, 70]
    },
    { 
      id: 6, 
      customerName: "Anjali Mehta", 
      phone: "+91 98765 43215", 
      status: "recovered", 
      date: "15 Oct at 3 pm", 
      time: "10:42 AM", 
      duration: "1:58", 
      campaign: "Cart Recovery #2",
      cartValue: "₹4,320",
      reason: "Just Browsing",
      hasRecording: true,
      transcript: "AI: Hello, this is ProfitFirst calling. Am I speaking with Anjali Mehta?\nCustomer: Yes, speaking.\nAI: You have items worth ₹4,320 in your cart. Would you like to complete your order?\nCustomer: Yes, please go ahead.\nAI: Excellent! I'll process your order right away. Thank you for shopping with us!",
      waveform: [55, 75, 45, 85, 60, 70, 50, 80, 55, 65, 75, 50, 70, 60, 80]
    },
    { 
      id: 7, 
      customerName: "Rohan Gupta", 
      phone: "+91 98765 43216", 
      status: "no-answer", 
      date: "2 Nov at 11 am", 
      time: "10:45 AM", 
      duration: "0:00", 
      campaign: "Cart Recovery #2",
      cartValue: "₹2,100",
      reason: "N/A",
      hasRecording: false,
      transcript: "",
      waveform: [50, 70, 55, 80, 45, 75, 60, 85, 50, 70, 55, 65, 75, 50, 70]
    },
    { 
      id: 8, 
      customerName: "Kavita Joshi", 
      phone: "+91 98765 43217", 
      status: "recovered", 
      date: "28 Oct at 6 pm", 
      time: "10:48 AM", 
      duration: "4:20", 
      campaign: "Cart Recovery #2",
      cartValue: "₹6,780",
      reason: "Comparing Prices",
      hasRecording: true,
      transcript: "AI: Hello, am I speaking with Kavita Joshi?\nCustomer: Yes, that's me.\nAI: I'm calling from ProfitFirst. You have items worth ₹6,780 in your cart. Can I help you complete the purchase?\nCustomer: I was comparing prices. What discount can you offer?\nAI: I can offer you 20% off plus free shipping if you complete it now.\nCustomer: That's a great deal! Yes, please process it.\nAI: Perfect! I'll send you the payment link. Thank you!",
      waveform: [70, 85, 60, 90, 55, 80, 65, 75, 50, 85, 60, 75, 55, 70, 80]
    },
  ];

  const stats = {
    totalCalls: 156,
    recovered: 89,
    voicemail: 23,
    noAnswer: 32,
    busy: 12,
    recoveryRate: 57.1,
    totalCartValue: "₹4,56,780"
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case "recovered": return <FiPhoneIncoming className="text-green-500" />;
      case "voicemail": return <FiPhone className="text-yellow-500" />;
      case "no-answer": return <FiPhoneMissed className="text-red-500" />;
      case "busy": return <FiPhoneOff className="text-orange-500" />;
      default: return <FiPhone />;
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case "recovered": return "Recovered";
      case "voicemail": return "Voicemail";
      case "no-answer": return "No Answer";
      case "busy": return "Busy";
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "recovered": return "text-green-500";
      case "voicemail": return "text-yellow-500";
      case "no-answer": return "text-red-500";
      case "busy": return "text-orange-500";
      default: return "text-gray-500";
    }
  };

  const filteredCalls = callHistory.filter(call => {
    const matchesFilter = selectedFilter === "all" || call.status === selectedFilter;
    const matchesSearch = call.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         call.phone.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const handleStartCampaign = async () => {
    if (isCallingInProgress) return;

    setIsCallingInProgress(true);
    // Only call test number (Harsh)
    const pendingCarts = callHistory.filter(call => 
      call.phone === "+919322023539" && call.status !== "recovered"
    );
    setCallProgress({ current: 0, total: pendingCarts.length });

    for (let i = 0; i < pendingCarts.length; i++) {
      const cart = pendingCarts[i];
      setCallProgress({ current: i + 1, total: pendingCarts.length });

      try {
        // Extract items from cart (mock data)
        const items = ["Product 1", "Product 2"]; // In real app, get from cart data
        
        const result = await aiCalling.makeAbandonedCartCall({
          customerName: cart.customerName,
          phoneNumber: cart.phone.replace(/\s/g, ''), // Remove spaces
          cartItems: items,
          cartValue: parseInt(cart.cartValue.replace(/[₹,]/g, '')),
          language: "hi-IN"
        });

        if (result.success) {
          console.log(`✅ Call initiated for ${cart.customerName} - Call ID: ${result.callId}`);
        } else {
          console.error(`❌ Call failed for ${cart.customerName}: ${result.error}`);
        }

        // Wait 5 seconds between calls
        if (i < pendingCarts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error calling ${cart.customerName}:`, error);
      }
    }

    setIsCallingInProgress(false);
    setCallProgress({ current: 0, total: 0 });
    alert('Campaign completed! Check console for details.');
  };

  return (
    <div className="min-h-screen bg-[#0D1D1E] text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-2">
          <FiShoppingCart className="w-6 h-6" />
          <h1 className="text-xl font-bold">Abandon Cart</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total calls</div>
              <div className="text-2xl font-bold">{stats.totalCalls}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiPhone className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Recovered</div>
              <div className="text-2xl font-bold">{stats.recovered}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Voicemail</div>
              <div className="text-2xl font-bold">{stats.voicemail}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiMessageSquare className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">No Answer</div>
              <div className="text-2xl font-bold">{stats.noAnswer}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiPhoneMissed className="w-5 h-5 text-black" />
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-gray-400 mb-1">Recovery Rate</div>
              <div className="text-2xl font-bold">{stats.recoveryRate}%</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <FiPhoneIncoming className="w-5 h-5 text-black" />
            </div>
          </div>
        </div>

        {/* Call History Table */}
        <div className="bg-[#161616] rounded-lg overflow-hidden shadow-lg">
          {/* Filter Bar inside table */}
          <div 
            className="p-3 flex items-center justify-between border-b border-gray-800 cursor-pointer"
            style={{ backgroundColor: 'rgb(22, 55, 40)' }}
            onClick={() => setIsTableCollapsed(!isTableCollapsed)}
          >
            <div className="flex items-center gap-2">
              {showSearch ? (
                <div className="flex items-center gap-2 bg-black rounded-lg px-3 py-1.5 shadow-md animate-slideIn" onClick={(e) => e.stopPropagation()}>
                  <FiSearch className="text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="bg-transparent text-white placeholder-gray-400 outline-none w-48 text-sm"
                    autoFocus
                  />
                  <button onClick={(e) => {
                    e.stopPropagation();
                    setShowSearch(false);
                    setSearchQuery("");
                  }}>
                    <FiX className="text-gray-400 hover:text-white w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFilter("all");
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-md ${
                    selectedFilter === "all" 
                      ? "bg-black text-white" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  All
                </button>
              )}
            </div>
          </div>

          <div 
            className={`overflow-x-auto transition-all duration-500 ease-in-out ${
              isTableCollapsed 
                ? 'opacity-0 max-h-0 overflow-hidden' 
                : 'opacity-100 max-h-[2000px]'
            }`}
            style={{ background: 'linear-gradient(to bottom, rgb(22, 55, 40), rgb(5, 15, 10))' }}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Customer
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Phone
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Date
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Calls Done
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Summary
                  </th>
                  <th className="text-center py-3 px-3 text-gray-400 text-sm font-normal bg-black">
                    Confirmation
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((call) => (
                  <tr 
                    key={call.id} 
                    className="border-b border-gray-800 hover:bg-black/30 transition-colors"
                  >
                    <td className="py-2 px-3 text-white text-xs text-center max-w-[120px]">
                      <div className="truncate" title={call.customerName}>{call.customerName}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs text-center max-w-[110px]">
                      <div className="truncate" title={call.phone}>{call.phone}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs text-center max-w-[100px]">
                      <div className="truncate" title={call.date}>{call.date}</div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 relative">
                        <button 
                          onClick={() => {
                            if (playingCallId === call.id) {
                              setPlayingCallId(null);
                            } else {
                              setPlayingCallId(call.id);
                            }
                          }}
                          className="hover:opacity-80 transition-opacity"
                        >
                          {playingCallId === call.id ? (
                            <FiPause className="w-3 h-3 text-white" />
                          ) : (
                            <FiPlay className="w-3 h-3 text-white" />
                          )}
                        </button>
                        <div className="flex items-center gap-0.5 h-3">
                          {(call.waveform || [30, 60, 45, 80, 55, 90, 40, 70, 35, 85, 50, 75, 60, 40, 55]).map((height, i) => (
                            <div 
                              key={i} 
                              className="w-0.5 bg-white rounded-full" 
                              style={{ height: `${height}%` }}
                            ></div>
                          ))}
                        </div>
                        <span className="text-xs text-white ml-1">{call.duration}</span>
                        {playingCallId === call.id && (
                          <div className="relative">
                            <button
                              onClick={() => setShowSpeedMenu(showSpeedMenu === call.id ? null : call.id)}
                              className="text-xs text-white ml-1 px-1.5 py-0.5 bg-black/50 rounded hover:bg-black/70 transition-colors"
                            >
                              {playbackSpeed}x
                            </button>
                            {showSpeedMenu === call.id && (
                              <div className="absolute top-full mt-1 right-0 bg-black border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[60px]">
                                {[1, 1.5, 2].map((speed) => (
                                  <button
                                    key={speed}
                                    onClick={() => {
                                      setPlaybackSpeed(speed);
                                      setShowSpeedMenu(null);
                                    }}
                                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-800 transition-colors ${
                                      playbackSpeed === speed ? 'text-emerald-500 font-medium' : 'text-white'
                                    }`}
                                  >
                                    {speed}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center max-w-[150px]">
                      <span 
                        onClick={() => {
                          if (call.transcript) {
                            setSelectedCall(call);
                            setShowTranscript(true);
                          }
                        }}
                        className={`text-white text-xs underline transition-opacity truncate block ${
                          call.transcript ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'
                        }`}
                        title={`Hi, ${call.customerName.split(' ')[0]} thanks....`}
                      >
                        Hi, {call.customerName.split(' ')[0]} thanks....
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap min-w-[110px] text-center ${
                        call.status === "recovered" 
                          ? "bg-emerald-500 text-black" 
                          : "bg-red-500 text-white"
                      }`}>
                        {call.status === "recovered" ? "Recovered" : "Not Recovered"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4 flex justify-end gap-3 items-center">
          {isCallingInProgress && (
            <div className="text-sm text-gray-300">
              Calling {callProgress.current} of {callProgress.total}...
            </div>
          )}
          <button 
            onClick={handleStartCampaign}
            disabled={isCallingInProgress}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              isCallingInProgress 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-600'
            } text-black`}
          >
            <FiPhone className="w-4 h-4" />
            {isCallingInProgress ? 'Calling...' : 'Start New Campaign'}
          </button>
        </div>

        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* Transcript Modal */}
        {showTranscript && selectedCall && (
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => {
              setShowTranscript(false);
              setSelectedCall(null);
            }}
          >
            <div 
              className="rounded-xl border border-gray-700 max-w-xl w-full max-h-[70vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'linear-gradient(to bottom, rgb(22, 55, 40), rgb(5, 15, 10))' }}
            >
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Call Transcript</h3>
                  <p className="text-gray-300 text-xs mt-0.5">{selectedCall.customerName} - {selectedCall.time}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowTranscript(false);
                    setSelectedCall(null);
                  }}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-white transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div 
                className="p-4 pb-6 overflow-y-scroll max-h-[58vh] scrollbar-hide"
              >
                <div className="space-y-3">
                  {selectedCall.transcript.split('\n').map((line, index) => {
                    const isAI = line.startsWith('AI:');
                    const isCustomer = line.startsWith('Customer:');
                    const text = line.replace(/^(AI:|Customer:)\s*/, '');
                    
                    return (
                      <div key={index} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg p-3 ${
                          isAI 
                            ? 'bg-black/50 border border-gray-700' 
                            : 'bg-emerald-500/20 border border-emerald-500/40'
                        }`}>
                          <div className="text-[10px] text-gray-400 mb-1 font-medium">
                            {isAI ? 'AI Agent' : 'Customer'}
                          </div>
                          <p className="text-white text-sm leading-relaxed">{text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbandonedCall;
