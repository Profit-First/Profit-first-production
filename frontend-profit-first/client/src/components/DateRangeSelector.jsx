import React, { useState } from "react";
import { DateRange } from "react-date-range";
import { addDays, subDays, differenceInDays } from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

export default function DateRangeSelector({ onApply }) {
  const maxRangeDays = 10955; // Approximately 30 years

  // Helper function to get the start of the current month
  const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
  // Helper function to get the start of the current year
  const startOfYear = (date) => new Date(date.getFullYear(), 0, 1);

  const sidebarOptions = [
    { label: "Today", range: [new Date(), new Date()] },
    { label: "Yesterday", range: [subDays(new Date(), 1), subDays(new Date(), 1)] },
    { label: "Last 7 days", range: [subDays(new Date(), 6), new Date()] },
    { label: "Last 30 days", range: [subDays(new Date(), 29), new Date()] },
    { label: "Last 45 days", range: [subDays(new Date(), 44), new Date()] },
    { label: "This month", range: [startOfMonth(new Date()), new Date()] },
    { label: "This year", range: [startOfYear(new Date()), new Date()] },
  ];

  // Set initial state to "Today"
  const [state, setState] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  const [selectedLabel, setSelectedLabel] = useState("Today");

  const handleSidebarClick = (label, range) => {
    setSelectedLabel(label);
    setState([{ startDate: range[0], endDate: range[1], key: "selection" }]);
  };

  const handleDateChange = (item) => {
    const { startDate, endDate } = item.selection;
    const currentDate = new Date();

    // Restrict future dates
    const restrictedEndDate = endDate > currentDate ? currentDate : endDate;

    // Calculate the number of days in the selected range
    const rangeDays = differenceInDays(restrictedEndDate, startDate);

    // Prevent selecting a range greater than maxRangeDays
    if (rangeDays <= maxRangeDays) {
      setState([{ startDate, endDate: restrictedEndDate, key: "selection" }]);
    } else {
      // Optionally, provide feedback to the user if the range is too large
      console.warn(`Date range exceeds maximum of ${maxRangeDays} days.`);
      // You could also reset to a valid range or prevent update
    }
  };

  return (
    <div className="flex bg-white text-black rounded-md shadow-lg p-4 w-full max-w-xl">
      <div className="w-1/4 border-r pr-4 overflow-y-auto">
        {sidebarOptions.map((opt) => (
          <div
            key={opt.label}
            onClick={() => handleSidebarClick(opt.label, opt.range)}
            className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
              selectedLabel === opt.label ? "bg-gray-100 font-medium" : ""
            }`}
          >
            {opt.label}
          </div>
        ))}
      </div>
      <div className="w-3/4 px-4">
        <DateRange
          editableDateInputs={true}
          onChange={handleDateChange}
          moveRangeOnFirstSelection={false}
          ranges={state}
          rangeColors={["#3b82f6"]}
          maxDate={new Date()} // Prevents selecting dates in the future
        />
        <div className="flex justify-end mt-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            onClick={() => onApply(state[0])}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
