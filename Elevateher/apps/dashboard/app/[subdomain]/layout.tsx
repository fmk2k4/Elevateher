import InstitutionProvider from '@/components/layout/InstitutionProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { SkipLink } from '@/components/layout/SkipLink';
import { TopBar } from '@/components/layout/TopBar';
import { LiveAlerts } from '@/components/layout/LiveAlerts';
import { Toaster } from 'sonner';

export default function InstitutionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { subdomain: string };
}) {
  return (
    <InstitutionProvider subdomain={params.subdomain}>
      <Toaster theme="dark" position="top-right" />
      <LiveAlerts />
      <SkipLink />

      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: '#0B1120',
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <TopBar />
          <main
            id="main-content"
            role="main"
            aria-label="Dashboard content"
            tabIndex={-1}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              background: 'linear-gradient(180deg, #0B1120 0%, #0F172A 100%)',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </InstitutionProvider>
  );
}
