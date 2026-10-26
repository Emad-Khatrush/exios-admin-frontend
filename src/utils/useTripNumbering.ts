import { useEffect, useState } from 'react';
import api from '../api';

type Preview = { key: string; enabled: boolean; voyage: string; loading: boolean; error: string; ready: boolean };
const empty: Preview = { key: '', enabled: false, voyage: '', loading: false, error: '', ready: false };

export const newTripCreationRequestId = () => {
  const values = window.crypto.getRandomValues(new Uint32Array(4));
  return `${Date.now().toString(36)}-${Array.from(values).map(value => value.toString(36)).join('-')}`;
};

export const useTripNumbering = (country?: string, shippingType?: string, seaLoadType?: string) => {
  const load = shippingType === 'sea' ? seaLoadType || '' : '';
  const key = country && shippingType && (shippingType !== 'sea' || ['FCL', 'LCL'].includes(load)) ? `${country}:${shippingType}:${load}` : '';
  const [state, setState] = useState<Preview>(empty);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!key) { setState(empty); return; }
    let active = true;
    setState({ ...empty, key, loading: true });
    api.get('inventory/numbering-preview', { country, shippingType, seaLoadType: load })
      .then(response => {
        if (active) setState({ key, enabled: response.data.enabled, voyage: response.data.voyage || '', loading: false, ready: true, error: '' });
      })
      .catch(error => {
        if (active) setState({ ...empty, key, error: error?.response?.data?.message || 'Unable to load trip numbering. Please retry before creating the trip.' });
      });
    return () => { active = false; };
  }, [key, country, shippingType, load, retry]);

  // Never expose a previous country's preview between render and effect execution.
  const current = state.key === key ? state : { ...empty, key, loading: !!key };
  return { ...current, retry: () => { setState({ ...empty, key, loading: true }); setRetry(value => value + 1); } };
};
