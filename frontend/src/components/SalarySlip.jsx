import React from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  ClipboardCheck,
  Gem,
  MapPin,
  Download,
  ShieldCheck
} from 'lucide-react';

const SalarySlip = ({ data, onSave }) => {
  if (!data) return null;

  const { 
    surveyor_name, 
    particulars, 
    earnings, 
    deductions, 
    total_earnings, 
    total_deductions, 
    net_salary 
  } = data;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 max-w-5xl mx-auto my-8"
    >
      {/* Header Bar */}
      <div className="bg-black p-8 text-white flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Surveyor Salary Slip</h1>
          <p className="text-gray-400 font-bold mt-1 uppercase text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-[#FF4D4D]" /> {surveyor_name}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {onSave && (
            <button 
              onClick={onSave}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 cursor-pointer"
            >
              Save to History
            </button>
          )}
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-1">Net Payable</p>
            <div className="text-4xl font-black text-[#4ADE80]">
              ₹{net_salary.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 space-y-12">
        
        {/* Particulars Table */}
        <section>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#1E3A8A] text-white">
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest border-r border-blue-800">Particulars</th>
                  <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-widest border-r border-blue-800">Target</th>
                  <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-widest border-r border-blue-800">Achieved</th>
                  <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-widest border-r border-blue-800">Result</th>
                  <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-widest">Net Effect</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-bold">
                {particulars.map((p, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 border-r border-gray-100 text-gray-700">{p.item}</td>
                    <td className="px-6 py-4 border-r border-gray-100 text-center text-gray-900">{p.target}</td>
                    <td className="px-6 py-4 border-r border-gray-100 text-center text-gray-900">{p.achieved}</td>
                    <td className="px-6 py-4 border-r border-gray-100 text-center">
                      <span className={p.result.includes('✅') || p.result.includes('EXTRA') ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                        {p.result}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={p.net_effect >= 0 ? "text-green-600" : "text-red-500"}>
                        {p.net_effect >= 0 ? `+₹${p.net_effect}` : `-₹${Math.abs(p.net_effect)}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Earnings & Deductions Bar */}
        <div className="bg-[#1E3A8A] py-3 text-center rounded-lg">
          <h2 className="text-white text-sm font-black uppercase tracking-[0.3em]">Earnings & Deductions</h2>
        </div>

        {/* Two-Column Earnings & Deductions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Earnings Table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1E3A8A]/90 text-white text-[10px] uppercase font-black tracking-widest">
                  <th className="px-4 py-3 text-left w-12 border-r border-blue-700">Sr.</th>
                  <th className="px-4 py-3 text-left border-r border-blue-700">Earnings</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-[12px] font-bold">
                {earnings.map((e, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 border-r border-gray-100 text-gray-400">{e.sr}</td>
                    <td className="px-4 py-3 border-r border-gray-100 text-gray-700">{e.item}</td>
                    <td className="px-4 py-3 text-right text-green-600">₹{e.amount}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 text-[#1E3A8A]">
                  <td colSpan={2} className="px-4 py-4 font-black uppercase tracking-wider border-r border-gray-200">Total Earnings</td>
                  <td className="px-4 py-4 text-right font-black text-lg">₹{total_earnings}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions Table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1E3A8A]/90 text-white text-[10px] uppercase font-black tracking-widest">
                  <th className="px-4 py-3 text-left w-12 border-r border-blue-700">Sr.</th>
                  <th className="px-4 py-3 text-left border-r border-blue-700">Deductions</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-[12px] font-bold">
                {deductions.map((d, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 border-r border-gray-100 text-gray-400">{d.sr}</td>
                    <td className="px-4 py-3 border-r border-gray-100 text-gray-700">{d.item}</td>
                    <td className="px-4 py-3 text-right text-red-500">{d.amount > 0 ? `₹${d.amount}` : "—"}</td>
                  </tr>
                ))}
                <tr className="bg-red-50 text-[#1E3A8A]">
                  <td colSpan={2} className="px-4 py-4 font-black uppercase tracking-wider border-r border-gray-200">Total Deductions</td>
                  <td className="px-4 py-4 text-right font-black text-lg">₹{total_deductions}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* Final Net Pay Footer */}
        <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col md:flex-row items-center justify-between">
           <div className="flex items-center gap-4 mb-4 md:mb-0">
             <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
               <ShieldCheck className="w-6 h-6 text-[#1E3A8A]" />
             </div>
             <div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Status</p>
               <p className="text-sm font-black text-gray-900 uppercase">Audit Verified & Processed</p>
             </div>
           </div>
           
           <div className="text-center md:text-right">
             <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Take Home Salary</p>
             <h3 className="text-4xl font-black text-black">
               ₹{net_salary.toLocaleString()}
             </h3>
           </div>
        </div>

      </div>
    </motion.div>
  );
};

export default SalarySlip;
