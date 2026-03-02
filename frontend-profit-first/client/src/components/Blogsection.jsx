import React, { useState } from "react";
import { Link } from "react-router-dom";
const Blogsection = () => {
  const blogs = [
    {
      id: 1,
      category: "Insights",
      title: "How D2C Brands Can Reduce CAC Without Sacrificing Growth",
      author: "Shubham Soni",
      date: "Aug 23, 2025",
      image:
        "https://res.cloudinary.com/dqdvr35aj/image/upload/v1756882989/Blog_1_azf1px.jpg",
      content:
        "<div style='background-color: #1e1e1e;  line-height: 1.6; color: #FFFFFF; padding: 20px;'> <p style='font-size: 16px; margin-bottom: 20px;'>Customer Acquisition Cost (CAC) is one of the most critical metrics for Direct-to-Consumer (D2C) brands aiming for sustainable profitability. While many brands focus on maximizing revenue or achieving high ROAS (Return on Ad Spend), these metrics can be misleading if they ignore the true cost of acquiring a customer. In a competitive D2C landscape like India’s, optimizing CAC is no longer optional; it is essential for scalable growth.</p> <p style='font-size: 16px;'>This article explores why CAC matters, the impact of high CAC on profitability, and actionable strategies to reduce it without stalling business growth.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'><strong>Understanding Customer Acquisition Cost (CAC) for D2C Brands</strong></h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>What Is CAC and Why Does It Matter?</h3> <p style='font-size: 16px;'>Customer Acquisition Cost (CAC) measures the total expense incurred to acquire a new customer. It includes all marketing, advertising, and sales-related costs. For D2C brands, CAC directly affects profitability, cash flow, and the sustainability of growth strategies.</p> <div style='background-color: #444; color: #FFFFFF; border-left: 4px solid #60A5FA; padding: 15px; margin: 20px 0; font-family: \"Courier New\", Courier, monospace; border-radius: 4px;'> <p style='margin: 0; font-weight: bold;'>A simplified CAC formula:</p> <p style='margin: 5px 0;'>CAC = Total Spend ÷ Total Number of New Customers</p> <p style='margin: 15px 0 0 0; font-weight: bold;'>Example:</p> <p style='margin: 5px 0;'>If you spent ₹1,00,000 on marketing and got 200 new customers,<br/> CAC = ₹1,00,000 ÷ 200 = ₹500 per customer</p> </div> <p style='font-size: 16px;'>High CAC can erode margins even if revenue and ROAS appear strong, making this metric a crucial indicator of operational efficiency.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Common Mistakes D2C Brands Make With CAC</h3> <p style='font-size: 16px;'>Many brands make the mistake of tracking CAC superficially:</p> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'><strong>Focusing solely on ROAS:</strong> High ROAS does not account for fulfillment costs, returns, or operational overhead.</li> <li style='margin-bottom: 10px;'><strong>Ignoring hidden costs:</strong> Expenses like content creation, influencer campaigns, and payment processing fees are often excluded, skewing CAC calculations.</li> <li style='margin-bottom: 10px;'><strong>Uniform acquisition strategies:</strong> Treating all channels and customer segments as equally profitable can inflate CAC unnecessarily.</li> </ul> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>The Impact of High CAC on Profitability</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>How High CAC Eats Into Margins</h3> <p style='font-size: 16px;'>Consider a D2C brand running a high-performing ad campaign with a reported 6x ROAS. Despite strong revenue, when factoring in product costs, shipping, returns, and other operational expenses, net profit may only be 5–10% of revenue. High CAC contributes significantly to this profit compression, limiting scalability and increasing cash flow risk.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>CAC vs. LTV: The True Metric for Sustainable Growth</h3> <p style='font-size: 16px;'>The Lifetime Value to CAC ratio (LTV:CAC) is a more accurate measure of sustainable growth. It evaluates how much revenue a customer generates over their entire relationship with your brand relative to the acquisition cost.</p> <p style='font-size: 16px; font-weight: bold;'>Industry benchmark for D2C brands:</p> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 5px;'><strong>Healthy LTV:CAC:</strong> 3:1 or higher</li> <li style='margin-bottom: 5px;'><strong>Warning zone:</strong> 2:1–3:1</li> <li style='margin-bottom: 5px;'><strong>Critical zone:</strong> <2:1</li> </ul> <p style='font-size: 16px;'>Brands with a low LTV:CAC ratio may achieve revenue growth but will struggle to generate profit over time.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Proven Strategies to Reduce CAC</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Optimize Marketing Channels for Profit, Not Just Reach</h3> <p style='font-size: 16px;'>Not all traffic is equal. Focus on channels that consistently yield high net profit per customer, not just high revenue:</p> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'><strong>Paid advertising:</strong> Use advanced audience segmentation to target high-converting, high-LTV customers.</li> <li style='margin-bottom: 10px;'><strong>Organic marketing:</strong> SEO, email campaigns, and social media reduce dependency on paid acquisition and improve margins.</li> </ul> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Leverage Customer Retention to Lower CAC</h3> <p style='font-size: 16px;'>Acquiring repeat customers costs significantly less than acquiring new ones. Implement strategies such as:</p> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'>Loyalty programs and subscriptions</li> <li style='margin-bottom: 10px;'>Referral programs incentivizing existing customers</li> <li style='margin-bottom: 10px;'>Personalized communication through email and push notifications</li> </ul> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Personalization and Targeted Campaigns</h3> <p style='font-size: 16px;'>Segmenting your audience based on profitability rather than demographics alone ensures that marketing spend is focused on customers who contribute positively to margins. Dynamic ads, personalized email campaigns, and retargeting high-value users can drastically reduce CAC.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Optimize Your Funnel for Conversions</h3> <p style='font-size: 16px;'>Conversion rate optimization (CRO) improves efficiency across every stage of the customer journey, reducing the effective CAC:</p> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'>Streamline website UX and checkout processes</li> <li style='margin-bottom: 10px;'>Implement A/B testing to maximize conversion efficiency</li> <li style='margin-bottom: 10px;'>Reduce cart abandonment with retargeting and automated notifications</li> </ul> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Tools and Analytics to Track CAC Effectively</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Profit-First Analytics Systems</h3> <p style='font-size: 16px;'>Advanced analytics systems like Profit First Analytics provide real-time visibility into CAC by factoring in all associated costs, from marketing spend to logistics and refunds. These platforms allow brands to calculate True CAC and measure campaign profitability beyond simple ROAS metrics.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Other Tools for CAC Monitoring</h3> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'><strong>Google Analytics 4:</strong> Enhanced e-commerce tracking for ad attribution</li> <li style='margin-bottom: 10px;'><strong>Triple Whale / Northbeam:</strong> Multi-channel CAC and LTV insights</li> <li style='margin-bottom: 10px;'><strong>Zapier / Make.com:</strong> Automation for cost allocation and reporting</li> </ul> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Case Study: How a D2C Brand Reduced CAC by 30%</h2> <p style='font-size: 16px;'>A premium skincare D2C brand reported a 6x ROAS but was achieving only an 8% net profit margin. By implementing a profit-first CAC strategy, the brand:</p> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'>Focused on high-LTV customer segments</li> <li style='margin-bottom: 10px;'>Reduced underperforming ad spend</li> <li style='margin-bottom: 10px;'>Increased repeat purchase campaigns and referrals</li> <li style='margin-bottom: 10px;'>Optimized website funnel for conversions</li> </ul> <p style='font-size: 16px;'><strong>Result:</strong> CAC decreased by 30%, net profit increased by 180%, and the LTV:CAC ratio improved from 1.2:1 to 3.2:1—transforming revenue growth into sustainable profitability.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Key Takeaways</h2> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'>High ROAS does not guarantee profitability—measure CAC accurately.</li> <li style='margin-bottom: 10px;'>Focus on profitable customer acquisition and retention strategies.</li> <li style='margin-bottom: 10px;'>Segment audiences by LTV and profitability, not just demographics.</li> <li style='margin-bottom: 10px;'>Use advanced analytics tools for real-time CAC tracking and optimization.</li> <li style='margin-bottom: 10px;'>Continuous funnel optimization reduces wasteful spending and increases efficiency.</li> </ul> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Conclusion</h2> <p style='font-size: 16px;'>Reducing CAC is critical for sustainable growth in the D2C landscape. By focusing on profit-driven marketing, leveraging customer retention, and implementing a profit-first analytics system, brands can lower acquisition costs without sacrificing growth. True profitability comes from understanding the complete cost of customer acquisition and aligning marketing strategies to maximize LTV:CAC ratios.</p> <p style='font-size: 16px; font-weight: bold; margin-top: 20px;'>For D2C founders, the era of chasing revenue alone is over; the era of profit-first customer acquisition is here.</p></div>",
    },

    {
      id: 2,
      category: "Insights",
      meta: "E-Commerce",
      title:
        "The 2025 D2C Playbook: What Small Brands Can Learn from Big Players",
      author: "Shubham Soni",
      date: "Aug 26, 2025",
      image:
        "https://res.cloudinary.com/dqdvr35aj/image/upload/v1756882991/Blog_2_aaxnpz.jpg",
      content:
        "<div style='background-color: #1e1e1e;  line-height: 1.6; color: #FFFFFF; padding: 20px;'> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 10px; margin-bottom: 20px;'>Introduction—Why D2C is Evolving in 2025</h2> <p style='font-size: 16px; margin-bottom: 20px;'>The direct-to-consumer (D2C) model has matured from a disruptive trend into a dominant retail channel. In 2025, consumers expect brands to deliver not only high-quality products but also personalized, frictionless experiences across multiple touchpoints. Large D2C players have set a new benchmark for speed, convenience, and brand storytelling.</p> <p style='font-size: 16px;'>For small and emerging brands, the challenge is clear: how to compete without enterprise-level budgets while still matching customer expectations. The key lies in borrowing proven strategies from the leaders and adapting them with agility.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Lessons From the Biggest D2C Success Stories</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Building a Strong Brand Identity and Story</h3> <p style='font-size: 16px;'>Major D2C brands like boAt and The Souled Store grew by turning their brand narrative into a competitive advantage. Instead of just selling products, they communicate values, sustainability efforts, and lifestyle aspirations. Small brands can replicate this by clarifying their value proposition and ensuring consistent messaging across product pages, ads, packaging, and customer support.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Investing in Customer-First Experiences</h3> <p style='font-size: 16px;'>Top-performing brands use CX as a growth engine, from intuitive website navigation to proactive support. Implementing AI-powered chatbots, post-purchase surveys, and fast delivery options helps small businesses punch above their weight in customer satisfaction.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Omnichannel Presence: Blending Online and Offline</h3> <p style='font-size: 16px;'>Large D2C brands are moving beyond digital-only strategies, with pop-up stores and retail partnerships enhancing trust. Smaller players can test local pop-ups, retail collaborations, or wholesale pilots to build community visibility.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Marketing Strategies Big Brands Use (and How Small Brands Can Copy Them)</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Paid Ads vs. Organic Growth—Finding the Right Balance</h3> <p style='font-size: 16px;'>Big players scale fast with paid channels, but they also diversify into SEO, content marketing, and email automation. Small brands should avoid over-reliance on paid ads and instead focus on evergreen SEO content, retention-focused email flows, and community-driven growth.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Leveraging Influencers and User-Generated Content (UGC)</h3> <p style='font-size: 16px;'>Influencer partnerships now extend beyond mega-celebrities. Micro-influencers and UGC campaigns deliver higher ROI per dollar for smaller brands. A structured approach, gifted collaborations, ambassador programs, and UGC incentives can replicate enterprise-level reach affordably.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Personalization Through Data and AI Tools</h2> <p style='font-size: 16px;'>Brands like Stitch Fix and Nike leverage data to customize product recommendations and user journeys. Small brands can deploy affordable AI-driven email personalization, product recommendation engines, and A/B testing platforms to mimic these tactics at scale.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Operations & Logistics Lessons for Small D2C Brands</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Optimizing Supply Chain and Fulfillment</h3> <p style='font-size: 16px;'>Amazon has conditioned consumers to expect fast, reliable shipping. Smaller D2C brands should explore 3PL (third-party logistics) partners and integrate fulfillment APIs to reduce costs and improve speed.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Packaging as a Marketing Channel</h3> <p style='font-size: 16px;'>Leaders treat packaging as an extension of their brand. A thoughtfully designed unboxing experience creates shareable moments that drive organic social reach. Even minimal-budget brands can experiment with eco-friendly packaging and custom inserts to stand out.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Scaling Customer Service Without Huge Costs</h3> <p style='font-size: 16px;'>Chat automation, centralized help desks, and AI-driven FAQs allow small brands to scale support without bloating headcount. The focus should be on speed, transparency, and personalization.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Financial Playbook for D2C Growth in 2025</h2> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Understanding CAC and LTV</h3> <p style='font-size: 16px;'>Large D2C brands rigorously track customer acquisition cost (CAC) and lifetime value (LTV). Small brands must implement the same financial discipline by measuring acquisition channels, retention cohorts, and payback periods.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>Cutting Costs Without Hurting Customer Experience</h3> <p style='font-size: 16px;'>Brands can negotiate with suppliers, adopt dropshipping hybrids, or use just-in-time inventory models to minimize cash burn while maintaining customer satisfaction.</p> <h3 style='font-size: 18px; font-weight: bold; color: #FFFFFF; margin-top: 25px; margin-bottom: 10px;'>When (and How) to Raise Funding for Your Brand</h3> <p style='font-size: 16px;'>Big brands often accelerate growth through venture capital, but not all D2C businesses need outside funding. Smaller players should evaluate bootstrapped growth vs. VC-backed scale and align financing strategies with long-term goals.</p> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Actionable Steps for Small D2C Brands in 2025</h2> <ul style='list-style-type: disc; margin-left: 20px; padding-left: 10px; font-size: 16px;'> <li style='margin-bottom: 10px;'>Focus on Brand + Community, Not Just Sales</li> <li style='margin-bottom: 10px;'>Adopt Tools and Tech That Improve Efficiency</li> <li style='margin-bottom: 10px;'>Start Small, Scale Smart—The Lean Playbook</li> </ul> <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Conclusion—The Future of D2C Belongs to the Nimble</h2> <p style='font-size: 16px; margin-bottom: 20px;'>The D2C landscape in 2025 is both challenging and full of opportunity. Big brands have raised customer expectations, but small brands can compete through agility, smart tech adoption, and customer intimacy.</p> <p style='font-size: 16px;'>By learning from the playbooks of industry leaders—and executing with focus—emerging D2C businesses can build profitable, scalable, and resilient e-commerce operations.</p></div>",
    },
    {
      id: 3,
      category: "Insights",
      title:
        "The Psychology of Repeat Purchases: How to Turn First-Time Buyers into Loyal Customers",
      author: "Shubham Soni",
      date: "Sep 10, 2025",
      image:
        "https://res.cloudinary.com/dqdvr35aj/image/upload/v1758262490/6_2_slxidl.jpg",
      content: `
<div style='background-color: #1e1e1e; line-height: 1.6; color: #FFFFFF; padding: 20px;'>
  <p style='font-size: 16px; margin-bottom: 20px;'>For direct-to-consumer (D2C) brands, growth isn’t just about acquiring new buyers—it’s about converting one-time shoppers into repeat customers. Acquiring a new customer can cost 5–7 times more than retaining an existing one. Beyond cost efficiency, repeat customers deliver higher lifetime value (LTV), drive predictable revenue, and often become brand advocates.</p>
  <p style='font-size: 16px;'>The key to achieving this retention lies in consumer psychology. Understanding why customers return—and what makes them loyal—enables brands to design intentional experiences that build sustainable growth.</p>

  <h2 style='font-size: 22px; color: #FFFFFF; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'><strong>Understanding Consumer Psychology in Ecommerce</strong></h2>

  <h3 style='font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 10px;'>Trust and Familiarity in Purchase Decisions</h3>
  <p style='font-size: 16px;'>Customers are risk-averse. Once they’ve had a positive first experience—fast delivery, accurate product quality, responsive support—they develop trust and familiarity. These reduce perceived risk in subsequent purchases.</p>

  <h3 style='font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 10px;'>The Role of Emotion in Brand Loyalty</h3>
  <p style='font-size: 16px;'>Loyalty is rarely transactional. Emotional triggers such as belonging, status, or alignment with brand values (e.g., sustainability, inclusivity) can deeply influence repeat buying. Brands like Patagonia and Allbirds retain customers not only with quality but with shared values.</p>

  <h3 style='font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 10px;'>How Social Proof and Reviews Influence Repeat Buying</h3>
  <p style='font-size: 16px;'>Positive reviews, testimonials, and user-generated content (UGC) act as psychological reinforcement for a buyer’s decision. Seeing other satisfied customers validates their choice and strengthens their intent to reorder.</p>

  <h2 style='font-size: 22px; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Strategies to Encourage Second and Third Purchases</h2>
  <ul style='list-style-type: disc; margin-left: 20px; font-size: 16px;'>
    <li style='margin-bottom: 10px;'><strong>Personalized Recommendations:</strong> Automated email flows (“complete the set” offers, post-purchase nudges) can drive repeat buying.</li>
    <li style='margin-bottom: 10px;'><strong>Loyalty Programs:</strong> Reward systems build habitual behavior through points, tiered benefits, or exclusive access.</li>
    <li style='margin-bottom: 10px;'><strong>Retargeting Ads:</strong> Remind customers of their first positive experience with limited-time offers or related product bundles.</li>
  </ul>

  <h2 style='font-size: 22px; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Building Long-Term Retention Systems</h2>
  <ul style='list-style-type: disc; margin-left: 20px; font-size: 16px;'>
    <li style='margin-bottom: 10px;'><strong>Subscriptions:</strong> Align with customer convenience and reduce churn.</li>
    <li style='margin-bottom: 10px;'><strong>Community Engagement:</strong> Forums, ambassador programs, or groups strengthen brand identity.</li>
    <li style='margin-bottom: 10px;'><strong>Post-Purchase Delight:</strong> Easy returns, clear communication, thank-you notes, and surprise samples reduce churn.</li>
  </ul>

  <div style='background-color: #444; color: #FFFFFF; border-left: 4px solid #34D399; padding: 15px; margin: 20px 0; border-radius: 4px;'>
    <p style='margin: 0; font-weight: bold;'>Key Data Points:</p>
    <p style='margin: 5px 0;'>• Retaining a customer is 5–7x cheaper than acquiring a new one.</p>
    <p style='margin: 5px 0;'>• Loyal customers are worth 10x their initial purchase value (Adobe).</p>
    <p style='margin: 5px 0;'>• Brands that prioritize retention see repeat purchase rates of 25%–40% (Shopify).</p>
  </div>

  <h2 style='font-size: 22px; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Case Studies: Indian D2C Brands Driving Loyalty</h2>
  <ul style='list-style-type: disc; margin-left: 20px; font-size: 16px;'>
    <li style='margin-bottom: 10px;'><strong>Chumbak:</strong> Personalized emails and vibrant community engagement led to 25% of revenue from repeat buyers, increasing AOV by 30%.</li>
    <li style='margin-bottom: 10px;'><strong>Mamaearth:</strong> Subscriptions and feedback loops boosted retention with 60% repeat buyers and 20% higher LTV.</li>
    <li style='margin-bottom: 10px;'><strong>Zivame:</strong> Personalization and a rewards program increased repeat purchase rate to 35%, improving profitability.</li>
  </ul>

  <h2 style='font-size: 22px; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Key Takeaways</h2>
  <ul style='list-style-type: disc; margin-left: 20px; font-size: 16px;'>
    <li style='margin-bottom: 10px;'>Repeat purchases lower CAC and increase profitability.</li>
    <li style='margin-bottom: 10px;'>Emotional and psychological triggers drive true loyalty.</li>
    <li style='margin-bottom: 10px;'>Indian D2C leaders prove retention strategies scale revenue effectively.</li>
  </ul>

  <h2 style='font-size: 22px; border-bottom: 2px solid #555; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px;'>Conclusion</h2>
  <p style='font-size: 16px;'>In 2025, D2C success is no longer about transactions—it’s about relationships. By focusing on trust, emotional connection, personalization, and community, brands can turn first-time buyers into long-term advocates who drive compounding growth.</p>
</div>
`,
    },
  ];

  const [selectedBlog, setSelectedBlog] = useState(null);

  return (
    <section
      id="BLOG"
      className="py-12 px-4 md:px-12 text-white overflow-x-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl sm:text-4xl font-bold text-center mb-6 leading-snug px-2">
          Stay Connected on our{" "}
          <span className="my-gradient-text font-bold">Newsletter</span>
        </h2>

        <p className="text-center text-white max-w-2xl mx-auto mb-10 px-2 text-sm sm:text-base">
          You’ll get to know how Profit First can help scale your D2C brand and
          how others manage their KPIs.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => (
            <div
              key={blog.id}
              className="bg-[#161616] rounded-lg shadow hover:shadow-lg transition flex flex-col p-4"
            >
              <div className="relative">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="w-full h-auto object-cover rounded-lg"
                />
                <span className="absolute bottom-2 left-2 bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  {blog.category}
                </span>
              </div>

              <div className="mt-4 flex flex-col flex-grow">
                <h3 className="text-base sm:text-lg font-semibold mb-2 line-clamp-2">
                  {blog.title}
                </h3>
                <div className="flex justify-between text-sm text-gray-400 mt-auto">
                  <span>By {blog.author}</span>
                  <span>{blog.date}</span>
                </div>
                <button
                  onClick={() => setSelectedBlog(blog)}
                  className="mt-3 text-sm text-green-500 hover:underline self-start"
                >
                  Read More
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* view all Blogs Button  */}

        <div className="flex justify-center mt-6 z-10 ">
          <Link
            to="/blogs"
            className="bg-[#13ef96] text-sm text-black font-medium sm:text-base px-6 py-3 rounded-md transition duration-300"
          >
            Read More
          </Link> 
        </div>
      </div>

      {/* Modal */}
      {selectedBlog && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center px-4">
          <div className="bg-[#1e1e1e] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-lg relative p-6 text-white">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl font-bold"
              onClick={() => setSelectedBlog(null)}
            >
              &times;
            </button>
            <div className="mt-6">
              <img
                src={selectedBlog.image}
                alt={selectedBlog.title}
                className="w-full h-auto object-cover rounded"
              />
              <h3 className="text-sm text-green-500 mt-4">
                {selectedBlog.category}
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                By {selectedBlog.author} | {selectedBlog.date}
              </p>
              <h2 className="text-2xl font-bold mb-4">{selectedBlog.title}</h2>
              <div
                className="leading-relaxed text-gray-300 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedBlog.content }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Blogsection;
