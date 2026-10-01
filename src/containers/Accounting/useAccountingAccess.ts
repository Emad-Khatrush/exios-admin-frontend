import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { acc } from './accountingApi';

// What the signed-in user may do in accounting (the server decides; screens only hide what
// would be refused). Loaded once and shared by every screen until the page reloads.
export type AccountingAccess = { loading: boolean, isOwner: boolean, permissions: string[], can: (...keys: string[]) => boolean };

type Loaded = { isOwner: boolean, permissions: string[] };
let cache: { userId: string, value: Loaded } | null = null;
let pending: Promise<Loaded> | null = null;

const NONE: Loaded = { isOwner: false, permissions: [] };

const load = (userId: string): Promise<Loaded> => {
  if (cache?.userId === userId) return Promise.resolve(cache.value);
  if (pending) return pending;
  const request: Promise<Loaded> = acc.get('access/me')
    .then((res: any) => ({ isOwner: !!res.data.isOwner, permissions: res.data.permissions || [] }))
    .catch(() => NONE)
    .then((value: Loaded) => { cache = { userId, value }; pending = null; return value; });
  pending = request;
  return request;
};

// After the owner changes permissions, the next screen reads them again
export const forgetAccountingAccess = () => { cache = null; };

export const useAccountingAccess = (): AccountingAccess => {
  const account = useSelector((state: any) => state.session.account);
  // Clients never get here; staff ask the server (the owner accounts may have any role)
  const eligible = !!(account?.roles?.isAdmin || account?.roles?.isAccountant || account?.roles?.isEmployee);
  const userId = String(account?._id || '');
  const [value, setValue] = useState<Loaded | null>(cache?.userId === userId ? cache.value : null);

  useEffect(() => {
    if (!eligible) return;
    let alive = true;
    load(userId).then((loaded) => { if (alive) setValue(loaded); });
    return () => { alive = false; };
  }, [eligible, userId]);

  const current = eligible ? value : NONE;
  const permissions = current?.permissions || [];
  return {
    loading: eligible && !value,
    isOwner: !!current?.isOwner,
    permissions,
    can: (...keys: string[]) => keys.some((key) => permissions.includes(key)),
  };
};
