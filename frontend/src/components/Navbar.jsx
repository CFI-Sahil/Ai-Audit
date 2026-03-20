import React from "react";
import { BarChart, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border-muted flex justify-center py-2 shadow-sm transition-all duration-300">
      <div className="w-[80vw] max-w-[1600px] px-6 flex justify-between items-center h-16">
        {/* Logo Section */}
        <Link to="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="border-2 border-accent p-1.5 rounded-lg flex items-center justify-center text-accent transition-transform group-hover:scale-105">
            <BarChart className="w-5 h-5 fill-accent opacity-20" />
            <BarChart className="w-5 h-5 absolute" />
          </div>
          <span className="font-extrabold text-xl text-text-dark tracking-tight">
            AI Audit System
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          <Link
            to="/"
            className={`text-sm font-black px-5 py-2 rounded-lg transition-all ${
              location.pathname === "/"
                ? "bg-black text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Home
          </Link>
          <Link
            to="/history"
            className={`text-sm font-black px-5 py-2 rounded-lg transition-all ${
              location.pathname === "/history"
                ? "bg-black text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            History
          </Link>

          {/* User Profile */}
          <div className="ml-6 w-10 h-10 rounded-full bg-white border-2 border-accent flex items-center justify-center text-accent transition-all hover:bg-black hover:text-white cursor-pointer shadow-sm">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
