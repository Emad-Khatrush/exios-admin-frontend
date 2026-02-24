import React, { useEffect, useState } from 'react';
import Card from '../../components/Card/Card';
import Badge from '../../components/Badge/Badge';
import api, { base } from '../../api';
import { CircularProgress } from '@mui/material';

// Sub-components
import ListView from './ListView';
import WalletsView from './WalletsView';
import './ClientsView.scss';
import { Account } from '../../models';
import { useSelector } from 'react-redux';

export const ClientsView = () => {
  const account: Account = useSelector((state: any) => state.session?.account)
  
  const [view, setView] = useState<'list' | 'wallets'>('list');
  const [clients, setClients] = useState([]);
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
          view === 'list' ? <ListView clients={clients} /> : <WalletsView wallets={wallets} />
        )}
      </Card>
    </div>
  );
};