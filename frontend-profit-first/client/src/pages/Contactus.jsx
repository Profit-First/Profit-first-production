import React, { useState } from "react";
import axiosInstance from "../../axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { PulseLoader } from "react-spinners";

const Contactus = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    message: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{10}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.website) {
      toast.error("All fields are required");
      return;
    }

    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (formData.phone && !phoneRegex.test(formData.phone)) {
      toast.error("Please enter a valid phone number (e.g., 1234567890)");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axiosInstance.post("/getInTouch", formData);
      if (response.status === 200) {
        toast.success("We will connect with you soon!");
        setFormData({ name: "", email: "", phone: "", website: "", message: "" });
        setShowThankYou(true);
        setTimeout(() => {
          setShowThankYou(false);
          window.location.href = "/";
        }, 3000);
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={15} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#101218] flex flex-col">
      <ToastContainer position="top-right" autoClose={3000} />

      <button
        onClick={handleBack}
        className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full transition text-white"
      >
        X
      </button>

      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-50 z-0"
        style={{
          background: "linear-gradient(to right, rgb(29, 164, 24), rgb(206, 220, 93))",
        }}
      ></div>
      <div
        className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-[100px] opacity-50 z-0"
        style={{
          background: "linear-gradient(to left, rgb(29, 164, 24), rgb(206, 220, 93))",
        }}
      ></div>

      <div className="flex flex-1 items-center justify-center px-4 ">
        <div className="bg-gray-900 bg-opacity-30 backdrop-blur-md rounded-lg shadow-lg flex flex-col md:flex-row overflow-hidden w-11/12 md:w-3/4 lg:w-2/3">
        <div className="w-full md:w-1/2 flex items-center justify-center px-4 py-8 md:py-0 text-center text-white relative z-1 mt-12">
            <div className="max-w-xl">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-green-400">
                Demand is High!
              </h1>
              <p className="text-base sm:text-lg md:text-xl mt-4 font-medium">
                Join our D2C brand waiting list and be the <span className="text-green-400 font-semibold">first to know...</span>
              </p>
            </div>
          </div>
          <div className="w-full my-gradient-contact md:w-1/2 p-6 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-center text-white mb-4">Kindly fill the form</h2>

            <form onSubmit={handleSubmit} className="w-full">
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-3 mb-4 bg-transparent border-2 border-white-400 placeholder-white text-white rounded-lg"
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-3 mb-4 bg-transparent border-2 border-white-400 placeholder-white text-white rounded-lg"
                required
              />
              <input
                type="text"
                name="phone"
                placeholder="Your Phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-3 mb-4 bg-transparent border-2 border-white-400 placeholder-white text-white rounded-lg"
                required
              />
              <input
                type="text"
                name="website"
                placeholder="Your Website"
                value={formData.website}
                onChange={handleChange}
                className="w-full p-3 mb-4 bg-transparent border-2 border-white-400 placeholder-white text-white rounded-lg"
                required
              />
              {/* <textarea
                name="message"
                placeholder="Your Message"
                value={formData.message}
                onChange={handleChange}
                className="w-full p-3 mb-4 bg-transparent border-2 border-white-400 placeholder-white text-white rounded-lg"
                required
              ></textarea> */}
              <button
                type="submit"
                className=" w-full py-3 font-bold rounded-lg transition btn-professional"
                disabled={isLoading}
              >
                <span>{isLoading ? "Sending..." : "Done!"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {showThankYou && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-[#111217] rounded-lg p-8 text-center text-white shadow-lg w-11/12 max-w-md">
            <h3 className="text-2xl font-bold text-green-400 mb-4">Thank You!</h3>
            <p className="text-gray-300 mb-4">
            Thanks for joining our waitlist. We'll be in touch soon!
                        </p>
            <div className="w-full flex justify-center">
              <PulseLoader size={12} color="#12EB8E" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contactus;








