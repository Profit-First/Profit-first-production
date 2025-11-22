import React from "react";
import { Link } from "react-router-dom";

const Herosection = () => {
  return (
    <>
      {/* Hero Section */}
      <section
        id="HOME"
        className="relative w-full flex flex-col items-center justify-center text-white pt-32 pb-12 px-4 md:pt-64"
      >
        {/* Blurred Circles */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-50 z-0"
          style={{
            background:
              "linear-gradient(to right, rgb(29, 164, 24), rgb(206, 220, 93))",
          }}
        ></div>
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-[100px] opacity-50 z-0"
          style={{
            background:
              "linear-gradient(to left, rgb(29, 164, 24), rgb(206, 220, 93))",
          }}
        ></div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 leading-snug md:leading-tight capitalize z-10">
          Know how much you <span className="font-bold my-gradient-text">spent </span>
          <br className="hidden sm:block" />
          & how much <span className="font-bold my-gradient-text">profit</span> you'll make, all in one place!
        </h1>

        {/* Paragraph */}
        <p className="text-center text-white max-w-2xl mt-4 mb-6 text-base sm:text-lg z-10 px-2 sm:px-0">
          Find every detail that matters to grow your D2C brand—from Roas to Net Profit.
        </p>

        {/* CTA Button */}
        <div className="flex justify-center mt-6 z-10 ">
          <Link
            to="/signup"
            className="bg-[#13ef96] text-sm text-black font-medium sm:text-base px-6 py-3 rounded-md transition duration-300"
          >
            Start your free trial
          </Link> 
        </div>
      </section>

      {/* Dashboard Image Section */}
      <section
        id="DASHBOARD"
        className="relative text-white pt-6 pb-0 px-2 md:pt-12 md:pb-2 md:px-4"
      >
        <div className="w-full px-0 md:px-32">
          <img
            src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748329979/Dashboard_mh2lmg.jpg"
            alt="Dashboard Preview"
            className="w-full h-auto object-cover rounded-lg"
          />
        </div>
      </section>
    </>
  );
};

export default Herosection;
