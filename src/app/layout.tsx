import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '青色申告 会計システム',
  description: '個人事業主向けの青色申告対応会計アプリケーション',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-gray-200">
              <h1 className="text-xl font-bold text-indigo-600">BlueReturn</h1>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-1 px-3">
                <div className="pt-4 pb-2">
                  <span className="px-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    Main Portal
                  </span>
                </div>
                <li>
                  <Link href="/entry" className="block px-3 py-3 mx-2 rounded-xl text-sm font-black text-white bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-lg shadow-indigo-100 hover:scale-[1.02] transition-all">
                    🔱 統合入力センター
                  </Link>
                </li>

                <div className="pt-6 pb-2">
                  <span className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    ビジネス (Business)
                  </span>
                </div>
                <li>
                  <Link href="/" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600">
                    ダッシュボード
                  </Link>
                </li>
                <li>
                  <Link href="/salaries" className="block px-3 py-2 rounded-md text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100">
                    給与入力
                  </Link>
                </li>
                <li>
                  <Link href="/transactions" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600">
                    取引一覧
                  </Link>
                </li>
                <li>
                  <Link href="/receipt" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600">
                    レシート読取(OCR)
                  </Link>
                </li>
                <li>
                  <Link href="/reports" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600">
                    帳票(P/L, B/S)
                  </Link>
                </li>

                <div className="pt-6 pb-2">
                  <span className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    ライフ (Household)
                  </span>
                </div>
                <li>
                  <Link href="/household" className="block px-3 py-2 rounded-md text-sm font-medium text-pink-600 bg-pink-50 hover:bg-pink-100">
                    家計・献立管理
                  </Link>
                </li>
                <li>
                  <Link href="/household/budget" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-pink-600">
                    家計予算設定
                  </Link>
                </li>

                <div className="pt-6 border-t border-gray-100 mt-4 pb-2">
                  <span className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    メンテナンス
                  </span>
                </div>
                <li>
                  <Link href="/reports/tax-navigation" className="block px-3 py-2 rounded-md text-sm font-black text-amber-700 bg-amber-50 hover:bg-amber-100">
                    確定申告ナビ
                  </Link>
                </li>
                <li>
                  <Link href="/settings/apportionment" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600">
                    家事按分設定
                  </Link>
                </li>
                <li>
                  <Link href="/manual" className="block px-3 py-2 rounded-md text-sm font-black text-amber-700 bg-amber-50 hover:bg-amber-100">
                    記帳マニュアル
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
              © 2026 Tax Affairs App
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">会計システム</h2>
            </header>
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
