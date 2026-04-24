'use client';

import Link from 'next/link';

interface TransitionPageProps {
  title: string;
  targetMode: 'expense' | 'income' | 'advanced';
}

export default function TransitionPage({ title, targetMode }: TransitionPageProps) {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-in fade-in duration-700">
      <div className="inline-block p-4 bg-indigo-50 rounded-3xl mb-4">
        <span className="text-4xl">🔱</span>
      </div>
      <h2 className="text-3xl font-black text-gray-900 tracking-tighter">
        「{title}」は統合されました
      </h2>
      <p className="text-gray-500 font-medium leading-relaxed">
        より快適でスピーディーな入力体験を提供するため、<br />
        売上・経費・家計簿のすべての入力機能を<br />
        <span className="text-indigo-600 font-bold">「統合入力センター」</span>へ集約いたしました。
      </p>
      
      <div className="pt-10">
        <Link 
          href={`/entry?mode=${targetMode}`}
          className="inline-block bg-indigo-600 text-white px-10 py-5 rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
        >
          統合入力センターへ移動する
        </Link>
      </div>

      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-10">
        KIRUMA COMPANY / Technical Office
      </p>
    </div>
  );
}
