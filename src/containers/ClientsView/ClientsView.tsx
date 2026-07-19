import React, { useEffect, useState } from 'react';
import Card from '../../components/Card/Card';
import Badge from '../../components/Badge/Badge';
import api, { base } from '../../api';
import { Button, CircularProgress } from '@mui/material';
import * as XLSX from 'xlsx';

// Sub-components
import ListView from './ListView';
import WalletsView from './WalletsView';
// @ts-ignore
import './ClientsView.scss';
import { Account } from '../../models';
import { useSelector } from 'react-redux';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import moment from 'moment';

export const ClientsView = () => {
  const account: Account = useSelector((state: any) => state.session?.account);
  const allowViewHiddenFields = useSelector((state: any) => state.session.account.roles.isAdmin || state.session.account.roles.accountant);
  
  const [view, setView] = useState<'list' | 'wallets'>('list');
  const [clients, setClients] = useState([]);
  const [downloadedClients, setDownloadedClients] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState('active');
  const [scrollReached, setScrollReached] = useState(false);
  
  const [meta, setMeta] = useState({
    limit: 10,
    skip: 0,
    counts: { openedWalletCounts: 0, verifyStatementCounts: 0, userCounts: 0 }
  });

  const [quickSearchDelayTimer, setQuickSearchDelayTimer] = useState<any>();
  const [cancelToken, setCancelToken] = useState(null);

  useEffect(() => {
    fetchClients(); 
  }, []);

  const fetchClients = async (limit = 10, skip = 0, allowLoading = false) => {
    try {
      if (allowLoading) setIsLoading(true);
      const response = (await api.get(`clients`, { limit, skip }))?.data;
      setClients(response.results);
      setMeta(response.meta);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }
  };

    const handleDownloadExcel = async () => {
      const clients = await fetchAllClients();
      const excelData = clients.map((client: any) => ({
        'ID': client?.customerId,
        'Name*': `${client?.firstName} ${client?.lastName}`,
        'Related Company': ``,
        'Email': client?.username,
        'Phone': `${client?.phone}`,
        'City': client?.city,
        'Country': 'ليبيا',
        'Reference': client?.customerId,
        'Notes': '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'last 1000 Clients');
      XLSX.writeFile(workbook, `All_Clients_Report_${moment().format('YYYY-MM-DD')}.xlsx`);
    };

  const fetchAllClients = async () => {
    try {
      setIsLoading(true);
      const response = (await api.get(`clients`, { skip: Math.max(0, meta.counts.userCounts - 1000), limit: 1000 }))?.data;
      setDownloadedClients(response.results);
      setIsLoading(false);

      return response.results;
    } catch (error) {
      setIsLoading(false);
    }
  };

  const fetchActiveWallets = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`wallets`);
      setWallets(response.data.results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUser = async (event: any) => {
    try {
      setIsLoading(true);
      const cancelTokenSource: any = base.cancelRequests();
      setCancelToken(cancelTokenSource);

      clearTimeout(quickSearchDelayTimer);
      const timer = setTimeout(async () => {
        const response = (await api.get(`clients?searchValue=${event.target.value}`, { cancelToken }))?.data;
        setClients(response.results);
        setIsLoading(false);
      }, 1);
      setQuickSearchDelayTimer(timer);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const currentScrollReached = event.currentTarget.scrollHeight - event.currentTarget.scrollTop <= event.currentTarget.clientHeight + 25;
    if (currentScrollReached !== scrollReached && Number(meta.limit) < meta.counts.userCounts) {
      fetchClients(Number(meta.limit) + 5, meta.skip, false);
      setScrollReached(currentScrollReached);
    }
  };

  const handleViewChange = (newView: 'list' | 'wallets') => {
    setView(newView);
    newView === 'wallets' ? fetchActiveWallets() : fetchClients();
  };

  const tabs = [
    { label: 'Active', value: 'active', icon: <Badge text={String(meta.counts.userCounts)} color="sky" /> },
    { label: 'Verify', value: 'verifyPayments', icon: <Badge text={String(meta.counts.verifyStatementCounts)} color="warning" /> },
    { label: 'Opened', value: 'openedWallet', icon: <Badge text={String(meta.counts.openedWalletCounts)} color="success" /> },
  ];

  return (
    <div className="clients-view-wrapper m-4">
      <div className="view-header">
        <div className="switcher-pill">
          <button className={view === 'list' ? 'active' : ''} onClick={() => handleViewChange('list')}>Clients</button>
          {account.roles.isAdmin && <button className={view === 'wallets' ? 'active' : ''} onClick={() => handleViewChange('wallets')}>Wallets</button>}
        </div>
      </div>

      <Card
        tabs={view === 'list' ? tabs : undefined}
        showSearchInput={view === 'list'}
        searchInputOnChange={searchUser}
        onScroll={view === 'list' && tab === 'active' ? onScroll : undefined}
        bodyStyle={{ height: '60vh', overflow: 'auto', marginTop: '20px' }}
      >
        {isLoading ? (
          <div className="text-center p-5"><CircularProgress /></div>
        ) : (
          view === 'list' ?
          <>
            {allowViewHiddenFields && (
              <Button 
                variant="contained" 
                color="success" 
                startIcon={<FileDownloadIcon />}
                onClick={handleDownloadExcel}
              sx={{ borderRadius: '10px', height: '42px', px: 3, fontWeight: 'bold' }}
            >
              Export All Clients
            </Button>
            )}

            <ListView clients={clients} />
          </>
            : 
            <WalletsView wallets={wallets} />
        )}
      </Card>
    </div>
  );
};