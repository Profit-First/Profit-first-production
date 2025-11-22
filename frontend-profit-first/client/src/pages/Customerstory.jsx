import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const Customerstory = () => {
  const navigate = useNavigate();

  const stories = [
    {
      id: 1,
      category: "Customer Story",
      title: "“Finally, I Feel in Control of My Numbers”",
      author: "Anurag Dutta, Founder — Gonoid",
      date: "June 2, 2025",
      image:
        "https://res.cloudinary.com/dqdvr35aj/image/upload/v1755777282/Success_Stories_3_qjlgls.jpg",
      content: `
      <p><em>"I’m Anurag Dutta, founder of Gonoid. We make oversized graphic tees — bold designs, relaxed fits, the kind of clothes you can live in. We’ve been growing steadily on Shopify, spending around ₹13,676 a month on Meta Ads. On paper, sales looked good — we were averaging ₹36,055 in monthly revenue — but the truth is, I never knew our actual net profit after ads, shipping, and RTO. Every week felt like guesswork."</em></p><br/>

      <h3>💡 An Eye-Opening Week</h3>
      <p>When we onboarded Profitfirst Analytics, the first week alone was eye-opening. The dashboard showed me everything in real time:</p>
      <ul>
        <li><strong>Total Ad Spend:</strong> ₹13,676</li>
        <li><strong>Gross Revenue:</strong> ₹36,055</li>
        <li><strong>RTO Loss:</strong> 4 orders (~13.8%)</li>
        <li><strong>Shipping & Packaging Cost:</strong> ₹2,928</li>
        <li><strong>Net Profit:</strong> ₹7,745 after all deductions</li>
      </ul>
      <p><em>"Before this, I never had this clarity without juggling 3–4 platforms and a spreadsheet."</em></p><br/>

      <h3>🤖 AI-Powered Recommendations</h3>
      <p>Midway through the month, the AI Assistant flagged that our ‘NOISEKISS – Lips Tee’ cold audience campaign had a ROAS of 1.53x in Ads Manager — but after factoring in a 13.8% RTO and higher-than-average shipping cost, the real ROI was much lower. It suggested moving budget from that campaign into our best-performing retargeting ad set.</p><br/>
      
      <h3>📈 The Shift and The Results</h3>
      <p>We made the shift. In the following two weeks:</p>
      <ul>
        <li>Revenue increased from ₹21,800 to ₹36,055 <strong>(+65%)</strong></li>
        <li>Net Profit jumped from ₹4,400 to ₹7,745 <strong>(+76%)</strong></li>
        <li>Overall RTO dropped from ~17% to 13.8%</li>
        <li>CPP improved from ₹520+ to ₹472</li>
        <li>Ad Spend decreased by ~₹11,000 while maintaining sales volume</li>
      </ul><br/>

      <h3>☕ A New Morning Ritual</h3>
      <p><em>"The WhatsApp daily reports are my new morning ritual — ‘Yesterday: ₹3,600 revenue, ₹1,360 ad spend, ₹775 net profit’ — all before my coffee. And the predictive revenue modelling has changed how I order stock. For me, Profitfirst isn’t just about tracking — it’s about making decisions with confidence. And for a growing brand like Gonoid, that’s priceless."</em></p>
    `,
    },
    {
      id: 2,
      category: "Client Success Story",
      title:
        "Panémorfos Jewelry Achieves 34% Increase in Net Profit with Profit First",
      author: "Founder, Panémorfos Jewelry",
      date: "June 9, 2025",
      image:
        "https://res.cloudinary.com/dqdvr35aj/image/upload/v1755777282/Success_Stories_2_grscxu.jpg",
      content: `
      <p><em>"Before implementing Profit First, our finances were a constant source of stress. We had a beautiful product line and a growing customer base, but our profitability was inconsistent, and we lacked clear financial visibility."</em></p><br/>
      
      <h3>The Challenge: Financial Uncertainty</h3>
      <p>Panémorfos, a luxury jewelry brand, faced significant challenges despite growing demand. The brand struggled with:</p>
      <ul>
        <li>Difficulty in accurately tracking and understanding its true profitability.</li>
        <li>Inefficient marketing spend due to overspending without clear return metrics.</li>
        <li>Inconsistent cash flow, making it tough to cover expenses or reinvest in growth.</li>
      </ul>
      <p><em>"We were spending heavily on marketing, but without a clear understanding of our finances, it felt like we were operating in the dark,"</em> the founder recalls.</p><br/>

      <h3>The Solution: A Data-Driven Approach</h3>
      <p>Panémorfos adopted Profit First’s Analytics Software, which provided:</p>
      <ul>
        <li>A centralized, real-time dashboard for Shopify, Meta Ads, and Shiprocket.</li>
        <li>Advanced financial analytics and clear visual reports to spot inefficiencies.</li>
        <li>An AI-powered strategy assistant with actionable growth suggestions.</li>
        <li>Daily performance summaries delivered straight to WhatsApp.</li>
        <li>AI-powered predictive modeling to forecast revenue and profits.</li>
      </ul>
      <p><em>"The software gave us clarity, precision, and automation—it’s truly been a game-changer,"</em> says the founder.</p><br/>

      <h3>The Results: A 34% Increase in Net Profit</h3>
      <p>Within a short period, Panémorfos experienced significant improvements:</p>
      <ul>
        <li>Net profit margin jumped from 7% to 12%, a <strong>34% increase</strong>.</li>
        <li>Expense control became more strategic and effective.</li>
        <li>Improved cash flow management allowed for timely reinvestment in the business.</li>
      </ul>
      <p><em>"The clarity and control we've gained over our finances have been transformative. We're now able to make informed decisions that drive profitability,"</em> the founder notes.</p>
    `,
    },
    {
      id: 3,
      category: "Client Success Story",
      title:
        "Silly Cartel Achieves 31% Increase in Net Profit with Profit First",
      author: "Founder, Silly Cartel",
      date: "June 16, 2025",
      image:
        "https://res.cloudinary.com/dqdvr35aj/image/upload/v1755777282/Success_Stories_1_xg1ff3.jpg",
      content: `
      <p><em>"I used to check sales and orders daily but had no clear view of profit, spending, or margins. It was frustrating not knowing where we stood."</em></p><br/>

      <h3>The Challenge: Growth Without Clarity</h3>
      <p>Silly Cartel, a premium streetwear brand, was growing but lacked clear insights into performance. This led to:</p>
      <ul>
        <li>An inability to clearly track and understand real profits.</li>
        <li>Overspending on advertising, resulting in inefficient use of their budget.</li>
        <li>Persistent obstacles in managing expenses and reinvesting for sustainable growth.</li>
      </ul>
      <p><em>"Sales were growing, but I couldn’t tell if we were truly making money,"</em> the founder recalls.</p><br/>

      <h3>The Solution: An All-in-One Dashboard</h3>
      <p>Silly Cartel implemented Profit First to gain a clearer understanding of their spending and profitability. Key steps included:</p>
      <ul>
        <li>Connecting Shopify, Meta Ads, and Shiprocket into a single, real-time dashboard.</li>
        <li>Using visual financial reports to easily track revenue, spending, and profitability.</li>
        <li>Leveraging an AI strategy assistant for actionable growth suggestions based on live performance.</li>
        <li>Utilizing predictive modeling to forecast revenue and profit to plan ahead with confidence.</li>
      </ul>
      <p><em>“Profit First was easy to use and made things clear from day one. The team was super helpful and always there when we needed support,”</em> says the founder.</p><br/>

      <h3>The Result: Smarter, Profitable Decisions</h3>
      <p>With Profit First, Silly Cartel finally had full visibility into their numbers. As a result:</p>
      <ul>
        <li>Their net profit margin grew from 8% to 13%—a <strong>31% increase</strong>.</li>
        <li>With extra cash on hand, they could try out new products and campaigns without stressing over cash shortages.</li>
      </ul>
      <p><em>“Before Profit First, we were mostly guessing. Now, we actually understand our numbers and make decisions that feel right. It’s made a big difference,"</em> the founder notes.</p>
    `,
    },
  ];

  const [selectedStory, setSelectedStory] = useState(null);

  return (
    <>
      <section
        id="CUSTOMERSTORIES"
        className="py-32 px-12 md:px-12 text-white overflow-x-hidden bg-[#101218]"
      >
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-6 left-6 text-gray-300 bg-transparent border-none text-lg font-semibold hover:text-white"
          >
            &#8592; Back
          </button>

          <h2 className="text-2xl sm:text-4xl font-bold text-center mb-6 leading-snug px-2">
            Customer Success Stories
          </h2>

          <p className="text-center text-white max-w-2xl mx-auto mb-10 px-2 text-sm sm:text-base">
            Read how our customers achieved profitability and growth with Profit
            First.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <div
                key={story.id}
                className="bg-[#161616] rounded-lg shadow hover:shadow-lg transition flex flex-col p-4"
              >
                <div className="relative">
                  <img
                    src={story.image}
                    alt={story.title}
                    className="w-full h-auto object-cover rounded-lg"
                  />
                  <span className="absolute bottom-2 left-2 bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded">
                    {story.category}
                  </span>
                </div>

                <div className="mt-4 flex flex-col flex-grow">
                  <h3 className="text-base sm:text-lg font-semibold mb-2 line-clamp-2">
                    {story.title}
                  </h3>
                  <div className="flex justify-between text-sm text-gray-400 mt-auto">
                    <span>By {story.author}</span>
                    <span>{story.date}</span>
                  </div>
                  <button
                    onClick={() => setSelectedStory(story)}
                    className="mt-3 text-sm text-green-500 hover:underline self-start"
                  >
                    Read More
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal */}
        {selectedStory && (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center px-4">
            <div className="bg-[#1e1e1e] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-lg relative p-6 text-white">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl font-bold"
                onClick={() => setSelectedStory(null)}
              >
                &times;
              </button>
              <div className="mt-6">
                <img
                  src={selectedStory.image}
                  alt={selectedStory.title}
                  className="w-full h-auto object-cover rounded"
                />
                <h3 className="text-sm text-green-500 mt-4">
                  {selectedStory.category}
                </h3>
                <p className="text-sm text-gray-400 mb-2">
                  By {selectedStory.author} | {selectedStory.date}
                </p>
                <h2 className="text-2xl font-bold mb-4">
                  {selectedStory.title}
                </h2>
                <div
                  className="leading-relaxed text-gray-300 prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedStory.content }}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default Customerstory;
