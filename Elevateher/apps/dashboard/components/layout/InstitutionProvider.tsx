'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface Institution {
  id: string;
  name: string;
  country: string;
  type: string;
  subdomain: string;
}

interface InstitutionContextValue {
  institution: Institution | null;
  subdomain: string;
  requestedSubdomain: string;
  loading: boolean;
  error: string | null;
}

const InstitutionContext = createContext<InstitutionContextValue>({
  institution: null,
  subdomain: '',
  requestedSubdomain: '',
  loading: true,
  error: null,
});

const SUBDOMAIN_ALIASES: Record<string, string> = {
  'nyp-singapore': 'nyp',
  'binus-indonesia': 'binus',
};

function normalizeSubdomain(subdomain: string) {
  const normalized = subdomain.trim().toLowerCase();
  return SUBDOMAIN_ALIASES[normalized] || normalized;
}

export function useInstitution() {
  return useContext(InstitutionContext);
}

export const InstitutionProvider = ({
  subdomain,
  children,
}: {
  subdomain: string;
  children: React.ReactNode;
}) => {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    const normalizedSubdomain = normalizeSubdomain(subdomain);

    fetch(`/api/institutions/${normalizedSubdomain}`, { cache: 'no-store' })
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) {
          throw new Error(payload?.message || payload?.error || 'Unable to load institution metadata');
        }
        return payload;
      })
      .then((payload) => {
        if (!isMounted) return;
        setInstitution(payload);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setInstitution(null);
        setError(err.message);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      };
  }, [subdomain]);

  const canonicalSubdomain = institution?.subdomain || normalizeSubdomain(subdomain);

  return (
    <InstitutionContext.Provider
      value={{
        institution,
        subdomain: canonicalSubdomain,
        requestedSubdomain: subdomain,
        loading,
        error,
      }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

// Default export for SWC compatibility
export default InstitutionProvider;
