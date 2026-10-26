import { useEffect } from 'react';
import { telemetrySchema } from '@insight/shared';
import { api } from '../lib/api';
import { useDashboardStore } from '../store/dashboardStore';

export function useTelemetryStream() {
  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | null = null;
    let stopped = false;
    let attempt = 0;

    const store = useDashboardStore.getState;

    const connect = () => {
      if (stopped) return;
      source?.close();
      store().setConnection(attempt === 0 ? 'connecting' : 'reconnecting');

      source = new EventSource('/api/telemetry/stream');

      source.onopen = () => {
        attempt = 0;
        store().setConnection('live');
      };

      source.onmessage = (event) => {
        try {
          const parsed = telemetrySchema.safeParse(JSON.parse(event.data));
          if (!parsed.success) return;
          store().applyTelemetry(parsed.data);
          store().setConnection('live');
        } catch {
          // A malformed frame should not tear down the stream.
        }
      };

      source.onerror = () => {
        if (stopped) return;
        store().setConnection('reconnecting');
        source?.close();
        attempt += 1;
        const delay = Math.min(8_000, 700 * attempt);
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    api
      .getState()
      .then((telemetry) => {
        if (stopped) return;
        store().hydrate(telemetry);
      })
      .catch(() => {
        if (!stopped) store().setConnection('reconnecting');
      });

    connect();

    const handleOnline = () => {
      if (stopped) return;
      attempt = 0;
      connect();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      stopped = true;
      source?.close();
      window.removeEventListener('online', handleOnline);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, []);
}
