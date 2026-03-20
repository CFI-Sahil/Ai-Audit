import React, { useState } from "react";
import {
  User,
  Calendar,
  MapPin,
  Upload,
  Cloud,
  Send,
  Briefcase,
  GraduationCap,
  Map,
  Users,
  Loader2,
  CheckCircle2,
  Search,
} from "lucide-react";

const SurveyForm = ({
  formData,
  setFormData,
  file,
  setFile,
  handleUpload,
  loading,
  clearForm,
  uid,
  handleFetchUid,
}) => {
  const [uidInput, setUidInput] = useState("");

  // Validation Logic
  const validateName = (name) => name.trim().length >= 2;
  const validateAge = (age) => {
    const val = age.toString();
    return val.length >= 2 && val.length <= 3 && !isNaN(val);
  };
  const validateProfession = (prof) => prof.trim().length >= 4;
  const validateEducation = (edu) => edu.trim().length >= 2;
  const validateLocation = (loc) => loc.trim().length >= 2;
  const validateMobile = (mob) => {
    const val = mob.toString().replace(/\s/g, "");
    // User rule: starts with 7 is verified, 1-6 is invalid.
    // We'll allow 7, 8, 9 as they are typical Indian mobile starts.
    return val.length === 10 && /^[789]/.test(val);
  };

  const activeUid = uidInput.trim() || uid;
  const isFormValid = activeUid
    ? true
    : validateName(formData.name) &&
      validateAge(formData.age) &&
      validateProfession(formData.profession) &&
      validateEducation(formData.education) &&
      validateLocation(formData.location) &&
      validateMobile(formData.mobile) &&
      file;

  return (
    <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden text-left mb-8 border border-border-muted">
      <div className="bg-accent text-white py-7 px-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h2 className="text-2xl font-extrabold">New Audit Entry</h2>
          <p className="text-sm font-medium opacity-80">
            Please provide accurate participant metadata
          </p>
        </div>

        {/* UID Auto-Fill Section */}
        <div className="flex bg-white/10 rounded-xl p-2 pl-4 items-center w-full md:w-80 border border-white/20">
          <input
            type="text"
            placeholder="Enter Survey UID..."
            className="bg-transparent border-none text-white focus:outline-none focus:ring-0 px-0 flex-1 placeholder:text-white/60 font-medium tracking-wide"
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleFetchUid(uidInput);
              }
            }}
          />
          <button
            type="button"
            className="bg-white w-80 text-accent cursor-pointer hover:bg-white/90 font-bold px-4 py-2 rounded-lg text-sm transition-all"
            onClick={() => handleFetchUid(uidInput)}
          >
            Auto-Fill
          </button>
        </div>
      </div>

      <div className="p-10">
        <form
          onSubmit={(e) =>
            isFormValid ? handleUpload(e, activeUid) : e.preventDefault()
          }
        >
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
                <span className="flex items-center gap-2">
                  <User className="text-accent w-4 h-4" /> Participant Name
                </span>
                {validateName(formData.name) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                className={`w-full py-3 px-4 border-[1.5px] rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,0,0,0.1)] ${formData.name && !validateName(formData.name) ? "border-red-500" : "border-border-muted"}`}
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setFormData({ ...formData, name: val });
                }}
                required={!activeUid}
              />
              {formData.name && !validateName(formData.name) && (
                <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1">
                  Name must be at least 2 letters
                </p>
              )}
            </div>
            <div>
              <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
                <span className="flex items-center gap-2">
                  <Calendar className="text-accent w-4 h-4" /> Age
                </span>
                {validateAge(formData.age) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                )}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter age"
                className={`w-full py-3 px-4 border-[1.5px] rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,0,0,0.1)] ${formData.age && !validateAge(formData.age) ? "border-red-500" : "border-border-muted"}`}
                value={formData.age}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setFormData({ ...formData, age: val });
                }}
                required={!activeUid}
              />
              {formData.age && !validateAge(formData.age) && (
                <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1">
                  Age must be 2-3 digits
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
                <span className="flex items-center gap-2">
                  <Briefcase className="text-accent w-4 h-4" /> Profession /
                  Occupation
                </span>
                {validateProfession(formData.profession) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. Businessman"
                className={`w-full py-3 px-4 border-[1.5px] rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,0,0,0.1)] ${formData.profession && !validateProfession(formData.profession) ? "border-red-500" : "border-border-muted"}`}
                value={formData.profession}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setFormData({ ...formData, profession: val });
                }}
                required={!activeUid}
              />
              {formData.profession &&
                !validateProfession(formData.profession) && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1">
                    Profession must be at least 4 letters
                  </p>
                )}
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
                <span className="flex items-center gap-2">
                  <GraduationCap className="text-accent w-4 h-4" /> Education
                  Level
                </span>
                {validateEducation(formData.education) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. Graduate"
                className={`w-full py-3 px-4 border-[1.5px] rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,0,0,0.1)] ${formData.education && !validateEducation(formData.education) ? "border-red-500" : "border-border-muted"}`}
                value={formData.education}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setFormData({ ...formData, education: val });
                }}
                required={!activeUid}
              />
              {formData.education && !validateEducation(formData.education) && (
                <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1">
                  Education must be at least 2 letters
                </p>
              )}
            </div>
            <div>
              <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
                <span className="flex items-center gap-2">
                  <Map className="text-accent w-4 h-4" /> Location
                </span>
                {validateLocation(formData.location) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                className={`w-full py-3 px-4 border-[1.5px] rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,0,0,0.1)] ${formData.location && !validateLocation(formData.location) ? "border-red-500" : "border-border-muted"}`}
                value={formData.location}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setFormData({ ...formData, location: val });
                }}
                required={!activeUid}
              />
              {formData.location && !validateLocation(formData.location) && (
                <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1">
                  Location must be at least 2 letters
                </p>
              )}
            </div>
            <div>
              <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
                <span className="flex items-center gap-2">
                  <Users className="text-accent w-4 h-4" /> Mobile Number
                </span>
                {validateMobile(formData.mobile) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
                )}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 9876543210"
                className={`w-full py-3 px-4 border-[1.5px] rounded-xl text-text-dark transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,0,0,0.1)] ${formData.mobile && !validateMobile(formData.mobile) ? "border-red-500" : "border-border-muted"}`}
                value={formData.mobile}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData({ ...formData, mobile: val });
                }}
                required={!activeUid}
                maxLength={10}
              />
              {formData.mobile && !validateMobile(formData.mobile) && (
                <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1 leading-tight">
                  10 digits starting with 7, 8, or 9
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-bold text-text-dark mb-2">
              <span className="flex items-center gap-2">
                <Upload className="text-accent w-4 h-4" /> Upload Survey Audio
              </span>
              {(file || uid) && (
                <CheckCircle2 className="w-4 h-4 text-green-500 animate-in fade-in zoom-in" />
              )}
            </label>
            <input
              type="file"
              id="audio-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <label
              htmlFor="audio-upload"
              className="border-2 border-dashed border-border-muted rounded-2xl py-16 px-8 text-center cursor-pointer bg-white transition-all hover:bg-gray-50 hover:border-accent block"
            >
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud className="text-accent w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-text-dark mb-1">
                {file
                  ? file.name
                  : uid
                    ? `Audio loaded for UID: ${uid}`
                    : "Drag & drop audio file"}
              </h4>
              <p className="text-xs text-slate-500 font-medium tracking-tight">
                MP3, WAV, or AAC (Max 50MB)
              </p>
              <div className="mt-5 border-2 border-accent rounded-lg px-6 py-2 inline-block text-sm font-black text-text-dark bg-white hover:bg-accent hover:text-white transition-all">
                Browse Files
              </div>
            </label>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="bg-accent text-white border-2 border-accent rounded-xl py-4 px-10 font-black text-lg flex items-center justify-center gap-3 cursor-pointer transition-all shadow-lg hover:bg-white hover:text-accent hover:-translate-y-0.5 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Audit...</span>
                </div>
              ) : (
                <>
                  Submit Survey <Send className="w-5 h-5 ml-1" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="bg-white text-text-dark border-2 border-border-muted rounded-xl py-4 px-8 font-bold cursor-pointer transition-all hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SurveyForm;
