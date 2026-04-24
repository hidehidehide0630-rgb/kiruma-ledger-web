'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  id: number;
  name: string;
  icon: string | null;
  parentId: number | null;
}

interface Budget {
  categoryId: number;
  amount: number;
}

export default function HouseholdBudgetPage() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // カテゴリ一覧と既存予算の取得
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [catsRes, budgetsRes] = await Promise.all([
          fetch('/api/household/categories'),
          fetch(`/api/household/budget?year=${year}&month=${month}`)
        ]);

        const catsData = await catsRes.json();
        const budgetsData = await budgetsRes.json();

        setCategories(catsData);
        
        const budgetMap: Record<number, number> = {};
        budgetsData.forEach((b: any) => {
          budgetMap[b.categoryId] = b.amount;
        });
        setBudgets(budgetMap);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [year, month]);

  const handleAmountChange = (categoryId: number, value: string) => {
    const amount = parseInt(value) || 0;
    setBudgets(prev => {
      const newBudgets = { ...prev, [categoryId]: amount };
      
      // 親カテゴリーの合計を再計算
      const cat = categories.find(c => c.id === categoryId);
      if (cat && cat.parentId) {
        const parentId = cat.parentId;
        const siblings = categories.filter(c => c.parentId === parentId);
        const total = siblings.reduce((sum, s) => {
          return sum + (s.id === categoryId ? amount : (prev[s.id] || 0));
        }, 0);
        newBudgets[parentId] = total;
      }
      
      return newBudgets;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const budgetItems = Object.entries(budgets).map(([categoryId, amount]) => ({
        categoryId: parseInt(categoryId),
        amount
      }));

      const response = await fetch('/api/household/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, budgets: budgetItems })
      });

      if (response.ok) {
        alert('予算を保存しました！');
        router.push('/household');
      } else {
        alert('保存に失敗しました。');
      }
    } catch (error) {
      console.error('Failed to save budget:', error);
      alert('エラーが発生しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const totalBudget = Object.values(budgets).reduce((sum, val) => sum + val, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">家計予算設定</h1>
          <p className="text-gray-500 mt-1">月々の支出目標を設定して、健全な家計管理を実現しましょう。</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <select 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-transparent font-bold text-gray-700 outline-none px-2"
          >
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select 
            value={month} 
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-transparent font-bold text-gray-700 outline-none px-2 border-l border-gray-200"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span className="text-xl">💰</span> カテゴリ別予算入力
                </h3>
              </div>
              <div className="divide-y divide-gray-50 text-gray-900">
                {categories
                  .filter(c => !c.parentId) // まず親（または単独項目）を表示
                  .sort((a, b) => a.id - b.id)
                  .map((parent) => {
                    const children = categories.filter(c => c.parentId === parent.id);
                    const isGroup = children.length > 0;
                    
                    return (
                      <React.Fragment key={parent.id}>
                        {/* 親カテゴリー行 */}
                        <div className={`p-4 transition-colors flex items-center gap-4 ${isGroup ? 'bg-gray-100/50' : 'hover:bg-gray-50'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${isGroup ? 'bg-white shadow-none border border-gray-200' : 'bg-indigo-50'}`}>
                            {parent.name === '朝食・昼食' ? '☕' : 
                             parent.name === '夕食' ? '🍱' : 
                             parent.name === '調味料' ? '🧂' : 
                             parent.name === '嗜好品' ? '🍫' : 
                             parent.name === '交際費' ? '🍻' : 
                             parent.name === '雑費' ? '💠' : 
                             parent.name === '食費' ? '🛒' :
                             parent.name === '日用品' ? '🧴' : '📦'}
                          </div>
                          <div className="flex-1">
                            <label className={`block text-sm font-black mb-0.5 ${isGroup ? 'text-gray-900' : 'text-gray-600'}`}>
                              {parent.name}
                              {isGroup && <span className="ml-2 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Summary</span>}
                            </label>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{isGroup ? 'Auto calculated from sub-items' : 'Target monthly budget'}</p>
                          </div>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">¥</span>
                            <input
                              type="number"
                              readOnly={isGroup}
                              value={budgets[parent.id] || ''}
                              onChange={(e) => handleAmountChange(parent.id, e.target.value)}
                              className={`pl-8 pr-4 py-2.5 w-36 rounded-xl border-2 font-mono text-right transition-all outline-none ${
                                isGroup 
                                ? 'bg-gray-200/50 border-transparent text-gray-500 font-black cursor-not-allowed' 
                                : 'bg-white border-gray-100 focus:border-pink-500 focus:ring-0 text-gray-900'
                              }`}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 子カテゴリー行（あれば） */}
                        {children.map(child => (
                           <div key={child.id} className="p-4 pl-12 hover:bg-gray-50/80 transition-colors flex items-center gap-4 border-l-4 border-indigo-100 ml-4">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-md shadow-sm">
                              {child.name === '朝食・昼食' ? '☕' : 
                               child.name === '夕食' ? '🍱' : 
                               child.name === '調味料' ? '🧂' : 
                               child.name === '嗜好品' ? '🍫' : 
                               child.name === '交際費' ? '🍻' : 
                               child.name === '雑費' ? '💠' : '📦'}
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 mb-0.5">{child.name}</label>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                value={budgets[child.id] || ''}
                                onChange={(e) => handleAmountChange(child.id, e.target.value)}
                                className="pl-4 pr-4 py-2 w-32 rounded-lg border-2 border-gray-50 bg-white focus:border-indigo-400 focus:ring-0 text-right font-mono text-sm transition-all outline-none text-gray-900"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-900 to-indigo-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h3 className="text-lg font-medium opacity-70 mb-2">今月の総予算</h3>
              <p className="text-4xl font-bold font-mono">¥{totalBudget.toLocaleString()}</p>
              <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-60">設定カテゴリ数</span>
                  <span className="font-bold">{Object.keys(budgets).length} カテゴリ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-60">1日あたりの平均</span>
                  <span className="font-bold italic">¥{Math.floor(totalBudget / 30).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full py-5 rounded-2xl text-white font-bold text-lg shadow-lg transform transition-all active:scale-95 flex items-center justify-center ${
                isSaving 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 hover:shadow-pink-200'
              }`}
            >
              {isSaving ? '保存中...' : '予算を保存する'}
            </button>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4 items-start">
              <span className="text-2xl mt-1">💡</span>
              <div>
                <h4 className="font-bold text-amber-800 text-sm">Rintaro's Tip</h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  予算は「少し厳しめ」に設定し、予備費を多めに確保するのが KIRUMA 流です。
                  特に嗜好品や交際費をコントロールすることで、事業投資への余力を生み出しましょう。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
