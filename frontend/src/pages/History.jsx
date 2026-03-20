import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

const API_BASE = "http://localhost:8000";

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/surveys`);
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await axios.delete(`${API_BASE}/surveys/${id}`);
      fetchHistory();
      if (selectedAudit?.id === id) setSelectedAudit(null);
    } catch (err) {
      console.error("Delete error", err);
      alert("Error deleting record.");
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear ALL history? This cannot be undone.",
      )
    )
      return;
    try {
      await axios.delete(`${API_BASE}/surveys`);
      fetchHistory();
      setSelectedAudit(null);
      alert("History cleared successfully!");
    } catch (err) {
      console.error("Clear all error", err);
      alert("Error clearing history.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="text-left"
    >
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-5xl font-black text-black mb-2 tracking-tighter uppercase">
            Audit History
          </h1>
          <p className="text-text-medium text-lg max-w-[500px]">
            Review past automated survey audits and sentiment analysis results.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear All History
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl py-20 px-10 text-center">
          <p className="text-gray-400 font-bold text-xl mb-2">
            No Audits Found
          </p>
          <p className="text-gray-400 text-sm">
            Upload a survey recording from the Home page to start auditing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-2xl p-6 flex justify-between items-center transition-all cursor-pointer group shadow-sm hover:shadow-md ${
                selectedAudit?.id === item.id
                  ? "border-black ring-1 ring-black"
                  : "border-gray-100 hover:border-black"
              }`}
              onClick={() => setSelectedAudit(item)}
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                    item.audit_result.status === "Match"
                      ? "bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white"
                      : "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white"
                  }`}
                >
                  {item.audit_result.status === "Match" ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : (
                    <AlertCircle className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    {item.timestamp}
                  </p>
                  <h4 className="text-2xl font-black text-black uppercase tracking-tight leading-none">
                    {item.name}
                  </h4>
                  <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-tight">
                    Age: {item.age} • {item.form_profession || "No Profession"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Audit Status
                  </p>
                  <p
                    className={`text-lg font-black uppercase leading-none ${item.audit_result.status === "Match" ? "text-green-500" : "text-red-500"}`}
                  >
                    {item.audit_result.status}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  className="bg-gray-50 text-gray-300 hover:bg-black hover:text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  title="Delete Audit"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Audit Detail View */}
      <AnimatePresence>
        {selectedAudit && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-50 bg-white overflow-y-auto px-6 py-20"
          >
            <div className="w-[80vw] max-w-[1600px] mx-auto">
              <div className="flex justify-between items-center mb-10">
                <button
                  onClick={() => setSelectedAudit(null)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-black rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  ← Back to History
                </button>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Selected Audit
                  </p>
                  <p className="text-lg font-black text-black uppercase">
                    {selectedAudit.name}
                  </p>
                </div>
              </div>

              <AuditResult
                result={selectedAudit}
                formAge={selectedAudit.form_age}
                formName={selectedAudit.name}
                formProfession={selectedAudit.form_profession}
                formEducation={selectedAudit.form_education}
                formLocation={selectedAudit.form_location}
                formMobile={selectedAudit.form_mobile}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Component Import for Detail View
import AuditResult from "../components/AuditResult";

export default History;
