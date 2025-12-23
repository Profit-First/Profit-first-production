import React from "react";
import chatbotImage from "../assets/CHATBOT AI.jpg";
import aiGrowthImage from "../assets/AI GROWTH.jpg";
import aiAdsImage from "../assets/AI ADS.jpg";
import aiAgentImage from "../assets/AI AGENT.jpg";

const analyticsData = [
  {
    title: "AI Chatbot",
    description:
      "Get instant answers to your business questions with our AI-powered chatbot. Ask about revenue trends, profit margins, or marketing performance and receive data-driven insights in seconds. No more digging through dashboards or complex reports.",
    icon: chatbotImage,
  },
  {
    title: "AI Growth",
    description:
      "Unlock predictive insights powered by AI to forecast revenue, identify growth opportunities, and optimize your business strategy. Make data-driven decisions with confidence and stay ahead of market trends.",
    icon: aiGrowthImage,
  },
  {
    title: "AI Ads",
    description:
      "Optimize your advertising campaigns with AI-powered insights. Analyze ad performance, identify winning creatives, and maximize ROI across all your marketing channels. Get real-time recommendations to improve your ad spend efficiency.",
    icon: aiAdsImage,
  },
  {
    title: "AI Agent",
    description:
      "Automate customer interactions with intelligent AI calling agents. Confirm orders instantly and recover abandoned carts through personalized voice calls. Reduce manual workload while improving conversion rates and customer satisfaction with 24/7 automated calling.",
    icon: aiAgentImage,
  },
];

const ProfitAnalyticsSection = () => {
  return (
    <>
      <div className="max-w-6xl mx-auto text-center text-white px-4 py-12" id="USECASES">
        <h2 className="text-2xl sm:text-4xl font-bold mb-4 leading-snug">
          Say goodbye to logging into multiple platforms <br className="hidden sm:block" />
          <span className="my-gradient-text font-bold">every time</span>
        </h2>
        <p className="text-white mb-10 max-w-2xl mx-auto text-base sm:text-lg">
          D2C brand owners used to check multiple platforms for insights but not anymore.
        </p>
      </div>

      <section className="text-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          {analyticsData.map((item, index) => (
            <div key={index} className="grid lg:grid-cols-2 gap-10 items-center">
              {/* Text Content */}
              <div className={`${index % 2 !== 0 ? "lg:order-2" : ""}`}>
                {/* <span className="text-[#13ef96] text-sm uppercase tracking-wide">
                  {item.title}
                </span> */}
                <h3 className="text-2xl sm:text-3xl font-bold mb-2 my-gradient-text">{item.title}</h3>
                <p className="text-gray-400 text-base">{item.description}</p>
              </div>

              {/* Image */}
              <div className={`${index % 2 !== 0 ? "lg:order-1" : ""} flex justify-center`}>
                <img
                  src={item.icon}
                  alt={item.title}
                  className="w-full max-w-md rounded-xl shadow-md object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default ProfitAnalyticsSection;
