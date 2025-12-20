import React from "react";

const getColor = (val) => {
  if (val == null) return "";
  if (val === 0) return "bg-blue-100 text-black";
  if (val >= 50) return "bg-blue-800 text-white";
  if (val >= 30) return "bg-blue-600 text-white";
  if (val >= 15) return "bg-blue-400 text-white";
  if (val >= 5) return "bg-blue-200 text-black";
  return "bg-blue-100 text-black";
};

const CohortHeatmap = ({ data = [] }) => {
  const periods = 12;
  return (
    <div className="overflow-x-auto p-4">
      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            <th className="border px-4 py-2">Cohort</th>
            <th className="border px-4 py-2"># Users</th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} className="border px-4 py-2">{`M${i}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              <td className="border px-4 py-2">{row.date}</td>
              <td className="border px-4 py-2">{row.users}</td>
              {row.retention.map((val, i) => (
                <td
                  key={i}
                  className={`border px-4 py-2 text-center ${getColor(val)}`}
                >
                  {val != null ? `${val}%` : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CohortHeatmap;
