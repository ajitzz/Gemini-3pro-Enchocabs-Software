import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Search, Calendar, DollarSign, Users, SplitSquareHorizontal, Coffee, Car, Ticket, FileText } from 'lucide-react';
import { storageService } from '../services/storageService';
import { Expense, Driver } from '../types';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Add Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<'Food' | 'Travel' | 'Ticket' | 'Other'>('Food');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [splitType, setSplitType] = useState<'all' | 'selected'>('all');
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedExpenses, fetchedDrivers] = await Promise.all([
        storageService.getExpenses(),
        storageService.getDrivers()
      ]);
      setExpenses(fetchedExpenses);
      setDrivers(fetchedDrivers);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleDriverSelection = (driverId: string) => {
    setSelectedDriverIds(prev => 
      prev.includes(driverId) 
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const handleQuickSave = async () => {
    if (!date || !category || !description || !totalAmount) {
      alert('Please fill in all required fields.');
      return;
    }

    const amount = Number(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    let targetDriverIds = splitType === 'all' ? drivers.map(d => d.id) : selectedDriverIds;
    
    if (targetDriverIds.length === 0) {
      alert('Please select at least one driver to split the expense with.');
      return;
    }

    setIsSubmitting(true);

    const splitAmount = Number((amount / targetDriverIds.length).toFixed(2));
    const splits = targetDriverIds.map(driverId => ({
      driverId,
      amount: splitAmount
    }));

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      date,
      category,
      description,
      totalAmount: amount,
      splits,
      createdAt: new Date().toISOString()
    };

    try {
      await storageService.saveExpense(newExpense);
      await fetchData();
      
      // Reset form but keep date and category for fast entry
      setDescription('');
      setTotalAmount('');
      // Keep splitType and selectedDriverIds
    } catch (err: any) {
      alert(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await storageService.deleteExpense(id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return <div className="p-6 text-center">Loading expenses...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500 text-center">{error}</div>;
  }

  const categories = [
    { id: 'Food', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
    { id: 'Travel', icon: Car, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
    { id: 'Ticket', icon: Ticket, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
    { id: 'Other', icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expense Splitter</h1>
        <p className="text-sm text-slate-500">Fast entry for daily expenses</p>
      </div>

      {/* Quick Add Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-gradient-to-br from-indigo-50/50 to-white">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" /> Quick Add Expense
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Row 1: Date & Category */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                />
              </div>
            </div>
            
            <div className="md:col-span-9">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                {categories.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all whitespace-nowrap ${
                        isSelected 
                          ? `${cat.bg} ${cat.color} ${cat.border} ring-2 ring-offset-1 ring-${cat.color.split('-')[1]}-400` 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {cat.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Description & Amount */}
            <div className="md:col-span-8">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this expense for?"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSave()}
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Total Amount (₹)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold text-slate-900"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickSave()}
                />
              </div>
            </div>

            {/* Row 3: Split & Save */}
            <div className="md:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 pt-4 border-t border-slate-100">
              <div className="flex-1 w-full">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Split With:</span>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setSplitType('all')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        splitType === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      All Drivers ({drivers.length})
                    </button>
                    <button
                      onClick={() => setSplitType('selected')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        splitType === 'selected' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Selected ({selectedDriverIds.length})
                    </button>
                  </div>
                </div>
                
                {splitType === 'selected' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {drivers.map(driver => {
                      const isSelected = selectedDriverIds.includes(driver.id);
                      return (
                        <button
                          key={driver.id}
                          onClick={() => toggleDriverSelection(driver.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            isSelected 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {driver.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="w-full sm:w-auto flex items-center gap-3">
                {totalAmount && (
                  <div className="text-right mr-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Per Driver</p>
                    <p className="text-sm font-extrabold text-slate-800">
                      ₹{splitType === 'all' 
                        ? (Number(totalAmount) / drivers.length || 0).toFixed(2)
                        : (Number(totalAmount) / (selectedDriverIds.length || 1)).toFixed(2)
                      }
                    </p>
                  </div>
                )}
                <button
                  onClick={handleQuickSave}
                  disabled={isSubmitting || !description || !totalAmount}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Expense'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Expenses List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Recent Expenses</h3>
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Split</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => {
                  const cat = categories.find(c => c.id === expense.category) || categories[3];
                  return (
                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3 text-sm text-slate-600 font-medium whitespace-nowrap">
                        {new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${cat.bg} ${cat.color}`}>
                          <cat.icon className="w-3 h-3" />
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{expense.description}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">₹{expense.totalAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{expense.splits.length}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-slate-700">₹{expense.splits[0]?.amount.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
