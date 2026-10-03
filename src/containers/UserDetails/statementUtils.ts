import { useEffect, useState } from 'react';
import { sys } from '../Accounting/accountingApi';

export const formatMoney = (value: number, currency: string) =>
  `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const statementOffices = [
  { value: 'tripoli', label: 'Tripoli' },
  { value: 'benghazi', label: 'Benghazi' },
  { value: 'turkey', label: 'Turkey' },
  { value: 'china', label: 'China' },
  { value: 'almutahidaTrBank', label: 'Almutahida TR Bank' },
  { value: 'bank', label: 'Libyan bank' },
];

// The offices and banks a cash deposit in this currency can go to: only places with a box in that
// currency, so a dinar deposit cannot be put in an office that keeps dollars only. null while loading
export type DepositPlace = { value: string; label: string; kind: 'office' | 'bank' };
export const useDepositPlaces = (currency?: string) => {
  const [places, setPlaces] = useState<DepositPlace[] | null>(null);
  useEffect(() => {
    setPlaces(null);
    if (!currency) return;
    let alive = true;
    sys.get('acc/deposit-places', { currency })
      .then((res: any) => { if (alive) setPlaces(res.data.results || []); })
      .catch(() => { if (alive) setPlaces([]); });
    return () => { alive = false; };
  }, [currency]);
  return places;
};

export const getOfficeLabel = (office?: string) =>
  statementOffices.find((item) => item.value === office)?.label || office || '';

// What a statement line really is. Only cash/bank deposits and cash withdrawals move
// real money; refunds, compensation and cancellations credit the wallet without any
// cash coming in, and paying orders/debts from the wallet spends balance, not cash.
export type StatementFlow = 'cashIn' | 'credit' | 'spent' | 'cashOut';

const CREDIT_ACTIONS = ['refund', 'compensation', 'cancellation', 'wallet'];

export const statementFlow = (statement: { calculationType?: string, actionType?: string, paymentType?: string }): StatementFlow => {
  if (statement.calculationType === '-') {
    return statement.actionType === 'withdrawal' || statement.paymentType === 'withdrawal' ? 'cashOut' : 'spent';
  }
  // Older deposits were saved before actionType existed; those were cash top-ups.
  return CREDIT_ACTIONS.includes(statement.actionType || '') ? 'credit' : 'cashIn';
};

export const summarizeStatements = (statements: any[]) =>
  statements.reduce((acc: Record<StatementFlow, number>, statement: any) => {
    acc[statementFlow(statement)] += Number(statement.amount || 0);
    return acc;
  }, { cashIn: 0, credit: 0, spent: 0, cashOut: 0 });
