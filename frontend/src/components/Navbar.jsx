import React from 'react';
import { BarChart, User } from 'lucide-react';

const Navbar = () => {
    return (
        <nav className="bg-white border-b border-border-muted flex justify-center py-2 shadow-sm">
            <div className="w-full max-w-[900px] px-6 flex justify-between items-center h-16">
                {/* Logo Section */}
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="border-2 border-accent p-1.5 rounded-lg flex items-center justify-center text-accent transition-transform group-hover:scale-105">
                        <BarChart className="w-5 h-5 fill-accent opacity-20" />
                        <BarChart className="w-5 h-5 absolute" />
                    </div>
                    <span className="font-extrabold text-xl text-text-dark tracking-tight">AI Audit System</span>
                </div>

                {/* Navigation Links */}
                <div className="flex items-center gap-1">
                    <button
                        className="text-sm font-bold px-5 py-2 rounded-lg transition-all text-accent bg-[#76D2DB0D]"
                    >
                        Dashboard
                    </button>

                    
                    {/* User Profile */}
                    <div className="ml-6 w-10 h-10 rounded-full bg-[#ebfcfd] border border-accent flex items-center justify-center text-accent transition-all hover:bg-accent hover:text-white cursor-pointer shadow-sm">
                        <User className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
