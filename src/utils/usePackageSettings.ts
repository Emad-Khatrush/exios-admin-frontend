import { useEffect, useState } from 'react';
import { sys } from '../containers/Accounting/accountingApi';

// The package dialog's settings (spec v8): the volumetric factor (KG per CBM), and whether the
// signed-in user may change a weight or volume that was already saved. Loaded once per page load.
export type PackageSettings = { volumetricFactor: number; canEditMeasures: boolean; rate?: number | null };

const FALLBACK: PackageSettings = { volumetricFactor: 167, canEditMeasures: false };
let loading: Promise<PackageSettings> | null = null;

const load = (): Promise<PackageSettings> => {
  if (!loading) {
    loading = sys.get('acc/package-settings')
      .then((res: any) => ({ ...FALLBACK, ...(res.data || {}) }))
      .catch(() => {
        loading = null;
        return FALLBACK;
      });
  }
  return loading as Promise<PackageSettings>;
};

export const usePackageSettings = (): PackageSettings => {
  const [settings, setSettings] = useState<PackageSettings>(FALLBACK);
  useEffect(() => {
    let alive = true;
    load().then((value) => { if (alive) setSettings(value); });
    return () => { alive = false; };
  }, []);
  return settings;
};

// CBM typed, or length x width x height in centimetres
export const cbmOf = (v: { cbm?: any; length?: any; width?: any; height?: any } = {}) => {
  if (Number(v.cbm) > 0) return Number(v.cbm);
  const dims = [v.length, v.width, v.height].map(Number);
  return dims.every((d) => d > 0) ? (dims[0] * dims[1] * dims[2]) / 1e6 : 0;
};
