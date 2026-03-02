import React, { useState, useEffect } from 'react';

const RedMissage = () => {
  const messages = [
    {
      text: "Your ads spend this month: ₹30,000. Net profit: ₹20,000. Consider changing your campaigns!",
      color: "text-red-500", // red color for errors
    },
    {
      text: "Ad spend: ₹5,000. You sold ₹10,000 worth. Congratulations! Keep up the good work!",
      color: "text-green-500", // green color for success
    },
    {
      text: "Warning: Campaigns not performing well. Review your ads and make necessary changes.",
      color: "text-red-500",
    },
    {
      text: "Profit alert! You have gained ₹15,000 in revenue from your recent ads.",
      color: "text-green-500",
    },
    {
      text: "Ad spend exceeded the budget by ₹2,000. Please review.",
      color: "text-red-500",
    },
    {
      text: "Great news! Your recent campaign increased sales by 50%. Keep optimizing!",
      color: "text-green-500",
    },
  ];

  // Initialize with a random message from the list
  const [currentMessage, setCurrentMessage] = useState(
    messages[Math.floor(Math.random() * messages.length)]
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setCurrentMessage(randomMessage);
    }, 6000); // Set interval to 10 minutes (600,000 ms)

    return () => clearInterval(intervalId); // Cleanup interval when the component unmounts
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-4 text-white z-10 top-0 left-0 right-0">
      <div className="flex items-center justify-center space-x-4">
        <div className={`animate-marqueee whitespace-nowrap ${currentMessage.color} text-xl font-bold`}>
          {currentMessage.text}
        </div>
      </div>
    </div>
  );
};

export default RedMissage;
