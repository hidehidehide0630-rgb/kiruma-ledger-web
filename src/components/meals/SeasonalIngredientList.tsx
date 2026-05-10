'use client';

import React, { useEffect, useState } from 'react';
import { Leaf, Zap } from 'lucide-react';

interface Ingredient {
  id: number;
  name: string;
  category: string;
  vitalityBenefit: string | null;
  isVitality: boolean;
  unit: string;
  basePrice: number;
}

export default function SeasonalIngredientList() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeasonal = async () => {
      try {
        const res = await fetch('/api/household/seasonal');
        if (res.ok) {
          const data = await res.json();
          setIngredients(data);
        } else {
          setError(`API Error: ${res.status}`);
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Fetch failed');
      } finally {
        setLoading(false);
      }
    };
    fetchSeasonal();
  }, []);

  if (loading) return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm animate-pulse">
      <div className="h-8 bg-gray-100 rounded-full w-48 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-50 rounded-2xl"></div>)}
      </div>
    </div>
  );

  const currentMonth = new Date().getMonth() + 1;

  return (
    <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-red-50 rounded-2xl text-red-600">
          <Leaf className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">Seasonal Vitality</h2>
          <p className="text-gray-500 font-medium">{currentMonth}月の旬・精強食材</p>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-50 rounded-3xl text-red-600 border border-red-100">
          <p className="font-semibold mb-1">データの取得に失敗しました</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      ) : ingredients.length === 0 ? (
        <div className="p-6 bg-gray-50 rounded-3xl text-gray-500 border border-gray-100">
          <p className="font-medium italic">現在、この月の旬の食材データがありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ingredients.map((item) => (
            <div 
              key={item.id}
              className="group p-5 bg-gray-50 rounded-3xl hover:bg-white hover:shadow-md transition-all duration-300 border border-transparent hover:border-gray-100"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-bold text-gray-400 group-hover:text-red-300 transition-colors">
                  {item.category}
                </span>
                {item.isVitality && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <Zap className="w-3 h-3 fill-current" />
                    Vitality
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-red-600 transition-colors">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
                精強効果と旬の栄養価が最大化されています
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
