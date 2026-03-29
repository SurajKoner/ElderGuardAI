import React from 'react';
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Activity, Bell, User, Users } from "lucide-react";
import { cn } from "@elder-nest/shared";

export const MobileBottomNav = () => {
    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-16 flex items-center justify-around z-50 px-2 pb-safe">
            <NavLink 
                to="/family" 
                end
                className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                )}
            >
                <LayoutDashboard size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">Home</span>
            </NavLink>

            <NavLink 
                to="/family/activity" 
                className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                )}
            >
                <Activity size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">Activity</span>
            </NavLink>

            <NavLink 
                to="/family/alerts" 
                className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                )}
            >
                <Bell size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">Alerts</span>
            </NavLink>

            <NavLink 
                to="/family/profile" 
                className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                )}
            >
                <Users size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">Elder</span>
            </NavLink>

            <NavLink 
                to="/family/my-profile" 
                className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                    isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                )}
            >
                <User size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">You</span>
            </NavLink>
        </nav>
    );
};
