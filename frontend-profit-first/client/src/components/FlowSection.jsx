import React from "react";

const FlowSection = () => {
  return (
    <section className="py-10 px-4 text-center bg-transparent">
      {/* Heading */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-6 leading-snug px-2 sm:px-4">
        Getting the Good <span className="my-gradient-text font-bold">ROAS</span> but still don’t know
        <br className="hidden sm:block" />
        where your profit is <span className="my-gradient-text font-bold">going?</span>
      </h2>

      {/* Subtext */}
      <p className="text-white mb-10 max-w-xl mx-auto text-sm sm:text-base">
        Profit First helps you figure out everything in your E-com business—from marketing to actual profit.
      </p>

      {/* Video Section */}
      <div className="w-full m-0 flex justify-center items-center px-0">
        <video
          className="w-full max-w-[380px] sm:max-w-[500px] md:max-w-3xl rounded-md shadow-lg"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="https://res.cloudinary.com/dqdvr35aj/video/upload/v1748329909/giff_zd2ggm.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </section>
  );
};

export default FlowSection;
