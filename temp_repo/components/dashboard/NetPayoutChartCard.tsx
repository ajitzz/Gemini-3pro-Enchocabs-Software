import React from 'react';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { DriverSummary } from '../../types';

type NetPayoutChartCardProps = {
  filteredSummaries: DriverSummary[];
  formatCurrency: (value: number) => string;
};

const NetPayoutChartCard: React.FC<NetPayoutChartCardProps> = ({ filteredSummaries, formatCurrency }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-indigo-500" />
        Net Payouts
      </h3>
      <div className="h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredSummaries} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="driver"
              type="category"
              width={80}
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', background: 'rgba(255,255,255,0.95)' }}
            />
            <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={2} />
            <Bar dataKey="netPayout" radius={[4, 4, 4, 4]} barSize={12}>
              {filteredSummaries.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.netPayout < 0 ? '#f43f5e' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></span> Payable
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-200"></span> Pending
        </div>
      </div>
    </div>
  );
};

export default NetPayoutChartCard;
