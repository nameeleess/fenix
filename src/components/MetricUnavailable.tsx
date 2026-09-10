export function MetricUnavailable({ exception, label = 'Métrica no disponible' }: { exception: string; label?: string }) {
  return <div className="ds-neutral-metric" data-central-exception={exception}><strong>—</strong><span>{label}</span></div>
}
