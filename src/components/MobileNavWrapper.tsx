'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNavWrapper({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { section: 'Business', items: [
      { href: "/", label: "ダッシュボード", icon: "📊" },
      { href: "/salaries", label: "給与入力", icon: "💰" },
      { href: "/transactions", label: "取引一覧", icon: "🗒️" },
      { href: "/receipt", label: "レシート読取", icon: "📸" },
      { href: "/reports", label: "帳票 (PL/BS)", icon: "📈" },
    ]},
    { section: 'Household', items: [
      { href: "/household", label: "家計・献立管理", icon: "🏡" },
      { href: "/household/budget", label: "予算設定", icon: "⚖️" },
    ]},
    { section: 'Tools', items: [
      { href: "/reports/tax-navigation", label: "確定申告ナビ", icon: "🎯" },
      { href: "/settings/apportionment", label: "家事按分設定", icon: "⚙️" },
      { href: "/manual", label: "記帳マニュアル", icon: "📚" },
    ]}
  ];

  const NavLink = ({ href, label, icon }: { href: string, label: string, icon: string }) => {
    const isActive = pathname === href;
    return (
      <li>
        <Link 
          href={href} 
          onClick={() => setIsSidebarOpen(false)}
          className={`
            flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
            ${isActive 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}
          `}
        >
          <span className={`w-5 flex justify-center ${isActive ? 'scale-110 transition-transform' : 'opacity-70'}`}>
            {icon}
          </span> 
          {label}
        </Link>
      </li>
    );
  };

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black italic shadow-lg shadow-indigo-200">B</div>
            <h1 className="text-xl font-black tracking-tighter text-gray-900">BlueReturn</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
          <ul className="space-y-6">
            {/* Call to Action */}
            <div className="px-5">
              <Link 
                href="/entry" 
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl text-sm font-black text-white bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-xl shadow-indigo-100 hover:shadow-indigo-200 active:scale-95 transition-all"
              >
                <span className="text-lg">🔱</span> 統合入力センター
              </Link>
            </div>

            {navItems.map((section) => (
              <div key={section.section} className="px-3">
                <span className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-2">
                  {section.section}
                </span>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </div>
              </div>
            ))}
          </ul>
        </nav>
        
        <div className="p-6 border-t border-gray-50">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">System Online</span>
          </div>
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
            <h2 className="text-sm lg:text-base font-black text-gray-800 tracking-tight">Portal</h2>
          </div>
          <div className="flex items-center gap-2">
             <div className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">
              FY2026
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-xs font-black text-white border-2 border-white shadow-sm">
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
        <nav className="fixed bottom-0 inset-x-0 h-20 bg-white/95 backdrop-blur-xl border-t border-gray-200 flex lg:hidden items-center justify-around px-4 z-40 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {[
            { href: "/", label: "Home", icon: "📊" },
            { href: "/entry", label: "Entry", icon: "🔱" },
            { href: "/household", label: "Life", icon: "🏡" },
            { href: "/reports", label: "Docs", icon: "📈" },
          ].map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${isActive ? 'text-indigo-600 scale-110' : 'text-gray-400'}`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
