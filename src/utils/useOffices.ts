import { useEffect, useState } from 'react';
import { sys } from '../containers/Accounting/accountingApi';

// Offices are data (spec C4): the list comes from the offices defined in accounting, so a new
// office shows up in every dropdown without a code change. Loaded once per page load.
export type Office = { code: string; name: string; nameEn?: string };

const FALLBACK: Office[] = [
  { code: 'tripoli', name: 'طرابلس', nameEn: 'Tripoli' },
  { code: 'benghazi', name: 'بنغازي', nameEn: 'Benghazi' },
];

let loading: Promise<Office[]> | null = null;
const loadOffices = () => {
  if (!loading) {
    loading = sys.get('acc/offices')
      .then((res: any) => (res.data?.offices?.length ? res.data.offices : FALLBACK))
      .catch(() => {
        loading = null;
        return FALLBACK;
      });
  }
  return loading as Promise<Office[]>;
};

export const useOffices = (): Office[] => {
  const [offices, setOffices] = useState<Office[]>(FALLBACK);
  useEffect(() => {
    let alive = true;
    loadOffices().then((list) => { if (alive) setOffices(list); });
    return () => { alive = false; };
  }, []);
  return offices;
};

export const officeLabel = (office: Office, lang: 'ar' | 'en' = 'ar') => (lang === 'en' ? office.nameEn || office.name : office.name);
