// Understated geometric line pattern for dark panels (pure SVG, no inline styles, CSP-safe).
import * as React from 'react';

export function GeometricPattern({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 800">
      <defs>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1" />
        </pattern>
        <radialGradient id={`${id}-fade`} cx="0.8" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}><rect width="800" height="800" fill={`url(#${id}-fade)`} /></mask>
      </defs>
      <rect width="800" height="800" fill={`url(#${id}-grid)`} />
      <g mask={`url(#${id}-mask)`} fill="none" stroke="#ffffff">
        {[120, 200, 280, 360, 440, 520].map((r, i) => (
          <circle key={r} cx="680" cy="140" r={r} strokeOpacity={0.09 - i * 0.012} />
        ))}
        <path d="M0 620 L800 260" strokeOpacity="0.06" />
        <path d="M0 700 L800 340" strokeOpacity="0.04" />
      </g>
    </svg>
  );
}
