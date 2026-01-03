import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 py-10 text-slate-200">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Encho Cabs</h3>
          <p className="text-sm text-slate-400">Safe rides, confident staff workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <Link to="/" className="text-slate-200 transition hover:text-white">Home</Link>
          <Link to="/staff/login" className="text-slate-200 transition hover:text-white">Staff login</Link>
          <Link to="/staff/portal" className="text-slate-200 transition hover:text-white">Driver portal</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
