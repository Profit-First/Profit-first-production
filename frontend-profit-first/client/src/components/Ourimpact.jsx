import React, { useEffect, useState } from 'react';

const OurImpact = () => {
  // State to handle number animation
  const [contributionProfit, setContributionProfit] = useState(0);
  const [profitOnAdSpend, setProfitOnAdSpend] = useState(0);
  const [weeklyHours, setWeeklyHours] = useState(0);
  
  // Intersection Observer to trigger animation when section is in view
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Start the number animation when section is in view
          animateNumbers();
          observer.disconnect(); // Stop observing after the animation starts
        }
      });
    }, options);
    
    const section = document.getElementById('impactSection');
    if (section) observer.observe(section);
    
    // Number animation function
    const animateNumbers = () => {
      let start = 0;
      const duration = 50; // Duration of the animation in ms
      
      const step = (timestamp) => {
        start++;
        setContributionProfit(Math.min(70, (start / duration) * 70));
        setProfitOnAdSpend(Math.min(60, (start / duration) * 60)); 
        setWeeklyHours(Math.min(12, (start / duration) * 12));
        
        if (start < duration) {
          requestAnimationFrame(step);
        }
      };
      
      requestAnimationFrame(step);
    };
  }, []);
  
  return (
    <div id="impactSection" className="py-10 px-2 overflow-hidden relative bg-transparent">
     
      <h2 className="text-white text-center text-2xl sm:text-3xl md:text-4xl font-bold mb-6 px-4 leading-snug">
        Why Choose {" "}
        <span className="my-gradient-text font-bold">ProfitFirst</span>
      </h2>
      
      <div className="flex flex-wrap justify-center gap-10 items-center">
        {/* Impact Item 1 */}
        <div className="text-center max-w-xs">
           <p className="text-5xl sm:text-4xl md:text-5xl font-bold my-gradient-text pb-2">{Math.floor(contributionProfit)}%</p>
          <p className="text-2xl sm:text-xl text-white pb-2">Users</p>
          <p className="text-xl sm:text-lg text-white">increase profits within their first 90 days.</p>
         </div>
        
        {/* Impact Item 2 */}
        <div className="text-center max-w-xs">
         <p className="text-5xl sm:text-4xl md:text-5xl font-bold my-gradient-text pb-2">{Math.floor(profitOnAdSpend)}%</p>
          <p className="text-2xl sm:text-xl text-white pb-2">Brands</p>
          <p className="text-xl sm:text-lg text-white">successfully scale within three months.</p>
       </div>
        
        {/* Impact Item 3 */}
        <div className="text-center max-w-xs">
          <p className="text-5xl sm:text-4xl md:text-5xl font-bold my-gradient-text pb-2">{Math.floor(weeklyHours)}</p>
          <p className="text-2xl sm:text-xl text-white pb-2">Hours</p>
          <p className="text-xl sm:text-lg text-white">saved every week through smarter ad management.</p>
      </div>
      </div>
      
      {/* Custom keyframes and animation */}
      <style jsx="true">{`
        .impact-item {
          opacity: 0;
          transition: opacity 1s ease-in-out;
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .impact-item.fadeIn {
          animation: fadeIn 1s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default OurImpact;
