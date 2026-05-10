'use client';

import React, { useState } from 'react';

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
}

interface InventoryListProps {
  initialItems: InventoryItem[];
}

export default function InventoryList({ initialItems }: InventoryListProps) {
  const [items, setItems] = useState(initialItems);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unit: '個' });
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    setLoading(true);
    try {
      const res = await fetch('/api/household/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        const added = await res.json();
        setItems([added, ...items]);
        setNewItem({ name: '', quantity: 1, unit: '個' });
      }
    } catch (error) {
      console.error('Failed to add item', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    try {
      const res = await fetch(`/api/household/inventory?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems(items.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete item', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add New Item */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase mb-6 flex items-center gap-2">
          <span className="text-2xl">➕</span> Add New Stock
        </h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="食材名 (例: 鶏むね肉)"
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full px-6 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
              required
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="数量"
              value={newItem.quantity}
              onChange={e => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
              className="w-24 px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
              required
            />
            <input
              type="text"
              placeholder="単位"
              value={newItem.unit || ''}
              onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
              className="flex-grow px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3.5 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'ADDING...' : 'ADD STOCK'}
          </button>
        </form>
      </div>

      {/* Current Inventory List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:border-pink-200 transition-all group flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-800">{item.name}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {item.quantity} {item.unit || '個'}
              </span>
            </div>
            <button
              onClick={() => handleDelete(item.id)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              <span className="text-sm">✕</span>
            </button>
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
          <p className="text-gray-400 font-bold italic">在庫データがありません。</p>
        </div>
      )}
    </div>
  );
}
