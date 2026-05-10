import { prisma } from '@/lib/prisma';
import InventoryList from '@/components/inventory/InventoryList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const inventory = await prisma.inventory.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Inventory Manager</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1 italic opacity-60">
            🧊 冷蔵庫在庫の手動管理 <span className="mx-2">|</span> Manual Stock Control
          </p>
        </div>
        <Link href="/household/meals" className="px-8 py-3.5 bg-gray-100 text-gray-900 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-gray-200 transition-all">
          ← Back to Meals
        </Link>
      </div>

      <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">💡</span>
          <h4 className="font-black text-amber-900 tracking-tight uppercase">社長へのアドバイス</h4>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed font-bold opacity-80">
          在庫を正確に入力することで、AIが次回の献立生成時に「余り食材」を優先して活用し、無駄な買い物を防ぎます。
          特に肉や魚の端数がある場合は、ここで調整してください。
        </p>
      </div>

      <InventoryList initialItems={inventory} />
    </div>
  );
}
