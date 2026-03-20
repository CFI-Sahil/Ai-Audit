import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// Component Imports
import Navbar from './components/Navbar';
import SurveyForm from './components/SurveyForm';
import AuditResult from './components/AuditResult';
import FeatureHighlights from './components/FeatureHighlights';


const API_BASE = 'http://localhost:8000';

function App() {

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        age: '',
        profession: '',
        education: '',
        location: '',
        mobile: ''
    });
    const [file, setFile] = useState(null);
    const [history, setHistory] = useState([]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${API_BASE}/surveys`);
            setHistory(res.data);
        } catch (err) {
            console.error("Error fetching history", err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const clearForm = () => {
        setFormData({
            name: '',
            age: '',
            profession: '',
            education: '',
            location: '',
            mobile: ''
        });
        setFile(null);
        setResult(null);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
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
            if (res.data.audit_result.status === 'Match') {
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

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;
        try {
            await axios.delete(`${API_BASE}/surveys/${id}`);
            fetchHistory();
        } catch (err) {
            console.error("Delete error", err);
            alert("Error deleting record.");
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm("Are you sure you want to clear ALL history? This cannot be undone.")) return;
        try {
            await axios.delete(`${API_BASE}/surveys`);
            fetchHistory();
            alert("History cleared successfully!");
        } catch (err) {
            console.error("Clear all error", err);
            alert("Error clearing history.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />

            <main className="max-w-[900px] mt-24 mx-auto px-6 text-center w-full grow">
                <h1 className="text-5xl font-black text-black mb-4 tracking-tighter uppercase">AI Survey Audit System</h1>
                <p className="text-text-medium text-lg mb-14 max-w-[600px] mx-auto">
                    Submit survey details and audio recording for automated AI verification and sentiment analysis.
                </p>

                <AnimatePresence mode="wait">
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.4 }}
                    >
                        <SurveyForm
                            formData={formData}
                            setFormData={setFormData}
                            file={file}
                            setFile={setFile}
                            handleUpload={handleUpload}
                            loading={loading}
                            clearForm={clearForm}
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

                        {/* History Section */}
                        {history.length > 0 && !result && (
                            <div className="mt-20 text-left">
                                <h3 className="text-2xl font-black text-black uppercase tracking-tighter mb-8">Recent Audits</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {history.map((item) => (
                                        <div 
                                            key={item.id} 
                                            className="bg-white border border-gray-100 rounded-2xl p-6 flex justify-between items-center hover:border-black transition-all cursor-pointer group"
                                            onClick={() => setResult(item)}
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className="bg-black text-white w-12 h-12 rounded-xl flex items-center justify-center font-black">
                                                    {item.audit_result.status === 'Match' ? '✓' : '!'}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.timestamp}</p>
                                                    <h4 className="text-xl font-black text-black uppercase tracking-tight group-hover:underline">
                                                        {item.name} ({item.age})
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                                                    <p className={`text-sm font-black uppercase ${item.audit_result.status === 'Match' ? 'text-green-500' : 'text-red-500'}`}>
                                                        {item.audit_result.status}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                    className="bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 p-2 rounded-lg transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-10 flex justify-center">
                                    <button 
                                        onClick={handleClearAll}
                                        className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                                    >
                                        Clear All History
                                    </button>
                                </div>
                            </div>
                        )}

                        <FeatureHighlights />
                    </motion.div>
                </AnimatePresence>

                <footer className="mt-24 pt-12 border-t border-border-muted flex justify-between items-center text-xs font-semibold text-text-light pb-8">
                    <div>© 2024 AI Survey Audit System. All rights reserved.</div>
                    <div className="flex gap-8">
                        <span className="cursor-pointer hover:text-text-dark transition-colors">Privacy Policy</span>
                        <span className="cursor-pointer hover:text-text-dark transition-colors">Terms of Service</span>
                        <span className="cursor-pointer hover:text-text-dark transition-colors">Support</span>
                    </div>
                </footer>
            </main>
        </div>
    );
}

export default App;
