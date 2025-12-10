
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck, Mail, AlertOctagon, CheckCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Effect to handle redirection AFTER user state is updated
  useEffect(() => {
    if (user) {
      if (user.role === 'driver') {
        navigate('/portal');
      } else {
        navigate('/');
      }
    }
  }, [user, navigate]);

  const handleAuth = async (emailToUse: string) => {
    setError(null);
    setIsProcessing(true);
    try {
      await loginWithGoogle(emailToUse);
      // Navigation is handled by the useEffect above once 'user' state changes
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && simEmail) {
        handleAuth(simEmail);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-indigo-900/20 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[100px]"></div>
        </div>

        <div className="bg-white/95 backdrop-blur-md relative z-10 w-full max-w-md rounded-[32px] shadow-2xl p-8 border border-white/20 ring-1 ring-white/50 animate-fade-in">
            <div className="flex flex-col items-center mb-10">
                <div className="h-20 px-6 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 transform rotate-3">
                    <span className="text-white font-black text-3xl tracking-tighter">ENCHO</span>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight text-center">Welcome Back</h1>
                <p className="text-slate-500 font-medium mt-2 text-sm">Secure Login Portal</p>
            </div>

            {error && (
                <div className="mb-6 bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
                    <AlertOctagon className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="text-sm text-rose-700 font-bold">Login Failed</p>
                        <p className="text-xs text-rose-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {!isSimulating ? (
                <div className="space-y-4">
                    <button 
                        onClick={() => setIsSimulating(true)}
                        className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 shadow-sm group"
                    >
                        {/* Google Logo SVG */}
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google
                    </button>
                    
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Authorized Access Only</span></div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-fade-in">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck size={18} className="text-indigo-600"/> 
                        Simulate Google Auth
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Since this is a demo environment without a backend, enter an email to simulate the OAuth response.
                    </p>
                    
                    <div className="space-y-3">
                         <button onClick={() => handleAuth('enchoenterprises@gmail.com')} disabled={isProcessing} className="w-full text-left px-4 py-3 bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md rounded-xl text-sm font-medium transition-all flex items-center gap-3 group">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">E</div>
                             <div>
                                 <div className="text-slate-800 font-bold">Encho (Super Admin)</div>
                                 <div className="text-xs text-slate-400">enchoenterprises@gmail.com</div>
                             </div>
                             <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 text-indigo-500"/>
                         </button>

                         <div className="relative">
                            <input 
                               type="email" 
                               value={simEmail} 
                               onChange={e => { setSimEmail(e.target.value); setError(null); }} 
                               onKeyDown={handleKeyDown}
                               placeholder="Enter Driver/Admin Email..."
                               className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400"/>
                         </div>
                         <button onClick={() => handleAuth(simEmail)} disabled={!simEmail || isProcessing} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                             {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                             Sign In
                         </button>
                         <button onClick={() => setIsSimulating(false)} disabled={isProcessing} className="w-full py-2 text-slate-400 text-xs font-bold hover:text-slate-600">Cancel</button>
                    </div>
                </div>
            )}
            
            <p className="text-center text-[10px] text-slate-400 mt-8 font-medium uppercase tracking-widest opacity-60">
                Secured by Google Identity
            </p>
        </div>
    </div>
  );
};

export default LoginPage;
