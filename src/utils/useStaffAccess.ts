import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api';

// What the signed-in staff member may open outside accounting (the API decides; the app only hides
// what would be refused). Loaded once per user and shared until the page reloads.
// - full: an admin or an owner account, everything
// - configured: a staff member whose permissions were saved in Settings > Permissions
// - neither: not configured yet, keeps the pages their role gave them
export type StaffAccess = {
  loading: boolean,
  full: boolean,
  isOwner: boolean,
  configured: boolean,
  canManage: boolean,
  permissions: string[],
  can: (...keys: string[]) => boolean,
};

type Loaded = Omit<StaffAccess, 'loading' | 'can'>;
const NONE: Loaded = { full: false, isOwner: false, configured: false, canManage: false, permissions: [] };

let cache: { userId: string, value: Loaded } | null = null;
let pending: { userId: string, promise: Promise<Loaded> } | null = null;
const listeners = new Set<() => void>();

const load = (userId: string): Promise<Loaded> => {
  if (cache?.userId === userId) return Promise.resolve(cache.value);
  if (pending?.userId === userId) return pending.promise;
  const promise = api.get('staff-access/me')
    .then((res: any) => ({
      full: !!res.data.full,
      isOwner: !!res.data.isOwner,
      configured: !!res.data.configured,
      canManage: !!res.data.canManage,
      permissions: res.data.permissions || [],
    }))
    // An API without permissions yet, or a network error: behave as before (role-based pages)
    .catch(() => NONE)
    .then((value: Loaded) => {
      cache = { userId, value };
      pending = null;
      return value;
    });
  pending = { userId, promise };
  return promise;
};

// After permissions change, read them again (the person editing never changes their own, but this
// keeps every open screen honest)
export const forgetStaffAccess = () => {
  cache = null;
  listeners.forEach((listener) => listener());
};

export const useStaffAccess = (): StaffAccess => {
  const account = useSelector((state: any) => state.session.account);
  const roles = account?.roles || {};
  const eligible = !!(roles.isAdmin || roles.isEmployee || roles.isAccountant);
  const userId = String(account?._id || '');
  const [value, setValue] = useState<Loaded | null>(cache?.userId === userId ? cache.value : null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (!eligible || !userId) return;
    let alive = true;
    load(userId).then((loaded) => { if (alive) setValue(loaded); });
    return () => { alive = false; };
  }, [eligible, userId, version]);

  // Admins don't wait: until the API answers they have everything. Once it answers, it decides, so
  // an admin the owner turned into an employee (still an admin in this browser's saved session) gets
  // the employee's pages on the next load.
  const current: Loaded = !eligible ? NONE
    : value || (roles.isAdmin ? { ...NONE, full: true, canManage: true } : NONE);
  const permissions = current.permissions;
  return {
    ...current,
    loading: eligible && !roles.isAdmin && !value,
    can: (...keys: string[]) => current.full || keys.some((key) => permissions.includes(key)),
  };
};
