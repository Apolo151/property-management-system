const DASHBOARD_METRICS_CHANGED_EVENT = 'dashboard:metrics-changed';

export function emitDashboardMetricsChanged(reason = 'unknown') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_METRICS_CHANGED_EVENT, {
      detail: {
        reason,
        emittedAt: Date.now(),
      },
    })
  );
}

export function subscribeDashboardMetricsChanged(handler) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event) => {
    handler(event.detail || {});
  };

  window.addEventListener(DASHBOARD_METRICS_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(DASHBOARD_METRICS_CHANGED_EVENT, listener);
  };
}
