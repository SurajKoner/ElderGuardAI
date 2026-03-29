import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";

export const DashboardLayout = () => {
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden relative">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 lg:pb-6">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
            <MobileBottomNav />
        </div>
    )
}
