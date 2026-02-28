import React from 'react';
import { AiOutlineCheckCircle } from 'react-icons/ai';
import {Link} from 'react-router-dom';

const Footer = () => {
  return (
    <footer id='FOOTER' className=" text-white py-10 px-2 md:px-12">
      <div className="container mx-auto px-4">
        {/* Top Section */}
        <div className="flex flex-col md:flex-row justify-around items-start">
          {/* Logo and Brand */}
          <div className="mb-8 md:mb-0">
            {/* Replace src with your logo image URL or <svg> */}
            <div className="flex items-center space-x-2">
              <img
                src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png"
                alt="Profit First Logo"
                className=" object-cover"
                style={{height: '100px' }}
              />
            </div>
            {/* Optional tagline or short description */}
            {/* <p className="text-gray-400 mt-2">
              Your tagline goes here
            </p> */}
          </div>

          {/* Footer Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-sm">
            {/* Product Column */}
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#PRICING" className="hover:text-white transition">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#FAQ" className="hover:text-white transition">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#Integrated" className="hover:text-white transition">
                    Integrated
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#ABOUT" className="hover:text-white transition">
                    About
                  </a>
                </li>
                <li>
                  <a href="#BLOG" className="hover:text-white transition">
                    Blog
                  </a>
                </li>
                
               
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#help" className="hover:text-white transition">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#CONTACT" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
                <li>
                  <Link to="/privacy-policy" className="hover:text-white transition">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:profitfirstoffice@gmail.com
"
                    className="hover:text-white transition"
                  >
                    profitfirstoffice@gmail.com

                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 mt-8 pt-4">
          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Copyright */}
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2025 Profit First. All rights reserved.
            </p>

            {/* Status & CTA */}
            <div className="flex items-center space-x-4">
              {/* Status indicator */}
              <div className="flex items-center space-x-1 text-gray-400">
                <AiOutlineCheckCircle className="text-green-500" />
              </div>

              {/* CTA Button */}
              {/* <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
                Get Started
              </button> */}
              <Link to="/Contact" className="btn-professional">
                <span>Get Started</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
