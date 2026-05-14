'use client';

import React, { useState } from 'react';

interface ShoppingItem {
  name: string;
  quantity: string;
  totalPrice: number;
  isFromInventory: boolean;
}

interface CopyShoppingListButtonProps {
  shoppingItems: ShoppingItem[];
}

export default function CopyShoppingListButton({ shoppingItems }: CopyShoppingListButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // 1円以上の商品（新規購入品）の名前のみを抽出
    const listText = shoppingItems
      .filter(item => !item.isFromInventory && item.totalPrice > 0)
      .map(item => item.name)
      .join('\n');

    if (listText.length === 0) {
      alert('新規購入が必要なアイテムはありません。');
      return;
    }

    try {
      await navigator.clipboard.writeText(listText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
      alert('コピーに失敗しました。');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${
        copied 
        ? 'bg-emerald-500 text-white shadow-emerald-200' 
        : 'bg-white text-gray-900 border border-gray-200 hover:border-pink-300 hover:text-pink-600'
      }`}
    >
      {copied ? (
        <>
          <span className="text-sm">✅</span> COPIED!
        </>
      ) : (
        <>
          <span className="text-sm">📋</span> Copy for Keep
        </>
      )}
    </button>
  );
}
