'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MobileNavWrapper({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop fixed, Mobile slide-in */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <h1 className="text-xl font-black tracking-tighter text-indigo-600">BlueReturn</h1>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          <ul className="space-y-1 px-3">
            <div className="pt-2 pb-2">
              <span className="px-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Quick Access
              </span>
            </div>
            <li>
              <Link 
                href="/entry" 
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 mx-2 rounded-2xl text-sm font-black text-white bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
              >
                <span className="text-lg">🔱</span> 統合入力センター
              </Link>
            </li>

            <div className="pt-6 pb-2">
              <span className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Business
              </span>
            </div>
            {[
              { href: "/", label: "ダッシュボード", icon: "📊" },
              { href: "/salaries", label: "給与入力", icon: "💰", color: "text-purple-600 bg-purple-50" },
              { href: "/transactions", label: "取引一覧", icon: "🗒️" },
              { href: "/receipt", label: "レシート読取", icon: "📸" },
              { href: "/reports", label: "帳票 (PL/BS)", icon: "📈" },
            ].map((item) => (
              <li key={item.href}>
                <Link 
                  href={item.href} 
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-gray-100 ${item.color || 'text-gray-600'}`}
                >
                  <span className="w-5">{item.icon}</span> {item.label}
                </Link>
              </li>
            ))}

            <div className="pt-6 pb-2">
              <span className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Household
              </span>
            </div>
            {[
              { href: "/household", label: "家計・献立管理", icon: "🏡", color: "text-pink-600 bg-pink-50" },
              { href: "/household/budget", label: "予算設定", icon: "⚖️" },
            ].map((item) => (
              <li key={item.href}>
                <Link 
                  href={item.href} 
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-gray-100 ${item.color || 'text-gray-600'}`}
                >
                  <span className="w-5">{item.icon}</span> {item.label}
                </Link>
              </li>
            ))}

            <div className="pt-6 border-t border-gray-50 mt-4 pb-2">
              <span className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Tools
              </span>
            </div>
            {[
              { href: "/reports/tax-navigation", label: "確定申告ナビ", icon: "🎯", color: "text-amber-700 bg-amber-50" },
              { href: "/settings/apportionment", label: "家事按分設定", icon: "⚙️" },
              { href: "/manual", label: "記帳マニュアル", icon: "📚", color: "text-amber-700 bg-amber-50" },
            ].map((item) => (
              <li key={item.href}>
                <Link 
                  href={item.href} 
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-gray-100 ${item.color || 'text-gray-600'}`}
                >
                  <span className="w-5">{item.icon}</span> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-6 border-t border-gray-100 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
          © 2026 Kiruma Company
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 lg:hidden hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm lg:text-base font-black text-gray-800 tracking-tight">BlueReturn Portal</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600 border border-indigo-200">
              H
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-gray-50 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>

        {/* Bottom Navigation (Mobile Only) */}
        <nav className="fixed bottom-0 inset-x-0 h-20 bg-white/90 backdrop-blur-xl border-t border-gray-200 flex lg:hidden items-center justify-around px-4 z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
          {[
            { href: "/", label: "Home", icon: "📊" },
            { href: "/entry", label: "Entry", icon: "🔱" },
            { href: "/household", label: "Life", icon: "🏡" },
            { href: "/reports", label: "Docs", icon: "📈" },
          ].map((item) => (
            <Link 
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 p-2 min-w-[64px]"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{item.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
