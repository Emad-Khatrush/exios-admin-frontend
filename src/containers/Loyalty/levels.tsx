import { useEffect, useState } from 'react';
import { Tooltip } from '@mui/material';
import api from '../../api';
import LevelEmblem from './LevelEmblem';

// The loyalty levels (GET loyalty/tiers): names, colours, thresholds and perks, set in the API
// (accounting/services/loyalty/tiers.js). Read once and shared by every screen.
export type Tier = {
  key: string, name: string, nameEn: string, color: string, rank: number, min: number,
  multiplier: number, expiryMonths: number, upgradeGift: number, perks: string[],
};

let cache: Promise<Tier[]> | null = null;
export const loadTiers = () => {
  if (!cache) {
    cache = api.get('loyalty/tiers')
      .then((res: any) => (Array.isArray(res?.data?.tiers) ? res.data.tiers : []))
      .catch(() => { cache = null; return []; });
  }
  return cache as Promise<Tier[]>;
};

export const useTiers = () => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  useEffect(() => {
    let alive = true;
    loadTiers().then((list) => { if (alive) setTiers(list); });
    return () => { alive = false; };
  }, []);
  return tiers;
};

export const tierOf = (tiers: Tier[], key?: string | null) => tiers.find((t) => t.key === key) || tiers[0];

// "×1.25" without trailing zeros
export const timesText = (m: number) => `×${Number(m || 1).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// A level's name in its colour; with `perks`, hovering lists what the level gives (staff apply the
// service perks: priority, free consolidation, storage days...)
export const LevelBadge = ({ level, tiers, perks = false, size = 'md' }: { level?: string | null, tiers: Tier[], perks?: boolean, size?: 'sm' | 'md' }) => {
  const tier = tierOf(tiers, level);
  if (!tier) return null;
  const badge = (
    <span className={`lp-level-badge is-${size}${tier.rank === 0 ? ' is-base' : ''}`} style={{ ['--lv' as any]: tier.color }}>
      <LevelEmblem levelKey={tier.key} rank={tier.rank} size={size === 'sm' ? 15 : 18} />
      {tier.name}
    </span>
  );
  if (!perks || !tier.perks?.length) return badge;
  return (
    <Tooltip
      arrow placement="bottom-start"
      title={<ul style={{ margin: 0, padding: '2px 14px 2px 0', direction: 'rtl', textAlign: 'right' }}>{tier.perks.map((p) => <li key={p}>{p}</li>)}</ul>}
    >
      {badge}
    </Tooltip>
  );
};

export const WHY: Record<string, string> = { upgrade: 'ترقية', review: 'مراجعة سنوية', manual: 'تغيير يدوي' };
