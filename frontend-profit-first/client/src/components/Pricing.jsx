import React from 'react';
import "../App.css";
import { Link } from 'react-router-dom';

const Pricing = () => {
  return (
    <section id="PRICING" className="text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold my-gradient-text mb-4 leading-snug">
          Our Pricing
        </h2>
        <p className="text-base sm:text-lg text-gray-300">
          We offer one price for all D2C brands whether you’ve just started or you're processing thousands of orders daily.
        </p>
      </div>

      <div className="max-w-md mx-auto bg-[#141414] text-white rounded-2xl shadow-lg p-6 sm:p-8 custom-glow">
        <div className="text-center">
          <h3 className="text-xl sm:text-2xl font-semibold mb-2">Monthly Plan</h3>
          <p className="text-3xl sm:text-4xl font-bold">
            ₹5,999 <span className="text-base sm:text-lg text-[#13ef96] font-normal">/month</span>
          </p>
        </div>

        <ul className="mt-6 space-y-3 text-sm sm:text-base">
          {[
            "Integration with Meta, Shopify & Shiprocket",
            "Overall Dashboard",
            "Cohort Analysis",
            "Marketing Dashboard",
            "Shipping Dashboard",
          ].map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <Link to="/Contact">
          <button
            className="mt-8 w-full py-3 text-black rounded-lg font-semibold hover:opacity-90" style={{backgroundColor:'#13ef96', color: 'black'}}
          >
            Start your free trial
          </button>
        </Link>
      </div>
    </section>
  );
};

export default Pricing;
