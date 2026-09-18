import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hola Maps - Khám phá Hòa Lạc',
  description: 'Bản đồ khám phá địa phương do cộng đồng xây dựng.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
