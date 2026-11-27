import { useState } from 'react';
import { Button, Snackbar } from '@mui/material';
import { Download } from 'lucide-react';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { downloadCsv } from './format';
import { useEnv } from './shared';

type Query = Record<string, string | number | null | undefined>
type Cell = string | number | null | undefined

// A whole list of a section (limit=all: every row, up to 20,000 on the API) with the same filters
// as the page shows; `pick` takes the list out of the answer (rows, waiting.rows, list.rows, low.rows)
export const useFullList = () => {
  const { common } = useEnv();
  return async <R, >(section: string, query: Query, pick: (data: any) => R[] | undefined): Promise<R[]> => {
    const params: Record<string, string | number> = {};
    Object.entries({ ...common, ...query, page: null, limit: 'all' }).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params[k] = v;
    });
    const res = await api.get(`analytics/customers/${section}`, params);
    return pick(res.data) || [];
  };
};

// «تصدير CSV»: reads the whole list, not the page on screen, then saves it
export const ExportButton = <R, >({ section, query, pick, name, header, row, disabled }: {
  section: string, query: Query, pick: (data: any) => R[] | undefined, name: string, header: string[], row: (r: R) => Cell[], disabled?: boolean
}) => {
  const fetchAll = useFullList();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    try {
      const rows = await fetchAll<R>(section, query, pick);
      downloadCsv(name, header, rows.map(row));
    } catch (e) {
      setError(requestError(e, 'تعذّر تجهيز الملف. أعد المحاولة.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outlined" size="small" startIcon={<Download size={16} />} onClick={run} disabled={disabled || busy}>
        {busy ? 'جارٍ التجهيز…' : 'تصدير CSV'}
      </Button>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} message={error} />
    </>
  );
};
