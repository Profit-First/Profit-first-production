// Improved ChatBot with LangGraph AI System
import React, { useState, useRef, useEffect, useCallback } from "react";
import { FiSend, FiAlertCircle, FiLoader, FiZap } from "react-icons/fi";
import { toast } from "react-toastify";
import axiosInstance from "../../axios";
import { AiOutlineClose } from "react-icons/ai";

const ChatBotImproved = ({ onAnalysisComplete, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize the improved AI system
        const { data: initData } = await axiosInstance.post("/data/ai/init");

        if (initData.success) {
          setIsInitialized(true);
          setMessages([
            {
              sender: "bot",
              text: "👋 Hi! I'm your Profit First AI assistant powered by advanced analytics.\n\nI can help you understand your business metrics, identify opportunities, and provide actionable insights.\n\nWhat would you like to know?",
              isAnalysis: true,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          throw new Error("Failed to initialize AI");
        }
      } catch (err) {
        console.error("Init error:", err);
        setError("Failed to initialize AI assistant");
        toast.error("Could not connect to AI service");
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !isInitialized || isLoading) return;

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
      const { data: replyData } = await axiosInstance.post("/data/ai/chat", {
        message: currentInput,
      });

      if (replyData.success) {
        const botMessage = {
          sender: "bot",
          text: replyData.reply,
          isAnalysis: true,
          timestamp: new Date().toISOString(),
          metadata: replyData.metadata,
        };

        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error(replyData.error || "Failed to get response");
      }
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
          text: "I apologize, but I encountered an error. Please try rephrasing your question or try again in a moment.",
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isInitialized]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-black to-emerald-900 text-white rounded-lg shadow-lg overflow-hidden border-none">
      <div className="bg-black/20 p-4 text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FiZap className="text-green-400" />
            <h2 className="text-lg font-semibold">AI Analytics Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white text-xl hover:text-green-400 transition-colors"
            title="Close chatbot"
          >
            <AiOutlineClose />
          </button>
        </div>
        <p className="text-xs opacity-80 mt-1">
          {isInitialized ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Powered by LangGraph AI
            </span>
          ) : (
            "Initializing AI system..."
          )}
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
                  AI
                </div>
              </div>
            )}
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-md relative ${
                msg.sender === "user"
                  ? "bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-none"
                  : msg.isError
                  ? "bg-red-800 text-red-100 rounded-bl-none"
                  : "bg-gray-800/60 backdrop-blur-md text-gray-100 rounded-bl-none"
              }`}
            >
              {msg.text.split("\n").map((line, i) => (
                <p key={i} className="whitespace-pre-wrap leading-relaxed mb-1">
                  {line}
                </p>
              ))}
              {msg.metadata && msg.metadata.contextUsed > 0 && (
                <div className="text-xs mt-2 opacity-60 flex items-center gap-1">
                  <FiZap size={10} />
                  Used {msg.metadata.contextUsed} historical insights
                </div>
              )}
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
                <span>AI is analyzing your data...</span>
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
            disabled={isLoading || !isInitialized}
            placeholder={
              isLoading
                ? "AI is thinking..."
                : !isInitialized
                ? "Initializing AI..."
                : "Ask about revenue, profit, ROAS, shipping..."
            }
            className="flex-1 bg-black/20 backdrop-blur-md rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !isInitialized}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBotImproved;
