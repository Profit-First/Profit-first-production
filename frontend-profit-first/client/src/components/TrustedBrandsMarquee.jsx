import React from "react";


const TrustedBrandsMarquee = () => {
  const logos = ["https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330109/logo2_yui1eo.png", "https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330109/logo3_clntko.png", "https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330111/logo4_nmioro.svg", "https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330114/logo5_tnhbht.png", "https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330115/logo6_oqbgtr.png"];
  const loopLogos = [...logos, ...logos];

  return (
    <div className="py-10 px-2 overflow-hidden relative bg-transparent">
      <h2 className="text-white text-center text-2xl sm:text-3xl md:text-4xl font-bold mb-6 px-4 leading-snug">
        Trusted by{" "}
        <span className="my-gradient-text font-bold">100+ D2C brands</span>
      </h2>

      <div className="w-full overflow-hidden">
        <div className="marquee flex items-center whitespace-nowrap">
          {loopLogos.map((logo, index) => (
            <img
              key={index}
              src={logo}
              alt={`Brand ${index + 1}`}
              className="h-10 sm:h-12 w-20 sm:w-24 mx-4 sm:mx-8 object-contain grayscale hover:grayscale-0 transition duration-300"
            />
          ))}
        </div>
      </div>

      {/* Custom keyframes and animation */}
      <style jsx="true">{`
        .marquee {
          animation: scrollMarquee 30s linear infinite;
        }

        @keyframes scrollMarquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @media (max-width: 768px) {
          .marquee {
            animation-duration: 15s;
          }
        }
      `}</style>
    </div>
  );
};

export default TrustedBrandsMarquee;
