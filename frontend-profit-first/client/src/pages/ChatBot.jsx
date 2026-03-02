// src/components/ChatBot.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import { FiSend, FiAlertCircle, FiLoader } from "react-icons/fi";
import { toast } from "react-toastify";
import axiosInstance from "../../axios";
import { AiOutlineClose } from "react-icons/ai";

const ChatBot = ({ onAnalysisComplete, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatSession, setChatSession] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try fast AI system first (optimized for speed)
        try {
          const { data: initData } = await axiosInstance.post("/data/ai/fast/init");
          
          if (initData.success) {
            setChatSession({ 
              useFastAI: true, 
              sessionId: initData.sessionId 
            });
            setMessages([
              {
                sender: "bot",
                text: initData.message || "👋 Hi! I'm your Profit First AI assistant.\n\nI can help you understand your business metrics, identify opportunities, and provide actionable insights based on your actual data.\n\nWhat would you like to know?",
                isAnalysis: true,
                timestamp: new Date().toISOString(),
              },
            ]);
            setIsLoading(false);
            return;
          }
        } catch (fastAIError) {
          console.warn("Fast AI unavailable, trying advanced AI:", fastAIError.message);
        }

        // Try advanced AI system
        try {
          const { data: initData } = await axiosInstance.post("/data/ai/init");
          
          if (initData.success) {
            setChatSession({ useNewAI: true });
            setMessages([
              {
                sender: "bot",
                text: "👋 Hi! I'm your Profit First AI assistant.\n\nI can help you understand your business metrics, identify opportunities, and provide actionable insights based on your actual data.\n\nWhat would you like to know?",
                isAnalysis: true,
                timestamp: new Date().toISOString(),
              },
            ]);
            setIsLoading(false);
            return;
          }
        } catch (aiError) {
          console.warn("Advanced AI unavailable, falling back to basic chat:", aiError.message);
        }

        // Fallback to old system
        const { data: analyticsData } = await axiosInstance.get("/data/getData");

        if (onAnalysisComplete) {
          onAnalysisComplete(analyticsData);
        }

        const { data: sessionData } = await axiosInstance.post(
          "/data/newchat",
          { data: analyticsData }
        );

        setChatSession({
          threadId: sessionData.threadId,
          assistantId: sessionData.assistantId,
          useNewAI: false,
        });

        setMessages([
          {
            sender: "bot",
            text: "Welcome to your analytics assistant!",
            isAnalysis: true,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setError("Failed to initialize analytics assistant");
        toast.error("Could not connect to analytics service");
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, [onAnalysisComplete]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !chatSession || isLoading) return;

    const userMessage = {
      sender: "user",
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      let replyPayload;

      // Use fast AI system if available (fastest)
      if (chatSession.useFastAI) {
        const { data } = await axiosInstance.post("/data/ai/fast/chat", {
          sessionId: chatSession.sessionId,
          message: currentInput,
        });
        
        if (data.success) {
          replyPayload = {
            reply: data.reply,
            responseTime: data.responseTime,
          };
        } else {
          throw new Error(data.error || "AI response failed");
        }
      }
      // Use advanced AI system if available
      else if (chatSession.useNewAI) {
        const { data } = await axiosInstance.post("/data/ai/chat", {
          message: currentInput,
        });
        
        if (data.success) {
          replyPayload = {
            reply: data.reply,
            metadata: data.metadata,
          };
        } else {
          throw new Error(data.error || "AI response failed");
        }
      } else {
        // Fallback to old system
        const payload = {
          message: currentInput,
          threadId: chatSession.threadId,
          assistantId: chatSession.assistantId,
        };

        const { data } = await axiosInstance.post("/data/chatmessage", payload);
        replyPayload = { reply: data.reply };
      }

      const botMessage = {
        sender: "bot",
        text: replyPayload.reply,
        isAnalysis: true,
        timestamp: new Date().toISOString(),
        metadata: replyPayload.metadata,
        responseTime: replyPayload.responseTime,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("Send message error:", err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Sorry, I encountered an error processing your request.";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I apologize, but I encountered an error. Please try rephrasing your question.",
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, chatSession]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isReady = !!chatSession;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-black to-emerald-900 text-white rounded-lg shadow-lg overflow-hidden border-none">
      <div className="bg-black/20 p-4 text-white">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Analytics Assistant</h2>
          <button
            onClick={onClose}
            className="text-white text-xl hover:text-green-400 transition-colors"
            title="Close chatbot"
          >
            <AiOutlineClose />
          </button>
        </div>
        <p className="text-xs opacity-80">
          {isReady ? "Ready to answer your questions" : "Initializing assistant..."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.timestamp}-${idx}`}
            className={`flex mb-4 ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender !== "user" && (
              <div className="flex flex-col items-center mr-2">
                <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full mb-1">
                  Admin
                </div>
              </div>
            )}
            <div
              className={`max-w-70%] rounded-2xl px-4 py-3 text-sm shadow-md relative ${
                msg.sender === "user"
                  ? "bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-none"
                  : msg.isError
                  ? "bg-red-800 text-red-100 rounded-bl-none"
                  : "bg-gray-800/60 backdrop-blur-md text-gray-100 rounded-bl-none"
              }`}
            >
              {msg.text.split("\n").map((line, i) => (
                <p key={i} className="whitespace-pre-wrap leading-relaxed">
                  {line}
                </p>
              ))}
              <div className="text-xs mt-2 text-right opacity-70">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            {msg.sender === "user" && (
              <div className="flex flex-col items-center ml-2">
                <div className="bg-green-600 text-white text-xs px-2 py-1 rounded-full mb-1">
                  You
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 text-sm max-w-[85%]">
              <div className="flex items-center space-x-2 text-green-400">
                <FiLoader className="animate-spin" />
                <span>Analyzing your question...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 bg-black/20">
        {error && (
          <div className="flex items-center text-red-400 text-xs mb-2">
            <FiAlertCircle className="mr-1" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isReady}
            placeholder={
              isLoading
                ? "Processing..."
                : !isReady
                ? "Initializing assistant..."
                : "Ask about orders, revenue, ads, or deliveries..."
            }
            className="flex-1 bg-black/20 backdrop-blur-md rounded-lg px-2 py-2 text-white focus:outline-none focus:ring-green-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !isReady}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;