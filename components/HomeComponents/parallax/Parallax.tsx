import React from 'react';

const Parallax: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 py-16 text-white">
      <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Public welcome, private portals</h2>
        <p className="mt-4 text-lg text-indigo-100">
          Customers land on the homepage instantly. Drivers and administrators head to /staff for Google-authenticated access to
          their respective tools.
        </p>
      </div>
    </section>
  );
};

export default Parallax;
