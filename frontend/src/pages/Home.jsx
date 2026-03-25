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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8005';

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
    const payrollInputRef = useRef(null);

    // Load SheetJS dynamically via CDN
    React.useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        script.async = true;
        script.onload = () => {
            if (window.XLSX) {
                setXlsxLib(window.XLSX);
            }
        };
        document.head.appendChild(script);
    }, []);

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
                
                // Group by surveyor name
                const surveyorMap = {};
                if (!rows || rows.length <= 1) {
                    alert("Excel file seems empty or missing data rows.");
                    return;
                }

                console.log(`Starting deep scan of ${rows.length} rows...`);
                
                rows.forEach((row, rowIndex) => {
                    let bestName = "";
                    let bestUid = "";
                    let nameConfidence = 0; // 0: none, 1: text, 2: multi-word, 3: JSON-verified

                    // Deep Scanner (15 Columns)
                    for (let i = 0; i < Math.min(row.length, 15); i++) {
                        const cell = String(row[i] || "").trim();
                        if (!cell) continue;

                        // Check for JSON first (Highest Confidence)
                        if (cell.includes("{") && cell.includes("}")) {
                            try {
                                const jsonMatch = cell.match(/\{.*\}/);
                                if (jsonMatch) {
                                    const rowData = JSON.parse(jsonMatch[0]);
                                    const rawName = rowData.SURVEYOR || rowData.surveyor || rowData.Surveyor;
                                    const rawUid = rowData.UID || rowData.uid || rowData.Uid || rowData.id1;
                                    
                                    if (rawName) {
                                        let clean = rawName;
                                        if (clean.includes(" - ")) clean = clean.split(" - ").pop();
                                        clean = clean.replace(/[()"]/g, "").trim();
                                        if (clean.length >= 2) {
                                            bestName = clean;
                                            nameConfidence = 3;
                                        }
                                    }
                                    if (rawUid && !bestUid) bestUid = String(rawUid).split('.')[0];
                                }
                            } catch (e) {}
                        }

                        // ID Check (If not already found in JSON)
                        if (!bestUid && cell.match(/^\d{3,10}$/)) {
                            bestUid = cell.split('.')[0];
                        }

                        // Text Check (Only if confidence is low)
                        if (nameConfidence < 3 && cell.length >= 3 && !cell.match(/^\d+$/)) {
                            const low = cell.toLowerCase();
                            const isNoise = ["name", "surveyor", "id", "audit", "surveory", "survey", "not provided", "undefined"].includes(low);
                            const isLocation = ["village", "mumbai", "pune", "nagpur", "wardha", "dist", "taluka"].some(loc => low.includes(loc));
                            
                            if (!isNoise && !isLocation && !cell.includes("{")) {
                                let currentConf = cell.includes(" ") ? 2 : 1;
                                if (currentConf > nameConfidence) {
                                    bestName = cell.replace(/[()"]/g, "").trim();
                                    nameConfidence = currentConf;
                                }
                            }
                        }
                    }

                    if (bestName && nameConfidence > 0) {
                        console.log(`Row ${rowIndex + 1}: Identified [${bestName}] (Confidence: ${nameConfidence})`);
                        
                        if (!surveyorMap[bestName]) {
                            surveyorMap[bestName] = { name: bestName, uid: bestUid || "Unknown", count: 0, surveys: [] };
                        }
                        surveyorMap[bestName].count++;
                        
                        // Find the raw JSON for performance data
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
                        surveyorMap[bestName].surveys.push({ uid: bestUid || "Unknown", raw: rawObj });
                    }
                });

                const finalData = Object.values(surveyorMap);
                console.log("Digital Scanner Summary:", finalData);
                if (finalData.length === 0) {
                    alert("No valid surveyor data found in this file format.");
                } else {
                    // Optional: You could add a small notification here if you wanted
                }
                setPayrollExcelRows(finalData);
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
        setBulkProgress({ current: 0, total: targetList.length });

        try {
            // Process in parallel with new POST sync endpoint
            const promises = targetList.map((s, idx) => {
                const payload = {
                    surveyor_name: s.name,
                    surveys: s.surveys || []
                };
                console.log(`Generating payroll for ${s.name}:`, payload);
                
                return axios.post(`${API_BASE}/surveyor-payroll`, payload, {
                    timeout: 20000 
                })
                .then(res => {
                    setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
                    return res.data;
                })
                .catch(err => {
                    console.error(`Error for ${s.name}:`, err.response?.data || err.message);
                    setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
                    return null; 
                });
            });

            const results = await Promise.all(promises);
            const validSlips = results.filter(r => r !== null);
            setAllSlips(validSlips);
            
            if (validSlips.length === 0) {
                alert("Could not generate any slips. Please check if the name extraction is correct or if the names exist in the database.");
            }
        } catch (err) {
            console.error("Bulk generation critical error:", err);
        }
    };

    const fetchSurveyors = async () => {
        setActiveTab('payroll');
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
        setFormData({
            name: '', age: '', profession: '', education: '', location: '', mobile: ''
        });
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
            alert(err.response?.data?.detail || "UID not found or error fetching data.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e, directUid = null) => {
        e.preventDefault();

        const targetUid = directUid || uid;

        // If a manual file is provided, ALWAYS use the standard upload flow
        // The automated UI flow (/process-uid) should only be used if NO file is uploaded
        if (targetUid && !file) {
            // Process via UID
            setLoading(true);
            try {
                const res = await axios.post(`${API_BASE}/process-uid`, { uid: targetUid }, { timeout: 1800000 });
                setResult(res.data);
                if (res.data.audit_result?.status === 'Match' || res.data.audit_result?.z_audit?.score >= 8) {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#000000', '#808080', '#D1D5DB'] });
                }
            } catch (err) {
                alert(err.response?.data?.detail || "Error processing UID. Make sure backend is running.");
            } finally {
                setLoading(false);
            }
            return;
        }

        // Standard Manual Flow (and Fallback if File is Provided with UID)
        if (!file || !formData.name || !formData.age) return;

        setLoading(true);
        const data = new FormData();
        data.append('name', formData.name);
        data.append('age', formData.age);
        data.append('profession', formData.profession);
        data.append('education', formData.education);
        data.append('location', formData.location);
        data.append('mobile', formData.mobile);
        data.append('audio', file);
        if (targetUid) {
            data.append('uid', targetUid);
        }

        try {
            const res = await axios.post(`${API_BASE}/upload-survey`, data);
            setResult(res.data);
            if (res.data.audit_result?.status === 'Match') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#000000', '#808080', '#D1D5DB']
                });
            }

        } catch (err) {
            alert("Error uploading survey. Make sure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="max-w-7xl mx-auto px-4"
        >
            {/* Tab Navigation */}
            <div className="flex justify-center mb-12">
                <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner border border-gray-200">
                    <button 
                        onClick={() => setActiveTab('audit')}
                        className={`flex items-center gap-2 cursor-pointer px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'audit' ? 'bg-black text-white shadow-xl scale-[1.02]' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}
                    >
                        <FileText className="w-4 h-4" /> Security Audit
                    </button>
                    <button 
                        onClick={() => setActiveTab('payroll')}
                        className={`flex items-center gap-2 cursor-pointer px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'payroll' ? 'bg-black text-white shadow-xl scale-[1.02]' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}
                    >
                        <Users className="w-4 h-4" /> Surveyor Payroll
                    </button>
                </div>
            </div>

            {activeTab === 'audit' ? (
                <>
                    <h1 className="text-5xl font-black text-black mb-4 tracking-tighter text-center uppercase">AI Survey Audit System</h1>
                    <p className="text-text-medium text-lg mb-14 max-w-[600px] mx-auto text-center">
                        Submit survey details and audio recording for automated AI verification and sentiment analysis.
                    </p>

                    <SurveyForm
                        formData={formData}
                        setFormData={setFormData}
                        file={file}
                        setFile={setFile}
                        handleUpload={handleUpload}
                        loading={loading}
                        clearForm={clearForm}
                        uid={uid}
                        handleFetchUid={handleFetchUid}
                    />

                    <AuditResult
                        result={result}
                        formAge={formData.age}
                        formName={formData.name}
                        formProfession={formData.profession}
                        formEducation={formData.education}
                        formLocation={formData.location}
                        formMobile={formData.mobile}
                        audioFile={file}
                    />

                    <FeatureHighlights />
                </>
            ) : (
                <div className="space-y-8 pb-20">
                    <div className="text-center mb-12">
                        <h1 className="text-5xl font-black text-black mb-4 tracking-tighter uppercase">Surveyor Payroll</h1>
                        <p className="text-gray-500 text-lg font-bold uppercase tracking-wide">Performance & Compensation Dashboard</p>
                    </div>

                    {!selectedSurveyor && !isBulkView && (
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12 max-w-4xl mx-auto">
                            {/* Excel Upload Hub */}
                            <div className="flex-1 flex items-center bg-white rounded-2xl p-2 pr-4 border border-border-muted shadow-sm w-full transition-all hover:bg-gray-50">
                                <input
                                    type="file"
                                    id="payroll-excel-upload"
                                    ref={payrollInputRef}
                                    className="hidden"
                                    accept=".xlsx, .xls"
                                    onChange={handlePayrollExcelUpload}
                                />
                                <label
                                    htmlFor="payroll-excel-upload"
                                    className="flex items-center gap-3 cursor-pointer py-2 px-5 rounded-xl transition-all w-full"
                                >
                                    <div className={`p-2 rounded-lg ${payrollExcelRows ? 'bg-green-100 text-green-600' : 'bg-accent/10 text-accent'}`}>
                                        <FileSpreadsheet className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-xs font-black text-text-dark uppercase tracking-wider mb-0.5">
                                            {payrollExcelRows ? "Excel Data Loaded" : "Upload Local Excel"}
                                        </p>
                                        <p className="text-[10px] font-medium text-gray-500">
                                            {payrollExcelRows ? `${payrollExcelRows.length} surveyors found` : "Filter by surveyor file"}
                                        </p>
                                    </div>
                                    {payrollExcelLoading ? (
                                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                                    ) : (
                                        <FileUp className="w-4 h-4 text-gray-400" />
                                    )}
                                </label>
                            </div>

                            <button
                                onClick={handleGenerateAllSlips}
                                disabled={loading || isBulkView || !payrollExcelRows}
                                className="bg-black text-white py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 cursor-pointer"
                            >
                                {isBulkView && allSlips.length < bulkProgress.total ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-[#4ADE80]" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-4 h-4" />
                                        Generate Salary Slips
                                    </>
                                )}
                            </button>

                            {payrollExcelRows && (
                                <button
                                    onClick={() => {
                                        setPayrollExcelRows(null);
                                        if (payrollInputRef.current) {
                                            payrollInputRef.current.value = "";
                                        }
                                    }}
                                    className="p-4 bg-gray-100 rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}

                    {!selectedSurveyor && !isBulkView ? (
                        <div className="flex flex-col items-center justify-center p-20 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
                            <Users className="w-16 h-16 text-gray-200 mb-6" />
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                                {payrollExcelRows ? "Ready to generate" : "Please upload a surveyor file to begin"}
                            </p>
                        </div>
                    ) : isBulkView ? (
                        <div className="space-y-12 pb-20">
                            <div className="flex justify-between items-center mb-8">
                                <button
                                    onClick={() => setIsBulkView(false)}
                                    className="text-[10px] font-black uppercase tracking-widest text-black hover:text-gray-400 flex items-center gap-3 transition-all group cursor-pointer"
                                >
                                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-black group-hover:text-white transition-colors">
                                        <ChevronRight className="w-4 h-4 rotate-180" />
                                    </div>
                                    Back to List
                                </button>
                                {allSlips.length < bulkProgress.total && (
                                    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-gray-500">
                                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                        Generating Slips: {bulkProgress.current} / {bulkProgress.total}
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-12">
                                {allSlips.map((data, idx) => (
                                    <div key={idx} className="relative">
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-black px-6 py-1 rounded-full uppercase tracking-widest z-10 shadow-lg">
                                            Slip #{idx + 1}
                                        </div>
                                        <SalarySlip data={data} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <button
                                onClick={() => setSelectedSurveyor(null)}
                                className="mb-10 text-[10px] font-black uppercase tracking-widest text-black hover:text-gray-400 flex items-center gap-3 transition-all group cursor-pointer"
                            >
                                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-black group-hover:text-white transition-colors">
                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                </div>
                                Back to All Surveyors
                            </button>
                            {payrollData && <SalarySlip data={payrollData} />}
                        </motion.div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default Home;