import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MindCheck - ตรวจเช็คภาวะอารมณ์เบื้องต้น',
  description: 'ระบบประเมินภาวะอารมณ์และความเสี่ยงด้านสุขภาวะจิตเบื้องต้น ใช้การวิเคราะห์การแสดงออกทางใบหน้าอ้างอิงจากงานวิจัย FacePsy',
  keywords: ['mental health', 'wellness', 'depression screening', 'emotional wellness', 'face analysis'],
  authors: [{ name: 'MindCheck Team' }],
  openGraph: {
    title: 'MindCheck - ตรวจเช็คภาวะอารมณ์เบื้องต้น',
    description: 'ตรวจเช็คภาวะอารมณ์เบื้องต้นใน 60 วินาที ไม่เก็บรูปภาพ',
    type: 'website',
    locale: 'th_TH',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
