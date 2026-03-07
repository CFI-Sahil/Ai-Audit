import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

const StatusBadge = ({ status }) => {
    const styles = {
        Match: 'bg-black text-white border-black',
        Mismatch: 'bg-white text-black border-black border-2',
        Inconclusive: 'bg-white text-gray-500 border-gray-300 border',
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${styles[status] || styles.Inconclusive}`}>
            {status}
        </span>
    );
};

const CheckRow = ({ label, formValue, detectedValue, status, timestamp }) => {
    const iconColor = {
        Match: 'text-black',
        Mismatch: 'text-black',
        Inconclusive: 'text-gray-400',
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
                <div className="flex flex-col items-center min-w-[100px]">
                    <StatusBadge status={status} />
                    {timestamp && (
                        <span className="text-[13px] text-slate-500 font-bold mt-1.5 tracking-tight bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            ({timestamp})
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const AuditResult = ({ result, formAge, formName, formProfession, formEducation, formDistrict }) => {
    if (!result) return null;

    const { audit_result, transcript } = result;
    const overallMatch = audit_result.status === 'Match';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden text-left mb-8 border-2 ${overallMatch ? 'border-black' : 'border-gray-200'}`}
        >
            {/* Header */}
            <div className={`px-8 py-5 flex items-center justify-between ${overallMatch ? 'bg-black text-white' : 'bg-gray-50'}`}>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <StatusBadge status={audit_result.status} />
                        <span className="text-xs text-slate-400 font-semibold">Overall Result</span>
                    </div>
                    <h3 className="font-black text-xl text-text-dark">AI Audit Report</h3>
                </div>
                {overallMatch ? (
                    <CheckCircle className="text-white w-14 h-14 shrink-0" />
                ) : audit_result.status === 'Inconclusive' ? (
                    <HelpCircle className="text-gray-300 w-14 h-14 shrink-0" />
                ) : (
                    <AlertCircle className="text-black w-14 h-14 shrink-0" />
                )}
            </div>

            {/* Checks */}
            <div className="px-8 py-2">
                <CheckRow
                    label="Name"
                    formValue={formName}
                    detectedValue={audit_result.detected_name}
                    status={audit_result.name_status || 'Inconclusive'}
                    timestamp={audit_result.timestamps?.name}
                />
                <CheckRow
                    label="Age"
                    formValue={formAge}
                    detectedValue={audit_result.detected_age}
                    status={audit_result.age_status || 'Inconclusive'}
                    timestamp={audit_result.timestamps?.age}
                />
                <CheckRow
                    label="Profession"
                    formValue={formProfession}
                    detectedValue={audit_result.detected_profession} 
                    status={audit_result.profession_status || 'Inconclusive'}
                    timestamp={audit_result.timestamps?.profession}
                />
                <CheckRow
                    label="Education"
                    formValue={formEducation}
                    detectedValue={audit_result.detected_education}
                    status={audit_result.education_status || 'Inconclusive'}
                    timestamp={audit_result.timestamps?.education}
                />
                <CheckRow
                    label="District"
                    formValue={formDistrict}
                    detectedValue={audit_result.detected_district}
                    status={audit_result.district_status || 'Inconclusive'}
                    timestamp={audit_result.timestamps?.district}
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
