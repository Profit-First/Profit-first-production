import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cell,
  Pie,
  PieChart,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  symbol = "₹",
  type = "number",
}) => (
  <div>
    <label className="text-sm font-medium text-gray-400">{label}</label>
    <div className="relative mt-1">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-gray-800 text-white rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-shadow duration-300"
      />
      <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
        {symbol}
      </span>
    </div>
  </div>
);

const MetricCard = ({
  title,
  value,
  isHighlighted = false,
  isPercentage = false,
  symbol = "",
}) => (
  <div
    className={`rounded-lg p-6 ${
      isHighlighted
        ? "bg-gradient-to-br from-green-500 to-cyan-500 text-white"
        : "bg-gray-800 text-white"
    }`}
  >
    <h3 className="text-base font-medium text-gray-300 mb-2">{title}</h3>
    <p
      className={`text-4xl font-bold ${
        isHighlighted ? "text-white" : "text-cyan-400"
      }`}
    >
      {value}
      {isPercentage && "%"}
      {symbol && ` ${symbol}`}
    </p>
  </div>
);

const DonutTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="relative px-3 py-2 rounded-md bg-gray-900 text-white shadow-xl border border-gray-700">
      {/* arrow */}
      <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900" />
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {item.name}
      </div>
      <div className="text-lg font-semibold">
        {new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(item.value)}
      </div>
    </div>
  );
};

 export default function ProfitCalculator() {
  const navigate = useNavigate();

  const [activeIndex, setActiveIndex] = useState(null);
  const [sellingPrice, setSellingPrice] = useState(750);
  const [cogsPerUnit, setCogsPerUnit] = useState(250);
  const [unitsSold, setUnitsSold] = useState(1000);
  const [marketingSpend, setMarketingSpend] = useState(50000);
  const [shippingCostPerUnit, setShippingCostPerUnit] = useState(70);
  const [otherExpenses, setOtherExpenses] = useState(15000);
  const [roas, setRoas] = useState(5);
  const [aov, setAov] = useState(1000);
  const [rtoShippingCostPerOrder, setRtoShippingCostPerOrder] = useState(100);
  const [ordersCancelled, setOrdersCancelled] = useState(50);
  const [rtoPercentage, setRtoPercentage] = useState(20);

  // Calculated states
  const [revenue, setRevenue] = useState(0);
  const [grossProfit, setGrossProfit] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [netMargin, setNetMargin] = useState(0);
  const [breakEvenROAS, setBreakEvenROAS] = useState(0);
  const [ordersShipped, setOrdersShipped] = useState(0);
  const [ordersReturned, setOrdersReturned] = useState(0);
  const [ordersDelivered, setOrdersDelivered] = useState(0);
  const [totalCogs, setTotalCogs] = useState(0);
  const [totalShippingCosts, setTotalShippingCosts] = useState(0);

  // --- CALCULATIONS ---
  useEffect(() => {
    // Sanitize inputs to ensure they are numbers
    const numSellingPrice = Number(sellingPrice) || 0;
    const numCogsPerUnit = Number(cogsPerUnit) || 0;
    const numUnitsSold = Number(unitsSold) || 0;
    const numMarketingSpend = Number(marketingSpend) || 0;
    const numShippingCostPerUnit = Number(shippingCostPerUnit) || 0;
    const numOtherExpenses = Number(otherExpenses) || 0;
    const numOrdersCancelled = Number(ordersCancelled) || 0;
    const numRtoPercentage = Number(rtoPercentage) || 0;
    const numRtoShippingCostPerOrder = Number(rtoShippingCostPerOrder) || 0;

    // Core logic for profit calculation
    const calculatedOrdersShipped = numUnitsSold - numOrdersCancelled;
    const calculatedOrdersReturned =
      calculatedOrdersShipped * (numRtoPercentage / 100);
    const calculatedOrdersDelivered =
      calculatedOrdersShipped - calculatedOrdersReturned;
    const calculatedTotalCogs = calculatedOrdersShipped * numCogsPerUnit;
    const calculatedTotalShippingCosts =
      calculatedOrdersShipped * numShippingCostPerUnit +
      calculatedOrdersReturned * numRtoShippingCostPerOrder;

    const collectedRevenue = numSellingPrice * calculatedOrdersDelivered;
    const calculatedGrossProfit = collectedRevenue - calculatedTotalCogs;

    const calculatedNetProfit =
      calculatedGrossProfit -
      numMarketingSpend -
      numOtherExpenses -
      calculatedTotalShippingCosts;

    const calculatedNetMargin =
      collectedRevenue > 0 ? (calculatedNetProfit / collectedRevenue) * 100 : 0;

    const grossMargin =
      (numSellingPrice - numCogsPerUnit - numShippingCostPerUnit) /
      numSellingPrice;
    const calculatedBreakEvenROAS = grossMargin > 0 ? 1 / grossMargin : 0;

    // Update state with calculated values
    setRevenue(collectedRevenue);
    setGrossProfit(calculatedGrossProfit);
    setNetProfit(calculatedNetProfit);
    setNetMargin(calculatedNetMargin);
    setBreakEvenROAS(calculatedBreakEvenROAS);
    setOrdersShipped(calculatedOrdersShipped);
    setOrdersReturned(Math.round(calculatedOrdersReturned)); // Round for display
    setOrdersDelivered(Math.round(calculatedOrdersDelivered)); // Round for display
    setTotalCogs(calculatedTotalCogs);
    setTotalShippingCosts(calculatedTotalShippingCosts);
  }, [
    sellingPrice,
    cogsPerUnit,
    unitsSold,
    marketingSpend,
    shippingCostPerUnit,
    otherExpenses,
    ordersCancelled,
    rtoPercentage,
    rtoShippingCostPerOrder,
  ]);

  // --- COST BREAKDOWN DATA FOR DONUT CHART ---
  const costData = useMemo(() => {
    const cogs = (Number(cogsPerUnit) || 0) * (Number(unitsSold) || 0);
    const shipping =
      (Number(shippingCostPerUnit) || 0) * (Number(unitsSold) || 0);
    const marketing = Number(marketingSpend) || 0;
    const other = Number(otherExpenses) || 0;
    const rtoCosts =
      Number(unitsSold) *
      ((Number(rtoPercentage) || 0) / 100) *
      (Number(rtoShippingCostPerOrder) || 0);

    return [
      { name: "COGS", value: cogs },
      { name: "Marketing", value: marketing },
      { name: "Shipping", value: shipping + rtoCosts },
      { name: "Other", value: other },
    ];
  }, [
    cogsPerUnit,
    unitsSold,
    shippingCostPerUnit,
    marketingSpend,
    otherExpenses,
    rtoPercentage,
    rtoShippingCostPerOrder,
  ]);

  // Colors for the pie chart slices
  const COLORS = ["#33d17a", "#00d1ff", "#ff8c32", "#a56eff"];

  // Helper to format numbers as Indian Rupees (₹)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(value)
      .replace("₹", "₹ ");
  };

  return (


    <div className="min-h-screen bg-[#0d1d1e] text-white font-sans px-4 py-8 overflow-hidden">
  
      <button
            onClick={() => navigate(-1)}
        className="absolute top-6 left-6 text-gray-300 bg-transparent border-none text-lg font-semibold hover:text-white"
      >
        &#8592; Back
      </button>
      <div className="relative max-w-screen-xl mx-auto">
        {/* Background gradient glows */}
        <div className="absolute top-[-120px] left-0 right-0 h-64 w-full rounded-full blur-[160px] opacity-50 z-0 mx-auto bg-gradient-to-r from-green-500 to-cyan-500" />
        <div className="absolute bottom-[-80px] left-0 right-0 h-32 w-full rounded-full blur-[160px] opacity-50 z-0 mx-auto bg-gradient-to-l from-green-500 to-cyan-500" />

        <div className="relative z-10">
          <header className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold">
              D2C Profit Calculator
            </h1>
            <p className="text-lg text-gray-400 mt-2">
              Enter details to see Net Profit and Margins.
            </p>
          </header>
          <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* --- INPUTS COLUMN --- */}
            <div className="lg:col-span-2 bg-gray-800/50 rounded-xl p-6 space-y-5 shadow-lg">
              <h2 className="text-xl font-semibold text-gray-300 border-b border-gray-700 pb-3 mb-5">
                REVENUE & COST INPUTS
              </h2>
              <InputField
                label="Selling Price"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="e.g., 750"
              />
              <InputField
                label="COGS per Unit"
                value={cogsPerUnit}
                onChange={(e) => setCogsPerUnit(e.target.value)}
                placeholder="e.g., 250"
              />
              <InputField
                label="Total Orders"
                value={unitsSold}
                onChange={(e) => setUnitsSold(e.target.value)}
                placeholder="e.g., 1000"
                symbol="Qty"
              />
              <InputField
                label="Average Order Value (AOV)"
                value={aov}
                onChange={(e) => setAov(e.target.value)}
                placeholder="e.g., 1000"
                symbol="₹"
              />
              <InputField
                label="RTO Shipping Cost per Order"
                value={rtoShippingCostPerOrder}
                onChange={(e) => setRtoShippingCostPerOrder(e.target.value)}
                placeholder="e.g., 100"
                symbol="₹"
              />
              <InputField
                label="Orders Cancelled Before Shipment"
                value={ordersCancelled}
                onChange={(e) => setOrdersCancelled(e.target.value)}
                placeholder="e.g., 50"
                symbol="Qty"
              />
              <InputField
                label="Return to Origin (RTO) %"
                value={rtoPercentage}
                onChange={(e) => setRtoPercentage(e.target.value)}
                placeholder="e.g., 20"
                symbol="%"
              />
              <InputField
                label="Marketing Spend"
                value={marketingSpend}
                onChange={(e) => setMarketingSpend(e.target.value)}
                placeholder="e.g., 50000"
              />
              <InputField
                label="ROAS (Return on Ad Spend)"
                value={roas}
                onChange={(e) => setRoas(e.target.value)}
                placeholder="e.g., 5"
                symbol="x"
              />
              <InputField
                label="Shipping Cost per Unit"
                value={shippingCostPerUnit}
                onChange={(e) => setShippingCostPerUnit(e.target.value)}
                placeholder="e.g., 70"
              />
              <InputField
                label="Other Expenses"
                value={otherExpenses}
                onChange={(e) => setOtherExpenses(e.target.value)}
                placeholder="e.g., 15000"
              />
            </div>
            {/* --- METRICS & CHART COLUMN --- */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <MetricCard
                title="Net Profit"
                value={formatCurrency(netProfit)}
                isHighlighted={true}
              />
              <MetricCard
                title="Net Margin"
                value={netMargin.toFixed(2)}
                isHighlighted={true}
                isPercentage={true}
              />
              <MetricCard
                title="Gross Profit"
                value={formatCurrency(grossProfit)}
              />
              <MetricCard
                title="Break-even ROAS"
                value={breakEvenROAS.toFixed(2)}
              />
              <MetricCard title="Revenue" value={formatCurrency(revenue)} />
              <MetricCard
                title="Orders Shipped"
                value={ordersShipped}
                symbol="Qty"
              />
              <MetricCard
                title="Orders Returned (RTO)"
                value={ordersReturned}
                symbol="Qty"
              />
              <MetricCard
                title="Orders Delivered"
                value={ordersDelivered}
                symbol="Qty"
              />
              <MetricCard
                title="Total COGS"
                value={formatCurrency(totalCogs)}
              />
              <MetricCard
                title="Total Shipping Costs"
                value={formatCurrency(totalShippingCosts)}
              />
              <MetricCard
                title="Total Marketing Spend"
                value={formatCurrency(marketingSpend)}
              />
              
              {/* --- COST BREAKDOWN CHART --- */}
              <div className="sm:col-span-2 bg-gray-800 rounded-xl p-6 h-96">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">
                  Cost Breakdown
                </h3>

                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                        isAnimationActive
                        animationBegin={100}
                        animationDuration={900}
                        onMouseEnter={(_, idx) => setActiveIndex(idx)}
                        onMouseLeave={() => setActiveIndex(null)}
                      >
                        {costData.map((entry, index) => (
                          <Cell
                            key={`slice-${entry.name}`}
                            fill={COLORS[index % COLORS.length]}
                            stroke={
                              activeIndex === index ? "#ffffff" : "#0d1d1e"
                            }
                            strokeWidth={activeIndex === index ? 3 : 1}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        content={<DonutTooltip />}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        wrapperStyle={{ outline: "none" }}
                      />

                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => (
                          <span className="text-gray-300 text-sm">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Center label (total costs) */}
                <div className="pointer-events-none -mt-40 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Total Costs</div>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(
                        costData.reduce((sum, d) => sum + (d.value || 0), 0)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
