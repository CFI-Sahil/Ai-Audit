import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

const StatusBadge = ({ status }) => {
    const styles = {
        Match: 'bg-[#76D2DB1A] text-[#2b8c94] border-accent',
        Mismatch: 'bg-[#DA48481A] text-secondary border-secondary',
        Inconclusive: 'bg-[#f5f0f7] text-text-medium border-border-muted',
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${styles[status] || styles.Inconclusive}`}>
            {status}
        </span>
    );
};

const CheckRow = ({ label, formValue, detectedValue, status }) => {
    const iconColor = {
        Match: 'text-[#2b8c94]',
        Mismatch: 'text-secondary',
        Inconclusive: 'text-text-light',
    };
    const Icon = status === 'Match' ? CheckCircle : status === 'Mismatch' ? AlertCircle : HelpCircle;

    return (
        <div className="flex items-center justify-between py-3 border-b border-border-muted last:border-0">
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 shrink-0 ${iconColor[status] || iconColor.Inconclusive}`} />
                <span className="text-sm font-bold text-text-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase mb-0.5">Form</p>
                    <p className="font-bold text-text-dark">{formValue || '—'}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase mb-0.5">Detected</p>
                    <p className="font-bold text-text-dark">{detectedValue || '??'}</p>
                </div>
                <StatusBadge status={status} />
            </div>
        </div>
    );
};

const AuditResult = ({ result, formAge, formName }) => {
    if (!result) return null;

    const { audit_result, transcript } = result;
    const overallMatch = audit_result.status === 'Match';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-white rounded-2xl shadow-[0_10px_40px_rgba(54,6,77,0.08)] overflow-hidden text-left mb-8 border-2 ${overallMatch ? 'border-accent' : audit_result.status === 'Inconclusive' ? 'border-border-muted' : 'border-secondary'}`}
        >
            {/* Header */}
            <div className={`px-8 py-5 flex items-center justify-between ${overallMatch ? 'bg-[#76D2DB0D]' : audit_result.status === 'Inconclusive' ? 'bg-[#f9f8f5]' : 'bg-[#DA48480D]'}`}>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <StatusBadge status={audit_result.status} />
                        <span className="text-xs text-slate-400 font-semibold">Overall Result</span>
                    </div>
                    <h3 className="font-black text-xl text-text-dark">AI Audit Report</h3>
                </div>
                {overallMatch ? (
                    <CheckCircle className="text-[#2b8c94] w-14 h-14 shrink-0" />
                ) : audit_result.status === 'Inconclusive' ? (
                    <HelpCircle className="text-text-light w-14 h-14 shrink-0" />
                ) : (
                    <AlertCircle className="text-secondary w-14 h-14 shrink-0" />
                )}
            </div>

            {/* Checks */}
            <div className="px-8 py-2">
                <CheckRow
                    label="Name"
                    formValue={formName}
                    detectedValue={audit_result.detected_name}
                    status={audit_result.name_status || 'Inconclusive'}
                />
                <CheckRow
                    label="Age"
                    formValue={formAge}
                    detectedValue={audit_result.detected_age}
                    status={audit_result.age_status || 'Inconclusive'}
                />
            </div>

            {/* Transcript */}
            <div className="px-8 py-5 bg-[#fdfdfb] border-t border-border-muted">
                <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-wide">Transcription</p>
                <p className="text-slate-600 italic leading-relaxed text-sm">"{transcript}"</p>
            </div>
        </motion.div>
    );
};

export default AuditResult;
