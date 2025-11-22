import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(null);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);

  const solutions = [
    {
      title: "Centralized Analytics Dashboard",
      desc: "Consolidate performance metrics from all platforms into a single, real-time view.",
    },
    {
      title: "Advanced Financial Analytics",
      desc: "Monitor spend, revenue, and profitability with precision visual reporting.",
    },
    {
      title: "Seamless API Integrations",
      desc: "Effortlessly sync Meta Ads, Shopify, Shiprocket, and other platforms.",
    },
    {
      title: "AI-Powered Strategy Assistant",
      desc: "Receive actionable growth strategies based on your live business data.",
    },
    {
      title: "Automated WhatsApp Reporting",
      desc: "Get daily performance summaries delivered instantly to your WhatsApp.",
    },
    {
      title: "Predictive Revenue Modeling",
      desc: "Forecast revenue, profit, and KPIs using AI-driven trend analysis.",
    },
  ];

  const controlNavbar = () => {
    if (typeof window !== "undefined") {
      if (window.scrollY > lastScrollY) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      setLastScrollY(window.scrollY);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", controlNavbar);
      return () => window.removeEventListener("scroll", controlNavbar);
    }
  }, [lastScrollY]);

  const toggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
    setMobileSolutionsOpen(false);
  };

  const handleSolutionClick = (index) => {
    setActiveSolutionIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  return (
    <>
      <nav
        className={`${
          drawerOpen || showNavbar ? "translate-y-0" : "-translate-y-full"
        } fixed top-0 left-0 w-full flex items-center justify-between px-4 py-4 transition-transform duration-300 z-50 backdrop-blur-3xl`}
        style={{ padding: "2px 5%" }}
      >
        <div className="flex-shrink-0">
          <Link to="/">
            <img
              src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png"
              alt="Logo"
              width={150}
              className={`${drawerOpen ? "hidden md:block" : "block"}`}
            />
          </Link>
        </div>

        <ul className="hidden md:flex space-x-6 text-[#fff] gap-6 items-center">
          <li>
            <Link to="/" className="hover:text-green-500">
              Home
            </Link>
          </li>

          <li
            className="relative"
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => {
              setSolutionsOpen(false);
              setActiveSolutionIndex(null);
            }}
          >
            <button
              className="hover:text-green-500 flex items-center gap-1"
              aria-haspopup="true"
              aria-expanded={solutionsOpen}
            >
              Solutions
              <svg
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div
              role="menu"
              className={[
                "absolute left-2/2 -translate-x-1/3 top-full mt-3 rounded-2xl shadow-xl p-4 z-[60]",
                "bg-black/30 backdrop-blur-xl",
                "w-[1000px] max-w-[95vw]",
                "transition-all duration-200",
                solutionsOpen
                  ? "opacity-100 visible translate-y-0 pointer-events-auto"
                  : "opacity-0 invisible -translate-y-1 pointer-events-none",
              ].join(" ")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {solutions.map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl hover:bg-white/5 transition-colors duration-300 p-3 bg-[#2e2d2d]"
                  >
                    <button
                      role="menuitem"
                      onClick={() => handleSolutionClick(idx)}
                      className="w-full text-left focus:outline-none"
                    >
                      <div className="font-medium text-white">{s.title}</div>

                      <div
                        className={`grid transition-all duration-500 ease-in-out ${
                          activeSolutionIndex === idx
                            ? "grid-rows-[1fr] opacity-100 pt-2"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="text-sm text-gray-300">{s.desc}</div>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </li>

          <li>
            <a href="#DASHBOARD" className="hover:text-green-500">
              Resources
            </a>
          </li>
          <li>
            <a href="#USECASES" className="hover:text-green-500">
              Use Cases
            </a>
          </li>
          <li>
            <a href="#BLOG" className="hover:text-green-500">
              Blog
            </a>
          </li>
          <li>
            <Link to="/ourstorys" className="hover:text-green-500">
              Customers Stories
            </Link>
          </li>
          <li>
            <Link to="/Profitcalculater" className="hover:text-green-500">
              Profit Calculater
            </Link>
          </li>
          <li>
            <a href="#PRICING" className="hover:text-green-500">
              Pricing
            </a>
          </li>
        </ul>

        <div className="hidden md:block">
          <Link
            to="/signup"
            className="bg-green-500 text-white px-4 py-2 hover:bg-gray-900 transition rounded-lg"
          >
            Get Started
          </Link>
        </div>

        <div className="md:hidden">
          <button onClick={toggleDrawer} aria-label="Toggle Menu">
            {drawerOpen ? (
              <svg
                className="w-6 h-6 text-white absolute bottom-0 right-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <div
        className={`fixed top-0 right-0 h-full w-64 bg-[#101218] text-white shadow-lg transform transition-transform duration-300 z-40 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4">
          <div className="mb-4">
            <Link to="/" onClick={() => setDrawerOpen(false)} />
          </div>
          <ul className="flex flex-col space-y-4 text-white">
            <li>
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="hover:text-green-500"
              >
                Home
              </Link>
            </li>
            <li className="border-t border-white/10 pt-4">
              <button
                className="w-full flex items-center justify-between hover:text-green-500"
                onClick={() => setMobileSolutionsOpen((v) => !v)}
                aria-expanded={mobileSolutionsOpen}
                aria-controls="mobile-solutions"
              >
                <span>Solutions</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    mobileSolutionsOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {mobileSolutionsOpen && (
                <ul id="mobile-solutions" className="mt-3 space-y-3">
                  {solutions.map((s, idx) => (
                    <li key={idx} className="text-sm">
                      <a
                        href="#"
                        onClick={() => setDrawerOpen(false)}
                        className="block rounded-lg p-2 hover:bg-white/5"
                      >
                        <div className="font-medium text-white">{s.title}</div>
                        <div className="text-gray-300">{s.desc}</div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              <a
                href="#DASHBOARD"
                onClick={() => setDrawerOpen(false)}
                className="hover:text-green-500"
              >
                Resources
              </a>
            </li>
            <li>
              <a
                href="#USECASES"
                onClick={() => setDrawerOpen(false)}
                className="hover:text-green-500"
              >
                Use Cases
              </a>
            </li>
            <li>
              <a
                href="#BLOG"
                onClick={() => setDrawerOpen(false)}
                className="hover:text-green-500"
              >
                Blog
              </a>
            </li>
            <li>
              <Link
                to="/ourstorys"
                onClick={() => setDrawerOpen(false)}
                className="hover:text-green-500"
              >
                Customers Stories
              </Link>
            </li>
            <li>
              <Link to="/Profitcalculater" className="hover:text-green-500">
                Profit Calculater
              </Link>
            </li>

            <li>
              <a
                href="#PRICING"
                onClick={() => setDrawerOpen(false)}
                className="hover:text-green-500"
              >
                Pricing
              </a>
            </li>
            <li>
              <Link
                to="/signup"
                onClick={() => setDrawerOpen(false)}
                className="bg-green-500 text-white px-4 py-2 hover:bg-gray-900 transition rounded-lg block text-center"
              >
                Get Started
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default Navbar;
