import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const UnauthorizedPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
            <div className="w-24 h-24 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert size={48} />
            </div>
            
            <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-4 tracking-tight">Access Denied</h1>
            
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mb-8">
                You are currently logged in as an Elder, so you cannot access the Family Dashboard. 
                If you want to view the Family Dashboard, please log out and sign in with a Family account!
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all"
                >
                    Go to Elder Dashboard
                </button>
                <button 
                    onClick={() => navigate('/auth/login')}
                    className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-bold rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 justify-center"
                >
                    <ArrowLeft size={20} /> Logout / Switch Account
                </button>
            </div>
        </div>
    );
};

export default UnauthorizedPage;
