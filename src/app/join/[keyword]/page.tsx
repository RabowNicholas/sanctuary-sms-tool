import type { Metadata, Viewport } from 'next';
import { Syne, Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@/generated/prisma';
import JoinForm from './JoinForm';

export const dynamic = 'force-dynamic';

// Brand type system (FlowState Assets / Color and types): Syne display, Be Vietnam Pro body, JetBrains Mono accent
const syne = Syne({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-syne' });
const beVietnam = Be_Vietnam_Pro({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-be-vietnam' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'flow state',
  description: 'event drops and early access from flow state by text',
};

// Dark status bar / toolbar on iOS, and let content extend under the notch (we pad with safe-area insets)
export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

interface PageProps {
  params: Promise<{ keyword: string }>;
}

export default async function JoinPage({ params }: PageProps) {
  const { keyword } = await params;
  const keywordText = decodeURIComponent(keyword).trim().toUpperCase();

  const prisma = new PrismaClient();
  let found;
  try {
    found = await prisma.signupKeyword.findUnique({ where: { keyword: keywordText } });
  } finally {
    await prisma.$disconnect();
  }
  if (!found || !found.isActive) notFound();

  return (
    <main
      className={`${syne.variable} ${beVietnam.variable} ${jetbrains.variable} ${beVietnam.className} min-h-dvh bg-black text-white flex justify-center
        pt-[max(env(safe-area-inset-top),12vh)] pb-[max(env(safe-area-inset-bottom),2rem)]
        pl-[max(env(safe-area-inset-left),1.25rem)] pr-[max(env(safe-area-inset-right),1.25rem)]
        sm:items-center sm:pt-12`}
    >
      <div className="w-full max-w-[380px] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/flowstate-logo-white.png"
          alt="flow state"
          width={1200}
          height={210}
          className="w-64 h-auto mx-auto mb-12"
        />
        <JoinForm keyword={found.keyword} />
      </div>
    </main>
  );
}
