import { useEffect, useState } from 'react';
import { Alert, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { acc } from './accountingApi';
import { Amount, Ltr } from './ui';

// What the user says about a movement typed by hand that the bank statement already holds:
// a statement line's id (the document is matched to it), 'other' (another movement), '' (not said yet)
export type TwinChoice = string;

// Statement lines of the account, not matched yet, with this very amount within a week of the day.
// amount: + into the account / - out of it.
export const useStatementTwins = (accountId: string, amount: number, day: string) => {
  const [twins, setTwins] = useState<any[]>([]);
  // While the statement is being asked the page does not know yet, so it must not save
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!accountId || !day || !Number.isFinite(amount) || !amount) { setTwins([]); setChecking(false); return; }
    let active = true;
    setChecking(true);
    // The lines shown stay until the answer comes: choosing a line moves the day, and its choice must not vanish meanwhile
    const timer = setTimeout(() => {
      acc.get('bank/statement-twins', { accountId, amount, day })
        .then((res: any) => { if (active) setTwins(res.data.results || []); })
        .catch(() => { if (active) setTwins([]); /* the server still refuses an unanswered twin on save */ })
        .finally(() => { if (active) setChecking(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [accountId, amount, day]);
  return { twins, checking };
};

export const twinPayload = (choice: TwinChoice) => ({
  statementLineId: choice && choice !== 'other' ? choice : undefined,
  confirmNotInStatement: choice === 'other' ? true : undefined,
});

const StatementTwinNotice = ({ twins, currency, value, onChange }: { twins: any[]; currency: string; value: TwinChoice; onChange: (choice: TwinChoice, line?: any) => void }) => {
  if (!twins.length) return null;
  return (
    <Alert severity="warning" className="mt-3">
      <strong>هذه الحركة موجودة في كشف البنك ولم تُطابق بعد.</strong> اربطها بسطر الكشف حتى لا تُسجَّل التكلفة مرتين: تُرحَّل بتاريخ السطر ويُطابق بها في نفس الخطوة.
      <RadioGroup value={value} onChange={(e) => onChange(e.target.value, twins.find((twin) => twin._id === e.target.value))}>
        {twins.map((twin) => (
          <FormControlLabel key={twin._id} value={twin._id} control={<Radio size="small" />}
            label={<span>هي هذا السطر: <Ltr>{twin.day}</Ltr> · <Amount value={Math.abs(twin.amount)} currency={currency} /> · <Ltr>{twin.description}</Ltr></span>} />
        ))}
        <FormControlLabel value="other" control={<Radio size="small" />} label="حركة أخرى، غير هذه السطور" />
      </RadioGroup>
    </Alert>
  );
};

export default StatementTwinNotice;
