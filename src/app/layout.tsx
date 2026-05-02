import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import MobileNavWrapper from '@/components/MobileNavWrapper';

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
        <MobileNavWrapper>
          {children}
        </MobileNavWrapper>
      </body>
    </html>
  );
}
