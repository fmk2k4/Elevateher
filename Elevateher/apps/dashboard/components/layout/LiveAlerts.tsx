'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useInstitution } from './InstitutionProvider';

export function LiveAlerts() {
  const { institution } = useInstitution();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!institution) return;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/dashboard/safety/stream?institution_id=${institution.id}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, message, severity, match_id } = data;
        
        if (severity === 'critical') {
          toast.error(type || 'Critical Safety Alert', {
            description: message || `Match ${match_id} requires immediate attention.`,
            duration: 10000,
          });
        } else if (severity === 'high') {
          toast.warning(type || 'Safety Alert', {
            description: message,
            duration: 8000,
          });
        } else {
          toast.info(type || 'Update', {
            description: message,
          });
        }
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    es.onerror = () => {
      // EventSource automatically reconnects on error, no need to show toast for disconnection unless debugging
      console.warn('SSE connection error. Retrying...');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [institution]);

  return null;
}
