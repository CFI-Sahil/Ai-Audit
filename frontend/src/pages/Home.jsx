import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

// Component Imports
import SurveyForm from '../components/SurveyForm';
import AuditResult from '../components/AuditResult';
import FeatureHighlights from '../components/FeatureHighlights';
import SalarySlip from '../components/SalarySlip';
import { Users, FileText, ChevronRight } from 'lucide-react';

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

        if (targetUid) {
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

        // Standard Manual Flow
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
                        onClick={fetchSurveyors}
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

                    {!selectedSurveyor ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {surveyors.map((s, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    onClick={() => handleSurveyorClick(s.name)}
                                    className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[5rem] -mr-16 -mt-16 group-hover:bg-blue-600 transition-colors duration-500" />
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Users className="w-8 h-8 text-black" />
                                            </div>
                                            <span className="bg-black text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                                                {s.count} Surveys
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 group-hover:text-blue-600 transition-colors">{s.name}</h3>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <span>Generate Salary Slip</span>
                                            <ChevronRight className="w-4 h-4 text-[#FF4D4D] group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <button
                                onClick={() => setSelectedSurveyor(null)}
                                className="mb-10 text-[10px] font-black uppercase tracking-widest text-black hover:text-gray-400 flex items-center gap-3 transition-all group"
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