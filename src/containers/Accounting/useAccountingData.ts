import { useCallback, useEffect, useState } from 'react';
import { acc } from './accountingApi';

export type AccountingAccount = {
  _id: string;
  code: string;
  name: string;
  nameEn?: string;
  type: string;
  isGroup: boolean;
  parentId: string | null;
  currency: string | null;
  isCash: boolean;
  cashKind?: string | null;
  office?: string | null;
  requires: string[];
  allowManualEntry: boolean;
  isActive: boolean;
  totals?: { openingUsd: number; debit: number; credit: number; closingUsd: number; foreign: number };
};

// Loads the lists most accounting screens need (chart, offices, currencies)
export const useAccountingData = () => {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accountsRes, officesRes, currenciesRes] = await Promise.all([
        acc.get('accounts'),
        acc.get('offices'),
        acc.get('currencies'),
      ]);
      setAccounts(accountsRes.data.results);
      setOffices(officesRes.data.results);
      setCurrencies(currenciesRes.data.results);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { accounts, offices, currencies, isLoading, reload };
};

// Accounts in tree order (parents before children) with their depth
export const toTree = (accounts: AccountingAccount[]) => {
  const children = new Map<string, AccountingAccount[]>();
  accounts.forEach((account) => {
    const key = account.parentId || 'root';
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(account);
  });
  children.forEach((list) => list.sort((a, b) => a.code.localeCompare(b.code)));

  const rows: { account: AccountingAccount; depth: number }[] = [];
  const walk = (key: string, depth: number) => {
    (children.get(key) || []).forEach((account) => {
      rows.push({ account, depth });
      walk(account._id, depth + 1);
    });
  };
  walk('root', 0);
  return rows;
};

export const accountLabel = (account?: AccountingAccount | null) => (account ? `${account.code} · ${account.name}` : '');
