import React, { useState, useEffect } from "react";
import { PulseLoader } from "react-spinners";
import { toast } from "react-toastify";
import axiosInstance from "../../axios";

const Step3 = ({ onComplete }) => {
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [autoDivider, setAutoDivider] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axiosInstance.get("/onboard/fetchproduct");
        console.log("✅ Products fetched:", res.data);
        
        // Backend returns { success: true, products: [...], count: X }
        const productList = res.data.products || [];
        
        // Transform products to match expected format
        const formattedProducts = productList.map(product => ({
          id: product.id,
          title: product.title,
          price: product.variants?.[0]?.price || '0',
          image: product.images?.[0]?.src || product.image?.src || 'https://via.placeholder.com/40'
        }));
        
        console.log(`📦 Loaded ${formattedProducts.length} products`);
        setProducts(formattedProducts);
      } catch (err) {
        console.error("Error fetching products:", err);
        toast.error("Failed to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    // Note: Initial sync is already running in background from Step 2
    // No need to trigger another sync here
  }, []);

  const handleChange = (productId, value) => {
    setCosts((prev) => ({ ...prev, [productId]: value }));
  };

  const handleAutoFill = (value) => {
    setAutoDivider(value);
    const divider = parseFloat(value);
    if (!divider || divider <= 0) return;

    const newCosts = {};
    products.forEach((product) => {
      const calculatedCost = parseFloat(product.price) / divider;
      newCosts[product.id] = calculatedCost.toFixed(2);
    });
    setCosts(newCosts);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLoading(true);
    const updates = Object.entries(costs).map(([productId, cost]) => ({
      productId,
      cost: parseFloat(cost),
    }));
    try {
      // Update product costs
      await axiosInstance.post("/onboard/modifyprice", updates);
      
      // Update onboarding step
      await axiosInstance.post("/onboard/step", {
        step: 3,
        data: {
          productCosts: updates,
          completedAt: new Date().toISOString()
        }
      });
      
      toast.success("✅ Costs updated successfully!", { autoClose: 1500 });
      setLoading(false);
      
      // Smooth transition to next step
      setTimeout(() => {
        toast.info("📊 Loading ad account setup...", { autoClose: 1000 });
        setTimeout(() => onComplete(), 500);
      }, 1000);
    } catch (err) {
      console.error("Update error:", err);
      toast.error("❌ Failed to update costs.");
      setLoading(false);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0D1D1E]">
        <PulseLoader size={60} color="#12EB8E" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 bg-[#101218] text-white relative flex justify-center items-center overflow-hidden">
     <style>{`
        .bg-blob {
          position: absolute;
          width: 380px; 
          height: 380px;
          filter: blur(80px);
          opacity: 0.14;
          z-index: 0;
          border-radius: 50%;
        }
        .blob-left { left: -120px; top: 100%; background: #5fc61fff; transform: translateY(-50%); }
        .blob-right { right: -120px; top: 0%; background: #5fc61fff; transform: translateY(0%); }
      `}</style>
      <div className="bg-blob blob-left"></div>
      <div className="bg-blob blob-right"></div>

      <div className="w-full max-w-6xl p-6 rounded-xl bg-[#1E1E1E] z-10 overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-semibold mb-6 text-center">
         Set Manufacturing Cost per Product
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6 justify-between">
          <input
            type="text"
            placeholder="Search product..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 rounded-md w-full sm:w-1/2 border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <div className="flex items-center gap-2">
            <label className="text-sm text-white">Auto cost: Price ÷</label>
            <input
              type="number"
              step="0.01"
              value={autoDivider}
              onChange={(e) => handleAutoFill(e.target.value)}
              placeholder="e.g., 2"
              className="w-24 px-3 py-2 rounded-md border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="py-2 px-4 font-semibold text-white">
                  Product Image
                </th>
                <th className="py-2 px-4 font-semibold text-white">
                  Product ID
                </th>
                <th className="py-2 px-4 font-semibold text-white">
                  Product Title
                </th>
                <th className="py-2 px-4 font-semibold text-white">
                  Price (₹)
                </th>
                <th className="py-2 px-4 font-semibold text-white">
                  Manufacturing Cost (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-gray-700 hover:bg-[#1E2A2B]"
                >
                  <td className="py-3 px-4 ">
                    <img
                      src={product.image}
                      width={40}
                      height={40}
                      alt="product image"
                      className="rounded-[6px]"
                    />
                  </td>
                  <td className="py-3 px-4">{product.id}</td>
                  <td className="py-3 px-4">{product.title}</td>
                  <td className="py-3 px-4">
                    ₹{parseFloat(product.price).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Enter cost"
                      value={costs[product.id] || ""}
                      onChange={(e) => handleChange(product.id, e.target.value)}
                      className="w-full px-2 py-1 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            className="w-full flex justify-center
"
          >
            <button
              type="submit"
              disabled={submitting}
              className="w-32 py-3 rounded-md  bg-white text-black font-semibold transition"
            >
              {submitting ? "Saving..." : "Save Costs"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Step3;
