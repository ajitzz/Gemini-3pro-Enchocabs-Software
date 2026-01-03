
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { AlertOctagon, Loader2 } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { loginWithGoogleToken, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Effect to handle redirection AFTER user state is updated
  useEffect(() => {
    if (user) {
      if (user.role === 'driver') {
        navigate('/staff/portal');
      } else {
        navigate('/staff/dashboard');
      }
    }
  }, [user, navigate]);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
        setError("No credentials received from Google.");
        return;
    }
    
    setError(null);
    setIsProcessing(true);
    try {
      await loginWithGoogleToken(response.credential);
      // Navigation is handled by the useEffect above
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please contact support.');
      setIsProcessing(false);
    }
  };

  const handleGoogleError = () => {
      setError("Google Sign-In failed. Please check your connection or try again.");
      setIsProcessing(false);
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
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight text-center">Encho Cabs</h1>
                <p className="text-slate-500 font-medium mt-2 text-sm">Secure Portal Login</p>
            </div>

            {error && (
                <div className="mb-6 bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
                    <AlertOctagon className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="text-sm text-rose-700 font-bold">Access Denied</p>
                        <p className="text-xs text-rose-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {isProcessing ? (
                <div className="flex flex-col items-center py-8">
                    <Loader2 size={32} className="text-indigo-600 animate-spin mb-3" />
                    <p className="text-sm font-bold text-slate-600">Verifying Identity...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-center w-full">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme="filled_blue"
                            size="large"
                            width="300"
                            shape="pill"
                            text="continue_with"
                        />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-500 leading-relaxed text-center">
                        <p className="mb-2"><strong className="text-indigo-600">Drivers:</strong> Use your registered email.</p>
                        <p><strong className="text-indigo-600">Admin:</strong> Only authorized staff may enter.</p>
                    </div>
                </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                    Secured by Google Identity
                </p>
            </div>
        </div>
    </div>
  );
};

export default LoginPage;
