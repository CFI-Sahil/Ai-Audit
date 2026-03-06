import React from 'react';
import { User, Calendar, MapPin, Upload, Cloud, Send } from 'lucide-react';

const SurveyForm = ({ formData, setFormData, file, setFile, handleUpload, loading, clearForm }) => {
    return (
        <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(54,6,77,0.08)] overflow-hidden text-left mb-8">
            <div className="bg-accent text-text-dark py-7 px-10 flex items-center gap-5">
                <div>
                    <h2 className="text-2xl font-extrabold">New Audit Entry</h2>
                    <p className="text-sm font-medium opacity-80">Please provide accurate participant metadata</p>
                </div>
            </div>

            <div className="p-10">
                <form onSubmit={handleUpload}>
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-text-dark mb-2"><User className="text-accent w-4 h-4" /> Participant Name</label>
                            <input
                                type="text"
                                placeholder="e.g. John Doe"
                                className="w-full py-3 px-4 border-[1.5px] border-border-muted rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_4px_rgba(118,210,219,0.15)]"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-text-dark mb-2"><Calendar className="text-accent w-4 h-4" /> Age</label>
                            <input
                                type="number"
                                placeholder="Enter age"
                                className="w-full py-3 px-4 border-[1.5px] border-border-muted rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_4px_rgba(118,210,219,0.15)]"
                                value={formData.age}
                                onChange={e => setFormData({ ...formData, age: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="flex items-center gap-2 text-sm font-bold text-text-dark mb-2"><MapPin className="text-accent w-4 h-4" /> Location</label>
                        <input
                            type="text"
                            placeholder="City, Country"
                            className="w-full py-3 px-4 border-[1.5px] border-border-muted rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_4px_rgba(118,210,219,0.15)]"
                            value={formData.location || ''}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-text-dark mb-2"><Upload className="text-accent w-4 h-4" /> Upload Survey Audio</label>
                        <input
                            type="file"
                            id="audio-upload"
                            className="hidden"
                            onChange={e => setFile(e.target.files[0])}
                        />
                        <label htmlFor="audio-upload" className="border-2 border-dashed border-border-muted rounded-2xl py-16 px-8 text-center cursor-pointer bg-[#fdfdfa] transition-all hover:bg-[#f4fcfd] hover:border-accent block">
                            <div className="w-14 h-14 bg-[#f0f9fa] rounded-full flex items-center justify-center mx-auto mb-4">
                                <Cloud className="text-accent w-7 h-7" />
                            </div>
                            <h4 className="font-extrabold text-[#36064D] mb-1">
                                {file ? file.name : 'Drag & drop audio file'}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">MP3, WAV, or AAC (Max 50MB)</p>
                            <div className="mt-5 border border-[#76D2DB] rounded-lg px-6 py-2 inline-block text-sm font-bold text-[#36064D] bg-white hover:bg-[#76D2DB] transition-colors">
                                Browse Files
                            </div>
                        </label>
                    </div>

                    <div className="mt-10 flex gap-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-accent text-text-dark border-none rounded-xl py-4 px-10 font-extrabold text-lg flex items-center justify-center gap-3 cursor-pointer transition-all shadow-[0_6px_15px_rgba(118,210,219,0.3)] hover:bg-[#5ebec7] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(118,210,219,0.4)] flex-1"
                        >
                            {loading ? 'Processing Audit...' : (
                                <>Submit Survey for Audit <Send className="w-5 h-5 ml-1" /></>
                            )}
                        </button>
                        <button type="button" onClick={clearForm} className="bg-[#efede4] text-text-dark border-none rounded-xl py-4 px-8 font-bold cursor-pointer transition-colors hover:bg-[#e5e2d5]">Clear</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SurveyForm;
