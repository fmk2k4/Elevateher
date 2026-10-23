import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { DemoRibbon } from "@/components/DemoRibbon";

// Auto-attach Bearer token to /api/* requests (set by useAuth.js after login)
import "@/utils/fetchInterceptor";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const metadata = {
  title: "ElevateHer — Safe AI Career Mentorship",
  description:
    "AI-powered career mentorship for girls aged 14–22 in Southeast Asia. Works via SMS and USSD — no smartphone required.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "'Inter', sans-serif", margin: 0, padding: 0 }}>
        <QueryClientProvider client={queryClient}>
          <DemoRibbon />
          {children}
          <Toaster position="bottom-right" theme="dark" />
        </QueryClientProvider>
      </body>
    </html>
  );
}