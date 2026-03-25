import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";

// Component Imports
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import History from "./pages/History";

function App() {
  // Lifted Home State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    profession: "",
    education: "",
    location: "",
    mobile: "",
  });
  const [file, setFile] = useState(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="w-[80vw] max-w-[1600px] mt-24 mx-auto px-6 grow mb-20">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                loading={loading}
                setLoading={setLoading}
                result={result}
                setResult={setResult}
                formData={formData}
                setFormData={setFormData}
                file={file}
                setFile={setFile}
              />
            }
          />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>

      <footer className="w-[80vw] max-w-[1600px] mx-auto px-6 pt-12 border-t border-border-muted flex justify-between items-center text-xs font-semibold text-text-light pb-8">
        <div>© 2026 AI Survey Audit System.Developed at ZEEX AI.</div>
        <div className="flex gap-8">
          <span className="cursor-pointer hover:text-text-dark transition-colors">
            Privacy Policy
          </span>
          <span className="cursor-pointer hover:text-text-dark transition-colors">
            Terms of Service
          </span>
          <span className="cursor-pointer hover:text-text-dark transition-colors">
            Support
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
