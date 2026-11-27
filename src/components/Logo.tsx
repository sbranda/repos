/** Logo de la app: ramas de git sobre un degradé violeta-azul. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#logo-g)" />
      <g fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="176" cy="148" r="40" />
        <circle cx="176" cy="364" r="40" />
        <circle cx="336" cy="212" r="40" />
        <path d="M176 188v136" />
        <path d="M336 252c0 56-56 64-120 82" />
      </g>
    </svg>
  )
}
