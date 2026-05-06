'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation({ children }: { children: React.ReactNode }) {
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
      { href: "/household", label: "家計・支出管理", icon: "🏡" },
      { href: "/household/budget", label: "予算設定", icon: "⚖️" },
    ]},
    { section: 'Health & Meals', items: [
      { href: "/household/meals", label: "献立・食事管理", icon: "🍳" },
      { href: "/household/setup", label: "AI献立生成", icon: "🤖" },
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
              ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
          `}
        >
          <span className={`w-5 flex justify-center text-lg ${isActive ? 'scale-110' : 'opacity-70'}`}>
            {icon}
          </span> 
          {label}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden relative bg-gray-50">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg">B</div>
            <h1 className="text-xl font-black tracking-tight text-gray-900">BlueReturn</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
          <ul className="space-y-6">
            <div className="px-5">
              <Link 
                href="/entry" 
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl text-sm font-black text-white bg-indigo-600 shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                🔱 統合入力センター
              </Link>
            </div>

            {navItems.map((section) => (
              <div key={section.section} className="px-3">
                <span className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
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
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 lg:hidden rounded-xl hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-4">
            <div className="text-xs font-black text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-200 uppercase tracking-widest">FY2026</div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white border-2 border-white shadow-sm">H</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 inset-x-0 h-20 bg-white border-t border-gray-200 flex lg:hidden items-center justify-around z-40 pb-safe">
          {[
            { href: "/", label: "Home", icon: "📊" },
            { href: "/entry", label: "Entry", icon: "🔱" },
            { href: "/household", label: "Life", icon: "🏡" },
            { href: "/reports", label: "Docs", icon: "📈" },
          ].map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 min-w-[64px] ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                <span className="text-xl">{item.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
