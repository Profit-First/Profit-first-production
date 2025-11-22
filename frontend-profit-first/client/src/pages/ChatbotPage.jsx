import { useState, useRef, useEffect } from "react";
import { FiSend, FiMic } from "react-icons/fi";
import logo from "../assets/logo.png";

const ChatbotPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, userMessage]);
    const currentInput = inputValue;
    setInputValue("");

    // Add loading message
    const loadingMessage = {
      id: Date.now() + 1,
      text: "Thinking...",
      sender: "bot",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("Please login to use the chatbot");
      }

      // Call backend API
      const response = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: currentInput })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Remove loading message and add bot response
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isLoading);
        const botMessage = {
          id: Date.now() + 2,
          text: result.data?.response || "I couldn't process that request. Please try again.",
          sender: "bot",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        return [...filtered, botMessage];
      });
    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove loading message and add error message
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isLoading);
        const errorMessage = {
          id: Date.now() + 2,
          text: `Error: ${error.message}. Please make sure you're logged in and try again.`,
          sender: "bot",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        return [...filtered, errorMessage];
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[#0D1D1E]">
      {/* Content Container */}
      <div className="relative h-full flex items-center justify-center p-8 2xl:p-12">
        <div className="w-full max-w-5xl 2xl:max-w-7xl h-[500px] 2xl:h-[650px] bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
          {/* Logo - Top Left */}
          <div className="absolute top-6 2xl:top-8 left-6 2xl:left-8 flex items-center gap-2 z-10">
            <img src={logo} alt="Logo" className="h-8 2xl:h-10 w-auto" />
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden pt-20 2xl:pt-24">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 2xl:px-8">
                <div className="w-full px-8 2xl:px-12">
                  <h1 className="text-4xl 2xl:text-5xl mb-8 2xl:mb-10 text-center" style={{ 
                    fontFamily: "'Inter', sans-serif", 
                    fontWeight: "900",
                    background: "linear-gradient(90deg, #10b981 0%, #10b981 45%, #ffffff 50%, #ffffff 55%, #10b981 60%, #10b981 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0 0 30px rgba(16, 185, 129, 0.5)"
                  }}>
                    PROFIT FIRST
                  </h1>
                  {/* Input in the middle */}
                  <div className="w-full max-w-xl 2xl:max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 2xl:gap-3 bg-[#1a2a2a] rounded-full px-3 2xl:px-4 py-1.5 2xl:py-2 border border-gray-700">
                      <button className="text-gray-400 hover:text-white transition-colors">
                        <span className="text-lg 2xl:text-xl">+</span>
                      </button>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Anything"
                        className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm 2xl:text-base"
                      />
                      <button className="text-gray-400 hover:text-white transition-colors">
                        <FiMic className="w-4 h-4 2xl:w-[18px] 2xl:h-[18px]" />
                      </button>
                      <button
                        onClick={handleSend}
                        className="bg-green-500 hover:bg-green-600 text-white rounded-full p-2 2xl:p-2.5 transition-colors"
                      >
                        <FiSend className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Messages Container with scroll - hidden scrollbar */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto px-6 2xl:px-8 py-6 2xl:py-8 scrollbar-hide"
                  style={{ 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  <div className="w-full max-w-3xl 2xl:max-w-4xl mx-auto space-y-4 2xl:space-y-5 min-h-full">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 2xl:px-5 py-3 2xl:py-4 ${
                            message.sender === "user"
                              ? "bg-green-500 text-white"
                              : "bg-[#1a2a2a] text-white border border-gray-700"
                          }`}
                        >
                          <p className="text-sm 2xl:text-base whitespace-pre-wrap break-words">{message.text}</p>
                          <span className="text-[10px] 2xl:text-xs opacity-70 mt-1 block">
                            {message.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Invisible element to scroll to */}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                
                {/* Input at bottom - fixed position */}
                <div className="px-6 2xl:px-8 pb-6 2xl:pb-8 pt-2 bg-gradient-to-t from-black/50 to-transparent">
                  <div className="w-full max-w-3xl 2xl:max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 2xl:gap-3 bg-[#1a2a2a] rounded-full px-4 2xl:px-5 py-2 2xl:py-2.5 border border-gray-700">
                      <button className="text-gray-400 hover:text-white transition-colors">
                        <span className="text-lg 2xl:text-xl">+</span>
                      </button>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Anything"
                        className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm 2xl:text-base"
                      />
                      <button className="text-gray-400 hover:text-white transition-colors">
                        <FiMic className="w-4 h-4 2xl:w-[18px] 2xl:h-[18px]" />
                      </button>
                      <button
                        onClick={handleSend}
                        className="bg-green-500 hover:bg-green-600 text-white rounded-full p-2 2xl:p-2.5 transition-colors"
                      >
                        <FiSend className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
