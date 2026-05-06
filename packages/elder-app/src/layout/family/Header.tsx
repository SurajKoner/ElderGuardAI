import { Bell, Search, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@elder-nest/shared";
import { useNavigate } from "react-router-dom";
import { useConnectedElders } from "@/hooks/useElderData";

export const Header = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/auth/login');
    };

    const { elders } = useConnectedElders();
    const currentElder = elders[0]; // For now, show the first connected elder's status

    return (
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="Go Back">
                    <ArrowLeft size={20} className="text-gray-600" />
                </Button>
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-gray-700">Dashboard</h2>
                    {currentElder && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium hidden sm:inline-block">
                            {currentElder.name} is {currentElder.connectionStatus === 'online' ? 'Online' : 'Offline'}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon">
                    <Search size={20} className="text-gray-500" />
                </Button>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell size={20} className="text-gray-500" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                    <LogOut size={20} className="text-gray-500 hover:text-red-500 transition-colors" />
                </Button>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                    JD
                </div>
            </div>
        </header>
    )
}
