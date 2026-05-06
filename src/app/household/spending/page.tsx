'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

interface Category {
  id: number;
  name: string;
  icon: string | null;
}

interface Spending {
  id: number;
  date: string;
  amount: number;
  description: string | null;
  categoryId: number;
  category: Category;
  transactionId: number | null;
}

function SpendingHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date();
  
  const yearStr = searchParams.get('year');
  const monthStr = searchParams.get('month');
  const catIdStr = searchParams.get('categoryId');
  
  const year = yearStr ? parseInt(yearStr) : today.getFullYear();
  const month = monthStr ? parseInt(monthStr) : today.getMonth() + 1;
  const categoryId = catIdStr ? parseInt(catIdStr) : undefined;

  const [spendings, setSpendings] = useState<Spending[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Spending | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // 前月・次月の計算
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const fetchSpendings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('year', year.toString());
      params.append('month', month.toString());
      if (categoryId) params.append('categoryId', categoryId.toString());

      const res = await fetch(`/api/household/spending?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSpendings(data);
      }
    } catch (err) {
      console.error('Failed to fetch spendings', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/household/categories');
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    fetchSpendings();
    fetchCategories();
  }, [year, month, categoryId]);

  const handleDelete = async (id: number) => {
    if (!confirm('この支出記録を削除しますか？\nビジネス同期されている場合は関連する取引も論理削除されます。')) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/household/spending/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSpendings(spendings.filter(s => s.id !== id));
      } else {
        alert('削除に失敗しました');
      }
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/household/spending/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editingItem.date,
          amount: editingItem.amount,
          description: editingItem.description,
          categoryId: editingItem.categoryId
        })
      });

      if (res.ok) {
        setEditingItem(null);
        fetchSpendings(); // 再取得
      } else {
        alert('更新に失敗しました');
      }
    } catch (err) {
      console.error('Update failed', err);
    }
  };

  const totalAmount = spendings.reduce((sum, s) => sum + s.amount, 0);
  const categoryName = categoryId && categories.find(c => c.id === categoryId)?.name;

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-10 px-4">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <Link href="/household" className="inline-flex items-center text-[10px] font-black text-pink-600 uppercase tracking-[0.2em] hover:opacity-70 mb-3 transition-opacity">
            <span className="mr-1">←</span> Back to Dashboard
          </Link>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter">
            {categoryName ? `${categoryName} Details` : 'Spending Details'}
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2 italic flex items-center">
             {categoryName ? `${categoryName} の支出履歴` : '支出履歴詳細'} 
             <span className="mx-3 opacity-30 text-gray-300">/</span> {year}年{month}月
          </p>
        </div>

        {/* Stats Summary */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 text-white p-8 rounded-[2rem] shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Monthly Total</p>
            <p className="text-4xl font-black italic">¥{totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Record Count</p>
            <p className="text-3xl font-black text-gray-800 mt-2">{spendings.length} <span className="text-sm">Records</span></p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Daily Average</p>
            <p className="text-3xl font-black text-pink-600 mt-2">¥{Math.round(totalAmount / 30).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6">
        <div className="flex bg-white/50 backdrop-blur p-1 rounded-2xl shadow-sm border border-gray-100">
          <Link 
            href={`/household/spending?year=${prevYear}&month=${prevMonth}${categoryId ? `&categoryId=${categoryId}` : ''}`}
            className="p-3 hover:bg-gray-100 rounded-xl transition-colors font-black text-gray-400"
          >
            ◀
          </Link>
          <div className="px-6 flex items-center font-black text-gray-800 tracking-tighter">
            {year} / {String(month).padStart(2, '0')}
          </div>
          <Link 
            href={`/household/spending?year=${nextYear}&month=${nextMonth}${categoryId ? `&categoryId=${categoryId}` : ''}`}
            className="p-3 hover:bg-gray-100 rounded-xl transition-colors font-black text-gray-400"
          >
            ▶
          </Link>
        </div>
        
        <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">
          Audit Log / Accurate Records
        </div>
      </div>

      {/* Spendings Table */}
      <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
          </div>
        ) : spendings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-4xl mb-4 opacity-20">📂</div>
            <p className="font-bold uppercase tracking-widest text-xs">No records found for this month</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                  <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {spendings.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="text-sm font-black text-gray-800">
                        {new Date(s.date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}
                      </div>
                      <div className="text-[9px] text-gray-300 font-bold uppercase tracking-tighter mt-0.5 italic">
                        {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm shadow-inner border border-gray-200">
                          {s.category.icon || '📦'}
                        </div>
                        <span className="text-xs font-black text-gray-600">{s.category.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-bold text-gray-700 max-w-xs truncate">
                        {s.description || <span className="opacity-30 italic text-xs">No description</span>}
                      </div>
                      {s.transactionId && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tight italic">Synced to Business</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right">
                      <div className="text-lg font-black text-gray-900 italic tracking-tighter">
                        ¥{s.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingItem(s)}
                          className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                          title="編集"
                        >
                          ✎
                        </button>
                        <button 
                          onClick={() => handleDelete(s.id)}
                          disabled={isDeleting === s.id}
                          className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                          title="削除"
                        >
                          {isDeleting === s.id ? '...' : '✕'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="bg-gray-900 p-8 text-white relative">
              <h3 className="text-2xl font-black tracking-tighter italic">Edit Spending</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">支出記録の修正</p>
              <button 
                onClick={() => setEditingItem(null)}
                className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors text-2xl font-black"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-10 space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Date</label>
                <input 
                  type="date" 
                  value={new Date(editingItem.date).toISOString().split('T')[0]} 
                  onChange={e => setEditingItem({...editingItem, date: e.target.value})}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 focus:bg-white rounded-2xl p-4 font-bold outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-300 italic">¥</span>
                  <input 
                    type="number" 
                    value={editingItem.amount} 
                    onChange={e => setEditingItem({...editingItem, amount: parseInt(e.target.value)})}
                    className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 focus:bg-white rounded-2xl p-4 pl-10 text-2xl font-black outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Category</label>
                <select 
                  value={editingItem.categoryId}
                  onChange={e => setEditingItem({...editingItem, categoryId: parseInt(e.target.value)})}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 focus:bg-white rounded-2xl p-4 font-bold outline-none transition-all"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Description</label>
                <input 
                  type="text" 
                  value={editingItem.description || ''} 
                  onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                  placeholder="説明を入力..."
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 focus:bg-white rounded-2xl p-4 font-bold outline-none transition-all"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-black hover:bg-gray-200 transition-all uppercase text-sm tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-lg uppercase text-sm tracking-widest"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HouseholdSpendingHistoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SpendingHistoryContent />
    </Suspense>
  );
}
