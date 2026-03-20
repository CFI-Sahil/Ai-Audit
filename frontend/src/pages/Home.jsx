import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

// Component Imports
import SurveyForm from '../components/SurveyForm';
import AuditResult from '../components/AuditResult';
import FeatureHighlights from '../components/FeatureHighlights';

const API_BASE = 'http://localhost:8000';

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

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
        >
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
        </motion.div>
    );
};

export default Home;
