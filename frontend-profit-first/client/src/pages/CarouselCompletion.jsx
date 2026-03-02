import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const CarouselCompletion = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [confetti, setConfetti] = useState([]);

  // Card content that changes in the center
  const cardContents = [
    {
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: "Critical Thinking, Solutions on the way!"
    },
    {
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Analyzing Performance Metrics"
    },
    {
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "Optimizing Target Audiences"
    },
    {
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Maximizing ROI & Revenue"
    },
    {
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Campaign Setup Complete!"
    }
  ];

  // Generate confetti particles
  useEffect(() => {
    if (showCompletion) {
      const particles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 1.5 + Math.random() * 0.5,
        rotation: Math.random() * 360,
        color: ['#10b981', '#22c55e', '#34d399', '#4ade80', '#6ee7b7', '#86efac'][Math.floor(Math.random() * 6)],
        shape: Math.random() > 0.5 ? 'circle' : 'paper', // Mix of circles and paper
        width: Math.random() > 0.5 ? 8 : 12, // Varied widths for paper
        height: Math.random() > 0.5 ? 12 : 8 // Varied heights for paper
      }));
      setConfetti(particles);
    }
  }, [showCompletion]);

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % 5;
        // Show completion after one full cycle
        if (next === 0 && prev === 4) {
          setTimeout(() => setShowCompletion(true), 500);
        }
        return next;
      });
    }, 3100);

    return () => clearInterval(interval);
  }, []);

  // Calculate position and opacity for each card
  const getCardStyle = (index) => {
    const diff = (index - currentIndex + 5) % 5;
    
    const positions = {
      0: { left: '50%', transform: 'translateX(-50%) scale(1)', opacity: 1, zIndex: 50 },
      1: { left: '65%', transform: 'translateX(-50%) scale(0.85)', opacity: 0.49, zIndex: 40 },
      2: { left: '78%', transform: 'translateX(-50%) scale(0.7)', opacity: 0.2, zIndex: 30 },
      3: { left: '22%', transform: 'translateX(-50%) scale(0.7)', opacity: 0.2, zIndex: 30 },
      4: { left: '35%', transform: 'translateX(-50%) scale(0.85)', opacity: 0.49, zIndex: 40 }
    };

    return positions[diff];
  };

  if (showCompletion) {
    return (
      <div className="h-screen bg-gradient-to-br from-[#0a3d2e] via-[#0d4d3a] to-[#0a3d2e] flex items-center justify-center relative overflow-hidden">
        {/* Confetti */}
        {confetti.map((particle) => (
          <div
            key={particle.id}
            className="absolute"
            style={{
              left: `${particle.left}%`,
              top: '-20px',
              width: particle.shape === 'circle' ? '12px' : `${particle.width}px`,
              height: particle.shape === 'circle' ? '12px' : `${particle.height}px`,
              backgroundColor: particle.color,
              borderRadius: particle.shape === 'circle' ? '50%' : '2px',
              animation: `fall ${particle.duration}s linear ${particle.delay}s forwards`,
              transform: `rotate(${particle.rotation}deg)`
            }}
          />
        ))}

        {/* Completion Content */}
        <div className="text-center z-10 animate-scaleIn">
          <div className="mb-6 flex justify-center">
            <div className="w-32 h-32 rounded-full bg-green-500/20 flex items-center justify-center animate-checkBounce">
              <svg className="w-20 h-20 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 animate-fadeIn">Done!</h1>
          <p className="text-gray-300 text-lg mb-8 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            Your campaign is ready to launch
          </p>
          <button
            onClick={() => navigate('/dashboard/meta-ads')}
            className="bg-green-500 hover:bg-green-600 text-black px-8 py-3 rounded-lg font-semibold transition-colors animate-fadeIn"
            style={{ animationDelay: '0.4s' }}
          >
            Return to Campaign
          </button>
        </div>

        <style jsx>{`
          @keyframes fall {
            to {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          @keyframes scaleIn {
            from {
              transform: scale(0.5);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes checkBounce {
            0%, 100% {
              transform: scale(1) rotate(0deg);
            }
            50% {
              transform: scale(1.1) rotate(5deg);
            }
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
          .animate-scaleIn {
            animation: scaleIn 0.6s ease-out;
          }
          .animate-checkBounce {
            animation: checkBounce 2s ease-in-out infinite;
          }
          .animate-fadeIn {
            animation: fadeIn 0.6s ease-out forwards;
            opacity: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a3d2e] via-[#0d4d3a] to-[#0a3d2e] flex items-center justify-center overflow-hidden">
      {/* Carousel Container */}
      <div className="relative w-full h-[500px]">
        {[0, 1, 2, 3, 4].map((index) => {
          const style = getCardStyle(index);
          const isCenter = (index - currentIndex + 5) % 5 === 0;
          
          return (
            <div
              key={index}
              className="absolute top-1/2 -translate-y-1/2 w-[400px] h-[450px] transition-all duration-700 ease-in-out"
              style={style}
            >
              <div className="w-full h-full bg-gradient-to-br from-black via-[#0a1a1a] to-[#0d2d2d] rounded-2xl border border-gray-800 shadow-2xl p-8 flex flex-col items-center justify-center">
                {/* Icon */}
                <div className={`text-green-500 mb-6 transition-all duration-500 ${isCenter ? 'scale-100 opacity-100' : 'scale-75 opacity-50'}`}>
                  {cardContents[index].icon}
                </div>
                
                {/* Title - Only show on center card */}
                {isCenter && (
                  <h2 className="text-white text-xl font-semibold text-center animate-fadeInText">
                    {cardContents[index].title}
                  </h2>
                )}
                
                {/* Decorative elements */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                  {[0, 1, 2, 3, 4].map((dotIndex) => (
                    <div
                      key={dotIndex}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        dotIndex === index ? 'bg-green-500 w-8' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <style jsx>{`
          @keyframes fadeInText {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fadeInText {
            animation: fadeInText 0.5s ease-out;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CarouselCompletion;
