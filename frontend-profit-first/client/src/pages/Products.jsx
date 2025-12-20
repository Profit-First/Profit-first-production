import React from "react";

const Products = () => {
  return (
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Products</h2>
      <p>
        Coming soon: Our team is working hard, and we’ll launch it as soon as
        it's ready.
      </p>
    </div>
  );
};

export default Products;

// import React, { useState, useEffect, useCallback, useMemo } from "react";
// import axios from "axios";
// import axiosInstance from "../../axios";

// const Notification = ({ message, type, onClear }) => {
//   if (!message) return null;
//   const baseStyle =
//     "fixed top-5 right-5 p-4 rounded-lg text-white shadow-lg transition-opacity duration-300 z-50";
//   const typeStyles = {
//     success: "bg-green-500",
//     error: "bg-red-500",
//     info: "bg-blue-500",
//   };
//   return (
//     <div className={`${baseStyle} ${typeStyles[type] || "bg-gray-700"}`}>
//       <span>{message}</span>
//       <button onClick={onClear} className="ml-4 font-bold">
//         X
//       </button>
//     </div>
//   );
// };

// export default function Products() {
//   const [products, setProducts] = useState([]);
//   const [costs, setCosts] = useState({}); // { [productId]: number|string }
//   const [initialCosts, setInitialCosts] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [notification, setNotification] = useState({ message: "", type: "" });

//   // auto-clear notifications
//   useEffect(() => {
//     if (!notification.message) return;
//     const t = setTimeout(
//       () => setNotification({ message: "", type: "" }),
//       4000
//     );
//     return () => clearTimeout(t);
//   }, [notification]);

//   const fetchProducts = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await axiosInstance.get("/data/all-with-costs", {
//         withCredentials: true,
//       });
//       const list = Array.isArray(res.data) ? res.data : [];
//       setProducts(list);

//       // default missing/invalid costs to 0
//       const init = {};
//       list.forEach((p) => {
//         init[p.id] = Number.isFinite(Number(p.cost)) ? Number(p.cost) : 0;
//       });
//       setCosts(init);
//       setInitialCosts(init);
//     } catch (err) {
//       console.error("Error fetching products:", err);
//       setNotification({
//         message: "Failed to load products. Please try again.",
//         type: "error",
//       });
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchProducts();
//   }, [fetchProducts]);

//   // input change
//   const handleChange = (productId, value) => {
//     const clean = value === "" ? "" : value; // allow clearing the field
//     setCosts((prev) => ({ ...prev, [productId]: clean }));
//   };

//   // build changed updates
//   const updates = useMemo(() => {
//     const u = [];
//     Object.entries(costs).forEach(([productId, v]) => {
//       const parsed = Number.isFinite(Number(v)) ? Number(v) : 0;
//       const orig = Number.isFinite(Number(initialCosts[productId]))
//         ? Number(initialCosts[productId])
//         : 0;
//       if (parsed !== orig) u.push({ productId, cost: parsed });
//     });
//     return u;
//   }, [costs, initialCosts]);

//   // submit
//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (updates.length === 0) {
//       setNotification({ message: "No changes to save.", type: "info" });
//       return;
//     }
//     setSubmitting(true);
//     try {
//       await axiosInstance.post("/data/update-costs", updates, {
//         withCredentials: true,
//       });
//       setNotification({
//         message: "✅ Costs updated successfully!",
//         type: "success",
//       });
//       await fetchProducts();
//     } catch (err) {
//       console.error("Update error:", err);
//       setNotification({
//         message: "❌ Failed to update costs. Please try again.",
//         type: "error",
//       });
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const filtered = useMemo(() => {
//     const term = searchTerm.trim().toLowerCase();
//     if (!term) return products;
//     return products.filter((p) => p.title?.toLowerCase().includes(term));
//   }, [products, searchTerm]);

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
//         <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen px-4 py-6 bg-[#0D1D1E] text-white flex justify-center items-start">
//       <Notification
//         message={notification.message}
//         type={notification.type}
//         onClear={() => setNotification({ message: "", type: "" })}
//       />
//       {/* background blurs */}
//       <div
//         className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-30 z-0"
//         style={{ background: "linear-gradient(to right, #12EB8E, #12EB8E)" }}
//       />
//       <div
//         className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-[100px] opacity-30 z-0"
//         style={{ background: "linear-gradient(to left, #12EB8E, #12EB8E)" }}
//       />

//       <div className="w-full max-w-6xl p-6 rounded-xl z-10 mt-2">
//         <h2 className="text-3xl font-bold mb-6 text-center">
//           Manage Product Costs
//         </h2>

//         {/* search */}
//         <div className="flex justify-center mb-6">
//           <input
//             type="text"
//             placeholder="Search by product title..."
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//             className="px-4 py-2 rounded-md w-full max-w-lg bg-[#1E2A2B] border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-[#12EB8E]"
//           />
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-6">
//           <div className="overflow-x-auto">
//             <table className="w-full text-left border-collapse text-sm">
//               <thead>
//                 <tr className="border-b border-gray-600">
//                   <th className="py-3 px-4 font-semibold">Image</th>
//                   <th className="py-3 px-4 font-semibold">Product Title</th>
//                   <th className="py-3 px-4 font-semibold">Retail Price (₹)</th>
//                   <th className="py-3 px-4 font-semibold">
//                     Manufacturing Cost (₹)
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filtered.length > 0 ? (
//                   filtered.map((product) => {
//                     const value = costs[product.id];
//                     const display = value === "" ? "" : String(value);
//                     return (
//                       <tr
//                         key={product.id}
//                         className="border-b border-gray-700 hover:bg-[#1E2A2B] transition-colors duration-200"
//                       >
//                         <td className="py-3 px-4">
//                           <img
//                             src={product.image}
//                             width={40}
//                             height={40}
//                             alt={product.title}
//                             className="rounded-md"
//                             onError={(e) => {
//                               e.currentTarget.onerror = null;
//                               e.currentTarget.src =
//                                 "https://placehold.co/40x40/1E2A2B/FFFFFF?text=Err";
//                             }}
//                           />
//                         </td>
//                         <td className="py-3 px-4 font-medium">
//                           {product.title}
//                         </td>
//                         <td className="py-3 px-4">
//                           ₹{Number(product.price ?? 0).toFixed(2)}
//                         </td>
//                         <td className="py-3 px-4">
//                           <input
//                             type="number"
//                             step="0.01"
//                             placeholder="Enter cost"
//                             value={display}
//                             onChange={(e) =>
//                               handleChange(product.id, e.target.value)
//                             }
//                             className="w-full max-w-[150px] px-2 py-1 rounded-md bg-transparent border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-[#12EB8E]"
//                           />
//                         </td>
//                       </tr>
//                     );
//                   })
//                 ) : (
//                   <tr>
//                     <td colSpan="4" className="text-center py-8 text-gray-400">
//                       No products found.
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>

//           <div className="w-full flex justify-end pt-4 gap-3">
//             <button
//               type="button"
//               onClick={fetchProducts}
//               disabled={submitting}
//               className="px-4 py-3 rounded-md border border-white/20 hover:bg-white/10 disabled:opacity-50"
//             >
//               Refresh
//             </button>
//             <button
//               type="submit"
//               disabled={submitting}
//               className="w-40 py-3 rounded-md text-black font-semibold transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
//               style={{ backgroundColor: "#12EB8E" }}
//             >
//               {submitting
//                 ? "Saving..."
//                 : `Save Changes${updates.length ? ` (${updates.length})` : ""}`}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }
