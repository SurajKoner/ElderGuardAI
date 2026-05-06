import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquareHeart, User, Pill, Settings, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const ElderSidebar = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    const menuItems = [
        { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/chat", label: "Talk to Mira", icon: MessageSquareHeart },
        { path: "/profile", label: "My Profile", icon: User },
        // Medicine could be a link if it has its own page, otherwise it's on dashboard
    ];

    const handleLogout = async () => {
        try {
            const { signOut } = await import("@elder-nest/shared");
            await signOut();
            window.location.href = '/auth/login';
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    return (
        <>
            {/* Mobile Toggle */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-4 right-4 z-[60] p-2 bg-indigo-600 text-white rounded-xl shadow-lg"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar Container */}
            <AnimatePresence>
                {(isOpen || window.innerWidth >= 1024) && (
                    <motion.aside 
                        initial={{ x: -300 }}
                        animate={{ x: 0 }}
                        exit={{ x: -300 }}
                        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl lg:shadow-none transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                    >
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="p-2 bg-indigo-600 rounded-xl">
                                    <MessageSquareHeart className="text-white" size={24} />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">ElderGuardAI</h1>
                            </div>

                            <nav className="space-y-2">
                                {menuItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link 
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setIsOpen(false)}
                                            className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${
                                                isActive 
                                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <item.icon size={24} />
                                            <span className="text-lg">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="mt-auto p-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                            <button 
                                onClick={handleLogout}
                                className="flex items-center gap-4 px-4 py-4 w-full rounded-2xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                            >
                                <LogOut size={24} />
                                <span className="text-lg">Log Out</span>
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Overlay for mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
};
