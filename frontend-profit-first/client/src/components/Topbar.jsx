import React from 'react';
import { IoIosNotifications } from "react-icons/io";

const Topbar = () => {
  return (
    <div className="flex justify-between items-center p-4 bg-[#0d1d1e] text-white border-b border-gray-700">
      <input
        type="text"
        placeholder="Search..."
        className=" px-4 py-2 ml-12 rounded w-1/2"
      />
      <span className="bg-gray-800 p-2 rounded hover:cursor-pointer z-1"><IoIosNotifications style={{color:"#2be092",fontSize:"25px"}} /></span>
    </div>
  );
};

export default Topbar;
