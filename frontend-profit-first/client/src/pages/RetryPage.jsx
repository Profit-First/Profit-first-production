import React from "react";
import { useNavigate } from "react-router-dom";

const RetryPage = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token"); // Clear auth token
    navigate("/login"); // Redirect to login page
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="mb-6 text-gray-300">Please logout and login again to continue.</p>
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
      >
        Logout
      </button>
    </div>
  );
};

export default RetryPage;
