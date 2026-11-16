import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Checkbox, CircularProgress, FormControlLabel, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField } from '@mui/material';
import moment from 'moment';
import api from '../../api';
import { requestError } from '../EditInvoice/OrderPointsDialog';

const PAGE_SIZE = 25;

const pointsText = (value: number) => Number(value || 0).toLocaleString('en-US');
const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (value?: string) => (value ? moment(value).format('DD/MM/YYYY') : '-');

// Customers who hold loyalty points, with what is outstanding in all
const LoyaltyCustomers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'balance' | 'expiring'>('balance');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The search runs when typing pauses
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');
    api.get('loyalty/customers', { search: query, sort, expiringOnly, page: page + 1, limit: PAGE_SIZE })
      .then((res: any) => { if (!stale) setData(res.data); })
      .catch((e: any) => { if (!stale) setError(requestError(e, 'Could not load the customers with points.')); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [query, sort, expiringOnly, page]);

  const totals = data?.totals;
  const rows: any[] = data?.rows || [];
  const stats: [string, string][] = [
    ['Customers', totals ? pointsText(totals.customers) : '-'],
    ['Points outstanding', totals ? pointsText(totals.points) : '-'],
    ['Value', totals ? `$${money(Number(totals.usd ?? totals.points / 100))}` : '-'],
  ];

  return (
    <div className="m-2">
      <h1 style={{ fontSize: 24, margin: '8px 0 16px' }}>Loyalty points</h1>
      {error && <Alert severity="error" sx={{ mb: 2 }} dir="auto">{error}</Alert>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {stats.map(([label, value]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, minWidth: 180 }}>
            <div style={{ opacity: 0.7, fontSize: 13 }}>{label}</div>
            <strong style={{ fontSize: 22 }}>{value}</strong>
          </Paper>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <TextField size="small" label="Search" placeholder="Name, code or phone" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: 260 }} />
        <TextField select size="small" label="Sort by" value={sort} onChange={(event) => { setSort(event.target.value as any); setPage(0); }} sx={{ minWidth: 180 }}>
          <MenuItem value="balance">Highest balance</MenuItem>
          <MenuItem value="expiring">Expiring first</MenuItem>
        </TextField>
        <FormControlLabel
          control={<Checkbox checked={expiringOnly} onChange={(event) => { setExpiringOnly(event.target.checked); setPage(0); }} />}
          label="Expiring in 30 days"
        />
        {loading && <CircularProgress size={20} />}
      </div>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell align="right">$</TableCell>
                <TableCell>Expiring soon</TableCell>
                <TableCell>Last movement</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center">{loading ? 'Loading' : 'No customers with points'}</TableCell></TableRow>}
              {rows.map((row) => (
                <TableRow key={row.userId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/user/${row.userId}?tab=points`)}>
                  <TableCell dir="auto">{row.name || '-'}</TableCell>
                  <TableCell>{row.customerId || '-'}</TableCell>
                  <TableCell>{row.phone || '-'}</TableCell>
                  <TableCell align="right"><strong>{pointsText(row.points)}</strong></TableCell>
                  <TableCell align="right">${money(Number(row.usd ?? row.points / 100))}</TableCell>
                  <TableCell>{row.expiringSoon ? `${pointsText(row.expiringSoon.points)} on ${dateText(row.expiringSoon.at)}` : '-'}</TableCell>
                  <TableCell>{dateText(row.lastMovementAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={data?.total || 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, next) => setPage(next)}
        />
      </Paper>
    </div>
  );
};

export default LoyaltyCustomers;
