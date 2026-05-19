export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" aria-hidden />
      {label}
    </div>
  );
}
