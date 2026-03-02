import React from "react";

const Intigration = () => {
  return (
    <section className="py-10 px-4 text-center bg-transparent">
      {/* Heading */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-6 leading-snug px-2 sm:px-4">
        Works with Shopify, Meta, Google{" "}
        <span className="my-gradient-text font-bold">& more.</span>
      </h2>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-6 leading-snug px-2 sm:px-4">
        No tech{" "}
        <span className="my-gradient-text font-bold">headaches.</span>
      </h2>

      {/* Subtext */}
      <p className="text-white mb-10 max-w-xl mx-auto text-sm sm:text-base">
        One hub to oversee all your platform connections.{" "}
      </p>

      {/* Video Section */}
      <div className="w-full m-0 p-0 flex justify-center items-center">
        <video
          className="w-full max-w-[400px] sm:max-w-[600px] md:max-w-3xl rounded-md shadow-md"
          autoPlay
          loop
          muted
          playsInline
        >
          <source
            src="https://res.cloudinary.com/dqdvr35aj/video/upload/v1748328864/vvz0zmub27dp9q3pl1td.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </video>
      </div>
    </section>
  );
};

export default Intigration;
