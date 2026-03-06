import React from 'react';
import { Shield, BarChart } from 'lucide-react';

const FeatureHighlights = () => {
    return (
        <div className="grid grid-cols-3 gap-6 mt-12">
            <div className="bg-white p-8 px-6 rounded-2xl border border-border-muted text-left transition-transform duration-200 hover:-translate-y-1.5 hover:shadow-lg">
                <div className="w-11 h-11 bg-[#ebfcfd] rounded-xl flex items-center justify-center mb-6">
                    <Shield className="text-accent w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-text-dark mb-3">Identity Verification</h4>
                <p className="text-sm text-text-medium leading-relaxed">AI cross-references voice patterns with participant data to ensure authenticity.</p>
            </div>
            <div className="bg-white p-8 px-6 rounded-2xl border border-border-muted text-left transition-transform duration-200 hover:-translate-y-1.5 hover:shadow-lg">
                <div className="w-11 h-11 bg-[#ebfcfd] rounded-xl flex items-center justify-center mb-6">
                    <BarChart className="text-accent w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-text-dark mb-3">Quality Scoring</h4>
                <p className="text-sm text-text-medium leading-relaxed">Automated quality check for audio clarity, background noise, and completeness.</p>
            </div>
            <div className="bg-white p-8 px-6 rounded-2xl border border-border-muted text-left transition-transform duration-200 hover:-translate-y-1.5 hover:shadow-lg">
                <div className="w-11 h-11 bg-[#ebfcfd] rounded-xl flex items-center justify-center mb-6">
                    <Shield className="text-accent w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-text-dark mb-3">Data Encryption</h4>
                <p className="text-sm text-text-medium leading-relaxed">All recordings are encrypted in transit and at rest, following GDPR guidelines.</p>
            </div>
        </div>
    );
};

export default FeatureHighlights;
