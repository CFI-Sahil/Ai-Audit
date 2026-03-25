import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

// Component Imports
import SurveyForm from '../components/SurveyForm';
import AuditResult from '../components/AuditResult';
import FeatureHighlights from '../components/FeatureHighlights';
import SalarySlip from '../components/SalarySlip';
import { Users, FileText, ChevronRight, FileSpreadsheet, FileUp, Loader2, CheckCircle2, X } from 'lucide-react';
import { useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const SurveyorCard = ({ name, count, onClick }) => (
    <motion.div 
        whileHover={{ y: -8, scale: 1.01 }}
        onClick={() => onClick(name)}
        className="bg-[#F3F4F6] border border-transparent hover:border-blue-200 rounded-[2rem] p-8 shadow-[0_15px_40px_rgba(0,0,0,0.02)] hover:shadow-[0_25px_60px_rgba(37,99,235,0.08)] cursor-pointer transition-all relative group overflow-hidden flex flex-col justify-between min-h-[220px]"
    >
        {/* Diagonal Animation Background */}
        <div className="absolute top-0 right-0 w-full h-full bg-blue-600/10 -translate-y-full translate-x-full group-hover:translate-y-[-40%] group-hover:translate-x-[40%] rotate-45 transition-transform duration-700 pointer-events-none" />
        
        <div>
            <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                    <Users className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
                </div>
                <div className="bg-black text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest z-10">
                    {count} {count === 1 ? 'SURVEYS' : 'SURVEYS'}
                </div>
            </div>
            
            <h3 className="text-lg font-black text-gray-900 leading-tight uppercase tracking-tight mb-2 group-hover:text-blue-700 transition-colors">
                {name}
            </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#B45309] mt-4 group-hover:translate-x-1 transition-transform">
            Generate Salary Slip
            <ChevronRight className="w-3.5 h-3.5" />
        </div>
    </motion.div>
);

const Home = ({
    loading,
    setLoading,
    result,
    setResult,
    formData,
    setFormData,
    file,
    setFile
}) => {
    console.log("DEBUG: Home.jsx Version [v1.0.1] - Port: 8000, FormData: Robust");
    const [uid, setUid] = useState('');
    const [activeTab, setActiveTab] = useState('audit');
    const [surveyors, setSurveyors] = useState([]);
    const [selectedSurveyor, setSelectedSurveyor] = useState(null);
    const [payrollData, setPayrollData] = useState(null);
    const [payrollExcelRows, setPayrollExcelRows] = useState(null);
    const [payrollExcelLoading, setPayrollExcelLoading] = useState(false);
    const [xlsxLib, setXlsxLib] = useState(null);
    const [isBulkView, setIsBulkView] = useState(false);
    const [allSlips, setAllSlips] = useState([]);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [payrollHistory, setPayrollHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedBulkIndex, setSelectedBulkIndex] = useState(null);
    const payrollInputRef = useRef(null);

    // Load SheetJS and Payroll Data
    React.useEffect(() => {
        // SheetJS
        const script = document.createElement("script");
        script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        script.async = true;
        script.onload = () => { if (window.XLSX) setXlsxLib(window.XLSX); };
        document.head.appendChild(script);

        // Fetch Surveyors for Card View
        fetchSurveyors(false);
        fetchPayrollHistory();
    }, []);

    const fetchPayrollHistory = async () => {
        try {
            const res = await axios.get(`${API_BASE}/payroll-history`);
            setPayrollHistory(res.data);
        } catch (e) {
            console.error("Error fetching payroll history", e);
        }
    };

    const handleSaveSlip = async (data) => {
        try {
            await axios.post(`${API_BASE}/save-salary-slip`, {
                surveyor_name: data.surveyor_name,
                month_year: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                net_salary: data.net_salary,
                total_surveys: data.particulars[0]?.achieved || 0,
                full_slip_json: data
            });
            alert("Salary slip saved to history!");
            fetchPayrollHistory();
        } catch (e) {
            alert("Error saving salary slip.");
        }
    };

    const handlePayrollExcelUpload = (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;
        if (!xlsxLib) {
            alert("Excel library still loading... please try again in a second.");
            return;
        }

        setPayrollExcelLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = xlsxLib.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = xlsxLib.utils.sheet_to_json(worksheet, { header: 1 });
                
                const surveyorMap = {};
                if (!rows || rows.length <= 1) {
                    alert("Excel file seems empty or missing data rows.");
                    return;
                }

                rows.forEach((row, rowIndex) => {
                    let name = "";
                    let uid = "";

                    for (let i = 0; i < Math.min(row.length, 15); i++) {
                        const cell = String(row[i] || "").trim();
                        if (!cell) continue;

                        if (cell.includes("{") && cell.includes("}")) {
                            const nameRegexMatch = cell.match(/"surveyor":\s*"([^"]+)"/i);
                            if (nameRegexMatch && !name) name = nameRegexMatch[1];
                            try {
                                const jsonMatch = cell.match(/\{.*\}/);
                                if (jsonMatch) {
                                    const rowData = JSON.parse(jsonMatch[0]);
                                    const extName = rowData.SURVEYOR || rowData.surveyor || rowData.Surveyor;
                                    const extUid = rowData.UID || rowData.uid || rowData.Uid || rowData.id1;
                                    if (extName && !name) name = extName;
                                    if (extUid && !uid) uid = String(extUid).split('.')[0];
                                }
                            } catch (e) {}
                        }
                        if (!uid && cell.match(/^\d{3,12}$/)) uid = cell.split('.')[0];
                        if (!name && cell.length >= 3 && !cell.match(/^\d+$/)) {
                            const low = cell.toLowerCase();
                            const isNoise = ["name", "surveyor", "id", "audit", "surveory", "survey", "not provided", "undefined"].includes(low);
                            if (!isNoise && !cell.includes("{") && !cell.includes("[")) name = cell;
                        }
                    }

                    if (name) {
                        if (name.includes(" - ")) name = name.split(" - ").pop();
                        name = name.replace(/[()"]/g, "").trim();
                    }
                    if (!name && uid) name = `Surveyor #${uid}`;

                    if (name) {
                        if (!surveyorMap[name]) surveyorMap[name] = { name, uid: uid || "Unknown", count: 0, surveys: [] };
                        surveyorMap[name].count++;
                        let rawObj = {};
                        for (let i = 0; i < Math.min(row.length, 15); i++) {
                            const cell = String(row[i] || "");
                            if (cell.includes("{") && cell.includes("}")) {
                                try {
                                    const match = cell.match(/\{.*\}/);
                                    if (match) rawObj = JSON.parse(match[0]);
                                } catch (e) {}
                            }
                        }
                        surveyorMap[name].surveys.push({ uid: uid || "Unknown", raw: rawObj });
                    }
                });

                setPayrollExcelRows(Object.values(surveyorMap));
            } catch (err) {
                console.error("Excel Parsing Error:", err);
            } finally {
                setPayrollExcelLoading(false);
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    };

    const handleGenerateAllSlips = async () => {
        const targetList = payrollExcelRows || surveyors;
        if (!targetList.length) return;

        setIsBulkView(true);
        setAllSlips([]);
        setSelectedBulkIndex(null);
        setBulkProgress({ current: 0, total: targetList.length });

        try {
            const promises = targetList.map((s, idx) => {
                const payload = { surveyor_name: s.name, surveys: s.surveys || [] };
                return axios.post(`${API_BASE}/surveyor-payroll`, payload, { timeout: 40000 })
                .then(res => {
                    setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
                    return res.data;
                })
                .catch(err => {
                    setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
                    return null; 
                });
            });

            const results = await Promise.all(promises);
            const processedResults = results.map((r, idx) => {
                if (r) return r;
                return { 
                    surveyor_name: targetList[idx].name, 
                    isError: true,
                    particulars: [], earnings: [], deductions: [], total_earnings: 0, total_deductions: 0, net_salary: 0
                };
            });
            setAllSlips(processedResults);
        } catch (err) {
            console.error("Bulk generation error:", err);
        }
    };

    const fetchSurveyors = async (switchToTab = true) => {
        if (switchToTab) setActiveTab('payroll');
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/surveyors`);
            setSurveyors(res.data);
        } catch (err) {
            console.error("Error fetching surveyors", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSurveyorClick = async (name) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/surveyor-payroll/${encodeURIComponent(name)}`);
            setPayrollData(res.data);
            setSelectedSurveyor(name);
        } catch (err) {
            alert("Error fetching payroll data.");
        } finally {
            setLoading(false);
        }
    };

    const clearForm = () => {
        setFormData({ name: '', age: '', profession: '', education: '', location: '', mobile: '' });
        setFile(null);
        setResult(null);
        setUid('');
    };

    const handleFetchUid = async (fetchUid) => {
        if (!fetchUid) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/fetch-uid/${fetchUid}`);
            setFormData(res.data.form_data);
            setUid(fetchUid);
        } catch (err) {
            alert(err.response?.data?.detail || "UID not found.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e, directUid = null) => {
        e.preventDefault();
        const targetUid = directUid || uid;
        if (targetUid && !file) {
            setLoading(true);
            try {
                const res = await axios.post(`${API_BASE}/process-uid`, { uid: targetUid }, { timeout: 1800000 });
                setResult(res.data);
                // Refresh surveyors after audit
                fetchSurveyors(false);
                if (res.data.audit_result?.status === 'Match' || res.data.audit_result?.z_audit?.score >= 8) {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                }
            } catch (err) {
                alert(err.response?.data?.detail || "Error processing UID.");
            } finally {
                setLoading(false);
            }
            return;
        }

        if (!file || !formData.name || !formData.age) return;
        setLoading(true);
        const data = new FormData();
        Object.entries(formData).forEach(([k, v]) => data.append(k, v));
        data.append('audio', file);
        if (targetUid) data.append('uid', targetUid);

        try {
            const res = await axios.post(`${API_BASE}/upload-survey`, data);
            setResult(res.data);
            fetchSurveyors(false);
            if (res.data.audit_result?.status === 'Match') {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            const errorMsg = err.response?.data?.detail || err.response?.data || "Error uploading survey.";
            alert(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto px-4">
            {/* Tab Navigation */}
            <div className="flex justify-center mb-12">
                <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner border border-gray-200">
                    <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${activeTab === 'audit' ? 'bg-black text-white' : 'text-gray-500'}`}>
                        <FileText className="w-4 h-4" /> Security Audit
                    </button>
                    <button onClick={() => fetchSurveyors(true)} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${activeTab === 'payroll' ? 'bg-black text-white' : 'text-gray-500'}`}>
                        <Users className="w-4 h-4" /> Surveyor Payroll
                    </button>
                </div>
            </div>

            {activeTab === 'audit' ? (
                <>
                    <h1 className="text-5xl font-black text-black mb-4 tracking-tighter text-center uppercase">AI Survey Audit System</h1>
                    <p className="text-gray-500 text-lg mb-14 text-center">Automated verification for surveyor honesty and data quality.</p>
                    <SurveyForm formData={formData} setFormData={setFormData} file={file} setFile={setFile} handleUpload={handleUpload} loading={loading} clearForm={clearForm} uid={uid} handleFetchUid={handleFetchUid} />
                    <AuditResult result={result} formAge={formData.age} formName={formData.name} formProfession={formData.profession} formEducation={formData.education} formLocation={formData.location} formMobile={formData.mobile} audioFile={file} />
                    <FeatureHighlights />
                </>
            ) : (
                <div className="space-y-8 pb-20">
                    {loading && (
                        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black">Processing Payroll Data...</p>
                        </div>
                    )}
                    <div className="text-center mb-12 flex justify-between items-end">
                        <div className="text-left">
                            <h1 className="text-5xl font-black text-black mb-2 tracking-tighter uppercase">Surveyor Payroll</h1>
                            <p className="text-gray-400 text-xs font-black uppercase tracking-[0.2em]">Automated Compensation Tracking</p>
                        </div>
                        <div className="flex gap-4">
                             <button onClick={() => setShowHistory(!showHistory)} className="bg-white border border-gray-200 text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2 cursor-pointer">
                                {showHistory ? "Back to Live List" : "View History"}
                             </button>
                             {!selectedSurveyor && !isBulkView && (
                                <div className="flex items-center bg-gray-100 rounded-xl p-1 px-3 border border-gray-200 cursor-pointer">
                                    <input type="file" id="xl-up" ref={payrollInputRef} className="hidden" accept=".xlsx" onChange={handlePayrollExcelUpload} />
                                    <label htmlFor="xl-up" className="text-[9px] cursor-pointer font-black uppercase tracking-widest px-4">Upload Multi-Survey File</label>
                                    {payrollExcelRows && <button onClick={() => handleGenerateAllSlips()} className="bg-black text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] cursor-pointer">Generate Group</button>}
                                </div>
                             )}
                        </div>
                    </div>

                    {showHistory ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {payrollHistory.map((item, i) => (
                                <motion.div key={i} className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
                                     <div className="absolute top-0 right-0 bg-black text-white text-[8px] font-black px-4 py-1 uppercase tracking-widest">SAVED</div>
                                     <h3 className="text-lg font-black uppercase mb-1">{item.surveyor_name}</h3>
                                     <p className="text-gray-400 text-[10px] font-bold uppercase mb-4">{item.month_year}</p>
                                     <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl mb-6">
                                         <div>
                                             <p className="text-[8px] font-black text-gray-400 uppercase">Net Salary</p>
                                             <p className="text-xl font-black text-black">₹{item.net_salary}</p>
                                         </div>
                                         <div className="text-right">
                                             <p className="text-[8px] font-black text-gray-400 uppercase">Total Audits</p>
                                             <p className="text-sm font-black text-black">{item.total_surveys}</p>
                                         </div>
                                     </div>
                                     <button onClick={() => { setPayrollData(item.full_slip_json); setSelectedSurveyor(item.surveyor_name); setShowHistory(false); }} className="w-full py-3 border-2 border-black text-black hover:bg-black hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer">Re-View Slip</button>
                                </motion.div>
                            ))}
                        </div>
                    ) : !selectedSurveyor && !isBulkView ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {surveyors.map((s, i) => (
                                <SurveyorCard key={i} name={s.name} count={s.count} onClick={handleSurveyorClick} />
                            ))}
                            <div className="border-4 border-dashed border-gray-100 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center opacity-40 hover:opacity-100 transition-opacity">
                                <FileUp className="w-10 h-10 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Automatic Scan Active</p>
                                <p className="text-xs font-bold text-gray-400 mt-2">New surveyors will appear here after audit completion.</p>
                            </div>
                        </div>
                    ) : isBulkView ? (
                        <div className="pb-20">
                            {selectedBulkIndex !== null ? (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <div className="flex justify-between items-center mb-10">
                                        <button onClick={() => setSelectedBulkIndex(null)} className="bg-gray-100 hover:bg-gray-200 text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 cursor-pointer">
                                            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Group Results
                                        </button>
                                        <button onClick={() => handleSaveSlip(allSlips[selectedBulkIndex])} className="bg-black text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all cursor-pointer">Save to Payroll Records</button>
                                    </div>
                                    <SalarySlip data={allSlips[selectedBulkIndex]} />
                                </motion.div>
                            ) : (
                                <div className="space-y-10">
                                    <div className="flex justify-between items-center">
                                        <button onClick={() => { setIsBulkView(false); setAllSlips([]); }} className="bg-gray-100 hover:bg-gray-200 text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 cursor-pointer">
                                            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Surveyor List
                                        </button>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Group Audit Results</p>
                                            <p className="text-sm font-black text-black">Generated {allSlips.length} Slips</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {allSlips.map((item, i) => (
                                            <motion.div 
                                                key={i} 
                                                whileHover={{ y: -8 }}
                                                onClick={() => setSelectedBulkIndex(i)}
                                                className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm relative overflow-hidden cursor-pointer group"
                                            >
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div className="bg-green-500 text-white text-[8px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">READY</div>
                                                </div>
                                                
                                                <h3 className="text-lg font-black uppercase mb-1">{item.surveyor_name}</h3>
                                                <p className="text-gray-400 text-[10px] font-bold uppercase mb-6">Generated Result</p>
                                                
                                                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl mb-6 group-hover:bg-gray-100 transition-colors">
                                                    <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase">Net Payable</p>
                                                        <p className="text-xl font-black text-black">₹{item.net_salary}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase">Status</p>
                                                        <p className="text-[10px] font-black text-green-600 uppercase">Calculation Success</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#B45309]">
                                                    View Detailed Slip
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <div className="flex justify-between items-center mb-10">
                                <button onClick={() => setSelectedSurveyor(null)} className="bg-gray-100 hover:bg-gray-200 text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 cursor-pointer">
                                    <ChevronRight className="w-4 h-4 rotate-180" /> Back to History
                                </button>
                                <button onClick={() => handleSaveSlip(payrollData)} className="bg-black text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all cursor-pointer">Save to Payroll Records</button>
                            </div>
                            {payrollData && <SalarySlip data={payrollData} />}
                        </motion.div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default Home;