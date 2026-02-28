import React, { useEffect, useState } from "react";
import axiosInstance from "../../axios";
import { PulseLoader } from "react-spinners";
import { FiTrendingUp, FiTrendingDown, FiPackage, FiDollarSign } from "react-icons/fi";

const ShippingMetrics = ({ startDate, endDate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await axiosInstance.get("/shipping/metrics", { params });

      if (response.data.success) {
        setMetrics(response.data.metrics);
      } else {
        setError("Failed to load metrics");
      }
    } catch (err) {
      console.error("Error fetching shipping metrics:", err);
      setError(err.response?.data?.message || "Failed to load shipping metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <PulseLoader size={10} color="#12EB8E" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 text-xs underline hover:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const MetricCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-[#1A2F31] rounded-lg p-6 border border-[#2A4F51] hover:border-[#12EB8E]/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg bg-${color}-500/10`}>
          <Icon className={`text-${color}-400 text-xl`} />
        </div>
      </div>
      <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-white text-2xl font-bold mb-1">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Shipping Spend"
          value={`₹${metrics.shippingSpend.toLocaleString()}`}
          icon={FiDollarSign}
          color="red"
          subtitle="Total freight charges"
        />
        
        <MetricCard
          title="RTO Delivered"
          value={metrics.rtoDeliveredCount}
          icon={FiTrendingDown}
          color="orange"
          subtitle={`${metrics.rtoRate}% RTO rate`}
        />
        
        <MetricCard
          title="Delivered Orders"
          value={metrics.deliveredCount}
          icon={FiPackage}
          color="green"
          subtitle={`${metrics.deliveryRate}% delivery rate`}
        />
        
        <MetricCard
          title="Revenue Earned"
          value={`₹${metrics.revenueEarned.toLocaleString()}`}
          icon={FiTrendingUp}
          color="green"
          subtitle="COD + Prepaid revenue"
        />
      </div>

      {/* Additional Stats */}
      <div className="bg-[#1A2F31] rounded-lg p-6 border border-[#2A4F51]">
        <h3 className="text-white text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Total Shipments</p>
            <p className="text-white text-xl font-bold">{metrics.totalShipments}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Canceled</p>
            <p className="text-white text-xl font-bold">{metrics.canceledCount}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Pending</p>
            <p className="text-white text-xl font-bold">{metrics.pendingCount}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Net Cost</p>
            <p className="text-white text-xl font-bold">
              ₹{metrics.netShippingCost.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1A2F31] rounded-lg p-6 border border-[#2A4F51]">
          <h4 className="text-white text-sm font-semibold mb-3">Delivery Performance</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Delivery Rate</span>
                <span className="text-green-400 font-medium">{metrics.deliveryRate}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${metrics.deliveryRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">RTO Rate</span>
                <span className="text-orange-400 font-medium">{metrics.rtoRate}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${metrics.rtoRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1A2F31] rounded-lg p-6 border border-[#2A4F51]">
          <h4 className="text-white text-sm font-semibold mb-3">Financial Overview</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Spend</span>
              <span className="text-red-400 font-medium">
                ₹{metrics.shippingSpend.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Revenue Collected</span>
              <span className="text-green-400 font-medium">
                ₹{metrics.revenueEarned.toLocaleString()}
              </span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-white text-sm font-semibold">Net Cost</span>
                <span className="text-white font-bold">
                  ₹{metrics.netShippingCost.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingMetrics;
