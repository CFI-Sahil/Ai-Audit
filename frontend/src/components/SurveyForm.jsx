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
  FileSpreadsheet,
  FileUp,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [excelRows, setExcelRows] = useState(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [xlsxLib, setXlsxLib] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const handleExcelUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile || !xlsxLib) return;

    setExcelLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = xlsxLib.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = xlsxLib.utils.sheet_to_json(worksheet, { header: 1 });
        setExcelRows(rows);
        showToast("Excel data loaded successfully!");
      } catch (err) {
        console.error("Excel Parsing Error:", err);
        showToast("Failed to parse Excel file", "error");
      } finally {
        setExcelLoading(false);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleManualAutoFill = () => {
    const searchUid = uidInput.trim();
    if (!searchUid) return;

    // 1. Try local Excel data first
    if (excelRows) {
      for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];
        // Check first 3 columns for UID
        let match = false;
        for (let col = 0; col < Math.min(row.length, 3); col++) {
          const cellVal = String(row[col] || "").trim().split(".")[0];
          if (cellVal === searchUid) {
            match = true;
            break;
          }
        }

        if (match) {
          try {
            // Find JSON column (typically index 2 based on backend logic)
            const jsonStr = String(row[2] || "{}");
            const data = JSON.parse(jsonStr);
            const regDetails = data.registration_details || [];
            
            const newForm = { ...formData };
            regDetails.forEach(entry => {
              const val = String(entry[entry.length > 2 ? 1 : 0] || "").trim();
              const label = String(entry[entry.length > 2 ? 2 : 1] || "").trim().toUpperCase();

              if (["FR NAME", "NAME", "NAME OF THE RESPONDENT", "FULL NAME", "RESPONDENT NAME"].includes(label)) {
                newForm.name = val;
              } else if (["MOBILE NUMBER", "MOBILE", "PHONE"].includes(label)) {
                newForm.mobile = val;
              } else if (["AREA", "LOCATION", "VILLAGE", "DISTRICT"].includes(label)) {
                newForm.location = val;
              } else if (["OCCUPATION", "PROFESSION", "WORK"].includes(label)) {
                newForm.profession = val;
              } else if (["DOB", "DATE OF BIRTH"].includes(label)) {
                try {
                  const yearMatch = val.match(/\d{4}/);
                  if (yearMatch) newForm.age = String(2026 - parseInt(yearMatch[0]));
                } catch (e) {}
              }
            });
            
            if (!newForm.name || newForm.name.toLowerCase().includes("surveyor")) {
              newForm.name = "Not Provided";
            }
            
            setFormData(newForm);
            showToast(`Form auto-filled for UID: ${searchUid}`);
            return;
          } catch (e) {
            console.error("Local mapping error:", e);
            showToast("Error mapping Excel data", "error");
          }
        }
      }
    }

    // 2. Fallback to backend fetch
    handleFetchUid(searchUid);
  };

  // Validation Logic
  const validateName = (name) => name.trim().length >= 2;
  const validateAge = (age) => {
    const val = String(age || "").trim();
    if (!val) return false;
    const isNumeric = /^\d+$/.test(val);
    if (isNumeric) return val.length === 2;
    return val.length > 0;
  };
  const validateProfession = (prof) => prof.trim().length >= 4;
  const validateEducation = (edu) => edu.trim().length >= 2;
  const validateLocation = (loc) => loc.trim().length >= 2;
  const validateMobile = (mob) => {
    const val = String(mob || "").trim();
    if (!val) return false;
    const isNumeric = /^\d+$/.test(val);
    if (isNumeric) return val.length === 10;
    return val.length > 0;
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
    <div className="flex flex-col gap-6 mb-8">
      {/* RESTACKED UID & EXCEL SECTION */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Excel Upload Hub (Now on the Left) */}
        <div className="flex-1 flex items-center bg-white rounded-2xl p-2 pr-4 border border-border-muted shadow-sm w-full md:w-auto transition-all hover:bg-gray-50">
          <input
            type="file"
            id="excel-upload"
            className="hidden"
            accept=".xlsx, .xls, .csv"
            onChange={handleExcelUpload}
          />
          <label
            htmlFor="excel-upload"
            className="flex items-center gap-3 cursor-pointer py-2 px-5 rounded-xl transition-all w-full"
          >
            <div className={`p-2 rounded-lg ${excelRows ? 'bg-green-100 text-green-600' : 'bg-accent/10 text-accent'}`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-text-dark uppercase tracking-wider mb-0.5">
                {excelRows ? "Excel Data Loaded" : "Upload Local Excel"}
              </p>
              <p className="text-[10px] font-medium text-gray-500 truncate max-w-[150px]">
                {excelRows ? "Local parsing active" : "Support .xlsx, .csv"}
              </p>
            </div>
            {excelLoading ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            ) : (
              <FileUp className="w-4 h-4 text-gray-400" />
            )}
          </label>
        </div>

        {/* UID Box (Now on the Right) - Matched to form input style */}
        <div className="flex bg-white rounded-2xl p-2 pl-6 items-center w-full md:w-[450px] border border-border-muted shadow-sm transition-all focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(0,0,0,0.05)] group">
          <Search className="text-accent w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
          <input
            type="text"
            placeholder="Search Survey UID to Auto-Fill..."
            className="bg-transparent border-none text-text-dark focus:outline-none focus:ring-0 px-0 flex-1 placeholder:text-gray-400 font-bold text-base tracking-wide"
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleManualAutoFill();
              }
            }}
          />
          <button
            type="button"
            className="bg-accent text-white py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white hover:text-accent border-2 border-accent transition-all shadow-md active:shadow-sm cursor-pointer"
            onClick={handleManualAutoFill}
          >
            Auto-Fill
          </button>
        </div>
      </div>

      {/* CUSTOM TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: -20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: -20 }}
            className={`fixed bottom-6 left-6 z-[9999] flex items-center gap-3 py-4 px-6 rounded-2xl shadow-2xl border ${
              toast.type === "error" 
                ? "bg-red-50 border-red-200 text-red-600" 
                : "bg-green-50 border-green-200 text-green-600"
            }`}
          >
            <div className={`p-1.5 rounded-full ${toast.type === "error" ? "bg-red-100" : "bg-green-100"}`}>
              {toast.type === "error" ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <X className="w-4 h-4 opacity-40" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden text-left border border-border-muted">
        <div className="bg-accent text-white py-7 px-10">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight">New Audit Entry</h2>
          <p className="text-sm font-medium opacity-80">
            Please provide accurate participant metadata for auditor verification
          </p>
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
                    setFormData({ ...formData, age: e.target.value });
                  }}
                  required={!activeUid}
                />
                {formData.age && !validateAge(formData.age) && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1">
                    2 digits if numeric, or any other characters
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
                    setFormData({ ...formData, mobile: e.target.value });
                  }}
                  required={!activeUid}
                />
                {formData.mobile && !validateMobile(formData.mobile) && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest pl-1 leading-tight">
                    10 digits if numeric, or any other characters
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
                    : "Upload survey audio manually"}
                </h4>
                <p className="text-xs text-slate-500 font-medium tracking-tight">
                  {file ? "File ready for audit" : "MP3, WAV, or AAC (Max 50MB)"}
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
    </div>
);
};

export default SurveyForm;
