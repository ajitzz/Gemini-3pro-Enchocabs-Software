import React, { useState } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Wallet, Menu, X, Users, Coffee, Upload, Settings, Briefcase, FileText, Calculator, UserCircle, LogOut, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import DailyEntryPage from './components/DailyEntryPage';
import WeeklyWalletPage from './components/WeeklyWalletPage';
import DashboardPage from './components/DashboardPage';
import RegistrationPage from './components/RegistrationPage';
import LeavePage from './components/LeavePage';
import ImportPage from './components/ImportPage';
import ManageDefaultsPage from './components/ManageDefaultsPage';
import CompanySettlementPage from './components/CompanySettlementPage';
import DriverBillingsPage from './components/DriverBillingsPage';
import RevenuePage from './components/RevenuePage';
import DriverPortalPage from './components/DriverPortalPage';
import LoginPage from './components/LoginPage';
import AdminAccessPage from './components/AdminAccessPage';

// --- PROTECTED ROUTE WRAPPER ---
const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles: string[] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
     // Redirect logic based on role mismatch
     if (user.role === 'driver') return <Navigate to="/portal" replace />;
     return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink
      to={to}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) =>
        `flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 group ${
          isActive 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 translate-x-1' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center space-x-3">
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400 transition-colors'} />
            <span className={`font-medium text-sm ${isActive ? 'font-bold' : ''}`}>{label}</span>
          </div>
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.8)]"></div>}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none`}>
        {/* Logo Area */}
        <div className="flex items-center justify-between p-8 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="text-white font-bold text-xl tracking-tighter">DT</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">Driver<span className="text-indigo-500">Tracker</span></h1>
              <p className="text-xs text-slate-500 font-medium tracking-wider uppercase mt-1">Admin Console</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="px-4 py-6 space-y-8 overflow-y-auto h-[calc(100vh-160px)]">
          <div>
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Overview</p>
            <nav className="space-y-1">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/daily" icon={Calendar} label="Daily Entries" />
              <NavItem to="/weekly" icon={Wallet} label="Weekly Wallet" />
            </nav>
          </div>
          
          <div>
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Management</p>
            <nav className="space-y-1">
              <NavItem to="/registration" icon={Users} label="Registration" />
              <NavItem to="/defaults" icon={Settings} label="Manage Defaults" />
              <NavItem to="/leaves" icon={Coffee} label="Leaves" />
              <NavItem to="/settlement" icon={Briefcase} label="Company Settlement" />
              <NavItem to="/billings" icon={FileText} label="Driver Billings" />
              <NavItem to="/revenue" icon={Calculator} label="Revenue Calculation" />
              <NavItem to="/import" icon={Upload} label="Import Data" />
            </nav>
          </div>

          <div>
             <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">System</p>
             <nav className="space-y-1">
                {user?.role === 'super_admin' && (
                    <NavItem to="/admin-access" icon={Shield} label="Admin Access" />
                )}
                <NavItem to="/portal" icon={UserCircle} label="Driver View Mode" />
             </nav>
          </div>
        </div>

        <div className="absolute bottom-0 w-full p-4 bg-slate-900 border-t border-slate-800/50">
          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3 border border-slate-700/50 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-inner">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role === 'super_admin' ? 'Super Admin' : 'Administrator'}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full py-2 bg-slate-800 hover:bg-rose-900/30 hover:text-rose-400 text-slate-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors">
              <LogOut size={14}/> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
         <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DT</span>
           </div>
           <h1 className="text-lg font-bold text-slate-800">Driver Tracker</h1>
         </div>
         <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-indigo-600 transition-colors p-1">
           <Menu size={24} />
         </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 max-w-[1920px] mx-auto w-full">
         {children}
      </main>
      
      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
        <HashRouter>
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            {/* Driver Portal Route (Secure) */}
            <Route path="/portal" element={
                <ProtectedRoute allowedRoles={['driver', 'admin', 'super_admin']}>
                    <DriverPortalPage />
                </ProtectedRoute>
            } />
            
            {/* Admin Routes (Wrapped in Layout) */}
            <Route path="/*" element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <Layout>
                        <Routes>
                            <Route path="/" element={<DashboardPage />} />
                            <Route path="/daily" element={<DailyEntryPage />} />
                            <Route path="/weekly" element={<WeeklyWalletPage />} />
                            <Route path="/registration" element={<RegistrationPage />} />
                            <Route path="/defaults" element={<ManageDefaultsPage />} />
                            <Route path="/leaves" element={<LeavePage />} />
                            <Route path="/settlement" element={<CompanySettlementPage />} />
                            <Route path="/billings" element={<DriverBillingsPage />} />
                            <Route path="/revenue" element={<RevenuePage />} />
                            <Route path="/import" element={<ImportPage />} />
                            <Route path="/admin-access" element={<AdminAccessPage />} />
                        </Routes>
                    </Layout>
                </ProtectedRoute>
            } />
        </Routes>
        </HashRouter>
    </AuthProvider>
  );
};

export default App;