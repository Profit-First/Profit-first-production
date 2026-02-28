import React, { useEffect, useState } from "react";
import axiosInstance from "../axios";
import { toast } from "react-toastify";

const Adminpage = () => {
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const userRes = await axiosInstance.get("/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const leadRes = await axiosInstance.get("/admin/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUsers(userRes.data);
        setLeads(leadRes.data);
      } catch (error) {
        toast.error("Failed to fetch data");
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-6 text-white bg-[#0D191C] min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div key={user._id} className="p-4 bg-gray-800 rounded-xl shadow">
              <h3 className="text-lg font-semibold">{user.firstName} {user.lastName}</h3>
              <p>Email: {user.email}</p>
              <p>Verified: {user.isVerified ? "Yes" : "No"}</p>
              <p>Step: {user.step}</p>
              <p>Platform: {user.onboarding?.step2?.platform}</p>
              <p>Ad Account: {user.onboarding?.step4?.adAccountId || "N/A"}</p>
              <p>Shiprocket ID: {user.onboarding?.step5?.shiproactId || "N/A"}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Contact Leads</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leads.map((lead) => (
            <div key={lead._id} className="p-4 bg-gray-800 rounded-xl shadow">
              <h3 className="text-lg font-semibold">{lead.name}</h3>
              <p>Email: {lead.email}</p>
              <p>Phone: {lead.phone}</p>
              <p>Website: {lead.website}</p>
              <p className="text-sm text-gray-300 mt-2">{lead.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Adminpage;
