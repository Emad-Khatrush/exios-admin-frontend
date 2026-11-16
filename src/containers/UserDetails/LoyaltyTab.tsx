import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination } from '@mui/material';
import moment from 'moment';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';
import AdjustPointsDialog from './AdjustPointsDialog';

type Props = {
  userId: string
  // Called after points were adjusted, so the header balance can be read again
  onChanged: () => void
  // Bumped by the parent when the balance should be read again
  version?: number
}

const PAGE_SIZE = 20;

const KINDS: Record<string, string> = {
  earn: 'Earned', add: 'Added by staff', restore: 'Restored', redeem: 'Used', deduct: 'Deducted by staff', expire: 'Expired', revoke: 'Revoked',
};
const WAITING: Record<string, string> = {
  payment: 'Awaiting payment', delivery: 'Awaiting delivery', processing: 'Being added (within an hour)',
};

const pointsText = (value: number) => Number(value || 0).toLocaleString('en-US');
const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (value?: string) => (value ? moment(value).format('DD/MM/YYYY HH:mm') : '-');
// Points that leave the balance are shown with a minus
const NEGATIVE = new Set(['redeem', 'deduct', 'expire', 'revoke']);
const signed = (kind: string, points: number) => {
  const value = Math.abs(Number(points || 0));
  return `${NEGATIVE.has(kind) ? '-' : '+'}${pointsText(value)}`;
};

// A customer's loyalty points: balance, what is coming, and every movement
const LoyaltyTab = ({ userId, onChanged, version = 0 }: Props) => {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`user/${userId}/loyalty`, { page: nextPage + 1 });
      setData(res.data);
    } catch (e: any) {
      setError(requestError(e, 'Could not load the points.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(page); }, [load, page, version]);

  if (!data) {
    return error ? <Alert severity="error" dir="auto">{error}</Alert> : <div className="text-center p-5"><CircularProgress /></div>;
  }

  const rows: any[] = data.history?.rows || [];
  const pending: any[] = data.pending || [];
  const orderLink = (row: any) => (row.orderId
    ? <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer">{row.orderNumber || 'Order'}</a>
    : '-');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <Alert severity="error" dir="auto">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          <div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>Balance</div>
            <strong style={{ fontSize: 24 }}>{pointsText(data.points)} pts</strong>
            <span style={{ marginLeft: 8, opacity: 0.8 }}>(${money(Number(data.usd ?? data.points / 100))})</span>
          </div>
          <div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>Expiring soon</div>
            {data.expiringSoon
              ? <strong>{pointsText(data.expiringSoon.points)} pts on {dateText(data.expiringSoon.at)}</strong>
              : <span>None</span>}
          </div>
          <div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>Earned / used in all</div>
            <strong>{pointsText(data.earnedTotal)} / {pointsText(data.redeemedTotal)}</strong>
          </div>
        </div>
        <Button variant="contained" size="small" type="button" onClick={() => setAdjusting(true)}>Adjust points</Button>
      </Paper>

      {pending.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <strong>On their way</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {pending.map((row) => (
              <li key={`${row.orderId}-${row.waitingFor}`}>
                <a href={`/invoice/${row.orderId}/edit`} target="_blank" rel="noreferrer">{row.orderNumber || 'Order'}</a>
                {': '}{pointsText(row.points)} pts, {WAITING[row.waitingFor] || row.waitingFor}
              </li>
            ))}
          </ul>
        </Paper>
      )}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Expires</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center">{loading ? 'Loading' : 'No movements yet'}</TableCell></TableRow>}
              {rows.map((row, index) => (
                <TableRow key={`${row.createdAt}-${index}`} hover>
                  <TableCell>{dateText(row.createdAt)}</TableCell>
                  <TableCell>{KINDS[row.kind] || row.kind}</TableCell>
                  <TableCell align="right" style={{ color: NEGATIVE.has(row.kind) ? '#c62828' : '#2e7d32', fontWeight: 600 }}>{signed(row.kind, row.points)}</TableCell>
                  <TableCell>{orderLink(row)}</TableCell>
                  <TableCell dir="auto">{row.reason || '-'}</TableCell>
                  <TableCell>{row.kind === 'earn' || row.kind === 'add' || row.kind === 'restore' ? dateText(row.expiresAt) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={data.history?.total || 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, next) => setPage(next)}
        />
      </Paper>

      <AdjustPointsDialog
        open={adjusting} userId={userId} balance={Number(data.points || 0)} onClose={() => setAdjusting(false)}
        onSaved={() => { setPage(0); onChanged(); }}
      />
    </div>
  );
};

export default LoyaltyTab;
