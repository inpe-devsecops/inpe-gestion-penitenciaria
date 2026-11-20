export function MarcaSistema() {
  return (
    <div className="marca-sistema">
      <svg className="marca-sistema__simbolo" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="3" y="3" width="34" height="34" rx="8" fill="currentColor" />
        <path d="M11 28V18h6v10M23 28V12h6v16" fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="29" cy="10" r="3" fill="#e1a33a" />
      </svg>
      <span className="marca-sistema__texto">
        <strong>Vigía</strong>
        <small>Gestión penitenciaria</small>
      </span>
    </div>
  );
}
