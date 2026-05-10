'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConfirmPurchaseButtonProps {
  shoppingItems: {
    name: string;
    quantity: string;
    totalPrice: number;
  }[];
}

export default function ConfirmPurchaseButton({ shoppingItems }: ConfirmPurchaseButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const router = useRouter();

  const handleConfirm = async () => {
    if (!confirm('この買い物リストで内容を確定し、みなし在庫として冷蔵庫に登録しますか？\n（次回の献立生成でこれらの食材が優先的に利用されます）')) {
      return;
    }

    setIsConfirming(true);
    try {
      const response = await fetch('/api/household/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: shoppingItems })
      });

      if (response.ok) {
        alert('買い物内容を確定し、冷蔵庫（在庫）に反映しました！');
        router.refresh();
      } else {
        const error = await response.json();
        alert(`確定に失敗しました: ${error.message || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Failed to confirm purchase:', error);
      alert('通信エラーが発生しました。');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <button
      onClick={handleConfirm}
      disabled={isConfirming || shoppingItems.length === 0}
      className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
        isConfirming || shoppingItems.length === 0
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'
      }`}
    >
      {isConfirming ? '登録中...' : '買い物内容を確定する'}
    </button>
  );
}
