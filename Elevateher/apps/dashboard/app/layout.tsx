import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';

import InstitutionProvider from '@/components/layout/InstitutionProvider';
import { DemoRibbon } from '@/components/DemoRibbon';

export const metadata: Metadata = {
  title: 'ElevateHer Dashboard — Institution Admin',
  description:
    'ElevateHer Institution Admin Dashboard — manage women-led businesses, track mentorship programs, monitor funding pipelines, and drive economic empowerment across your institution.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B1120',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0B1120' }}>
        <DemoRibbon />
        {children}
      </body>
    </html>
  );
}