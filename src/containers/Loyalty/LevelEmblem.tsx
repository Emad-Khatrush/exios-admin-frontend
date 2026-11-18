import { useState } from 'react';

// A copy of the client app's emblem (Exios-Client/src/containers/PointsPage/LevelEmblem.tsx): keep
// both the same. React 17 here has no useId, so each emblem takes the next number once.
let nextId = 0;

// The emblem of a loyalty level: a perforated travel stamp in the level's metal (owner's choice
// 2026-11-18). Its picture follows a shipment's journey: a parcel, a ship, a plane, a container, and
// the world with a crown; five dots under it light up to the level. A light sweeps across it.
// The level names and rules come from the server; the look is chosen by the level's key, or by its
// rank for a key this app does not know yet.

type Metal = { light: string, mid: string, dark: string, core: [string, string], mark: string };

const METALS: Record<string, Metal> = {
  bronze: { light: '#f6d2ae', mid: '#c27a45', dark: '#7a3f1c', core: ['#9a5226', '#5e2c10'], mark: '#ffe4c8' },
  silver: { light: '#ffffff', mid: '#c3ccd8', dark: '#6b7686', core: ['#8590a0', '#4b5563'], mark: '#f8fafc' },
  gold: { light: '#fff3b0', mid: '#e0ac2e', dark: '#94650c', core: ['#ae7a12', '#6b4705'], mark: '#fff6c8' },
  platinum: { light: '#f4f7fb', mid: '#a9b6c8', dark: '#3b4859', core: ['#465569', '#1f2937'], mark: '#e8eef7' },
  diamond: { light: '#e0f2fe', mid: '#5aa9f5', dark: '#1e40af', core: ['#2563eb', '#172554'], mark: '#e0f2fe' },
};
const BY_RANK = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

const polar = (r: number, deg: number): [number, number] => [
  Number((32 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)),
  Number((32 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)),
];
// The stamp's perforation: 24 notches around the edge
const HOLES = Array.from({ length: 24 }, (_, i) => polar(29, 15 * i));
// The five level dots along the bottom of the inner ring
const DOTS = Array.from({ length: 5 }, (_, i) => polar(19.5, 90 + (i - 2) * 16));

const Picture = ({ kind, color }: { kind: number, color: string }) => {
  switch (kind) {
    case 0: // a parcel
      return (
        <g fill={color}>
          <path d="M32 21 L42 26 L32 31 L22 26 Z" />
          <path d="M22 26 L32 31 V42 L22 37 Z" opacity="0.75" />
          <path d="M42 26 L32 31 V42 L42 37 Z" opacity="0.5" />
        </g>
      );
    case 1: // a ship with containers on the waves
      return (
        <g fill={color}>
          <path d="M19 34 H45 L41 41.5 H23 Z" />
          <rect x="24" y="27.5" width="7" height="5.5" rx="0.8" />
          <rect x="32" y="27.5" width="7" height="5.5" rx="0.8" opacity="0.8" />
          <rect x="28" y="21" width="7" height="5.5" rx="0.8" opacity="0.9" />
          <path d="M18 45 q3.5 -2 7 0 t7 0 t7 0 t7 0" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case 2: // a plane
      return (
        <path
          d="M32 19 C33.4 19 34 20.5 34 22 V29 L44 35 V38 L34 34.5 V40 L37 42.5 V44.5 L32 43 L27 44.5 V42.5 L30 40 V34.5 L20 38 V35 L30 29 V22 C30 20.5 30.6 19 32 19 Z"
          fill={color} transform="rotate(45 32 32)"
        />
      );
    case 3: // a shipping container lifted on a crane hook
      return (
        <g>
          <path d="M32 17 V21.5 M32 21.5 L21.5 26 M32 21.5 L42.5 26" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
          <circle cx="32" cy="21.5" r="1.4" fill={color} />
          <rect x="19.5" y="26" width="25" height="15" rx="1.2" fill={color} />
          <path d="M23.5 28.5 V38.5 M27 28.5 V38.5 M30.5 28.5 V38.5 M34 28.5 V38.5 M37.5 28.5 V38.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M40.5 28 V39" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
          <rect x="19.5" y="26" width="25" height="2" rx="1" fill="currentColor" opacity="0.18" />
        </g>
      );
    default: // the world with a crown
      return (
        <g>
          <g fill="none" stroke={color} strokeWidth="1.6">
            <circle cx="32" cy="35" r="9" />
            <ellipse cx="32" cy="35" rx="4" ry="9" />
            <path d="M23 35 H41 M24.7 30.5 H39.3 M24.7 39.5 H39.3" />
          </g>
          <path d="M25 25 L25 18.5 L28.5 21.5 L32 16.5 L35.5 21.5 L39 18.5 L39 25 Z" fill={color} />
        </g>
      );
  }
};

type Props = {
  levelKey: string
  rank: number
  size?: number
  // A level not reached yet: grey and still
  locked?: boolean
  className?: string
  title?: string
}

const LevelEmblem = ({ levelKey, rank, size = 56, locked = false, className = '', title }: Props) => {
  const metalKey = METALS[levelKey] ? levelKey : BY_RANK[Math.min(Math.max(rank, 0), BY_RANK.length - 1)];
  // The metal is part of the id, so two emblems that ever share an id still share the same colours
  const [n] = useState(() => { nextId += 1; return nextId; });
  const id = `lv-${metalKey}-${n}`;
  const metal = METALS[metalKey];
  const kind = BY_RANK.indexOf(metalKey);
  return (
    <svg
      viewBox="0 0 64 64" width={size} height={size}
      className={`lv-emblem lv-emblem--${metalKey}${locked ? ' is-locked' : ''} ${className}`}
      style={{ color: metal.dark }}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={metal.light} />
          <stop offset="0.5" stopColor={metal.mid} />
          <stop offset="1" stopColor={metal.dark} />
        </linearGradient>
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={metal.core[0]} />
          <stop offset="1" stopColor={metal.core[1]} />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-holes`}>
          <rect width="64" height="64" fill="#fff" />
          {HOLES.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="2.6" fill="#000" />)}
        </mask>
        <clipPath id={`${id}-clip`}><circle cx="32" cy="32" r="29" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${id}-rim)`} stroke={metal.dark} strokeWidth="1.5" mask={`url(#${id}-holes)`} />
      <circle cx="32" cy="32" r="22.5" fill={`url(#${id}-core)`} />
      <circle cx="32" cy="32" r="20.5" fill="none" stroke={metal.light} strokeOpacity="0.6" strokeWidth="0.9" strokeDasharray="2 2" />
      <Picture kind={kind} color={metal.mark} />
      {DOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill={i <= kind ? metal.mark : metal.dark} opacity={i <= kind ? 1 : 0.5} />
      ))}
      {!locked && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect className="lv-emblem__sheen" x="-30" y="-10" width="16" height="90" fill={`url(#${id}-sheen)`} />
        </g>
      )}
      {!locked && kind === BY_RANK.length - 1 && (
        <g className="lv-emblem__sparks" fill={metal.mid}>
          <path d="M53 7 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" />
          <path d="M9 50 l0.9 2.2 2.2 0.9 -2.2 0.9 -0.9 2.2 -0.9 -2.2 -2.2 -0.9 2.2 -0.9 z" />
          <path d="M56 52 l0.7 1.7 1.7 0.7 -1.7 0.7 -0.7 1.7 -0.7 -1.7 -1.7 -0.7 1.7 -0.7 z" />
        </g>
      )}
    </svg>
  );
};

export default LevelEmblem;
