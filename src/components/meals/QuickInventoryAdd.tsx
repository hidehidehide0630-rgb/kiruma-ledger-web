'use client';

import React, { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function QuickInventoryAdd() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch('/api/household/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, quantity: parseFloat(quantity), unit: '個' }),
      });
      if (res.ok) {
        setName('');
        setQuantity('1');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to add inventory', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl border border-gray-100 shadow-sm mt-4">
      <div className="flex-grow min-w-[200px]">
        <input
          type="text"
          placeholder="食材をクイック追加..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 text-sm font-bold text-gray-700 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-100 transition-all"
          disabled={loading}
        />
      </div>
      <div className="w-20">
        <input
          type="number"
          step="0.1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-3 py-2 text-sm font-bold text-gray-700 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-100 transition-all text-center"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !name}
        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300 transition-all shadow-md active:scale-95"
      >
        <Plus className="w-5 h-5" />
      </button>
    </form>
  );
}
