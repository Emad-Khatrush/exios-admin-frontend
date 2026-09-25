import React, { useEffect, useState } from 'react';
import Card from '../../components/Card/Card';
import Badge from '../../components/Badge/Badge';
import api, { base } from '../../api';
import { Button, CircularProgress } from '@mui/material';
import * as XLSX from 'xlsx';

// Sub-components
import ListView from './ListView';
import WalletsView from './WalletsView';
import PassportReviewList from './PassportReviewList';
import ApprovedPassportList from './ApprovedPassportList';
// @ts-ignore
import './ClientsView.scss';
import { Account } from '../../models';
import { useSelector } from 'react-redux';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import moment from 'moment';

export const ClientsView = () => {
  const account: Account = useSelector((state: any) => state.session?.account);
  const allowViewHiddenFields = useSelector((state: any) => (state.session.account.roles.isAdmin || state.session.account.roles?.accountant));
  const canReviewPassports = useSelector((state: any) => (state.session.account.roles.isAdmin || state.session.account.roles?.isAccountant));
  
  const [view, setView] = useState<'list' | 'wallets' | 'passport'>('list');
  // Admin only (see the tab buttons below) - accountants just get the reviewing list, no tabs.
  const [passportTab, setPassportTab] = useState<'reviewing' | 'approved'>('reviewing');
  const [clients, setClients] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [pendingPassports, setPendingPassports] = useState([]);
  const [approvedPassports, setApprovedPassports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tab] = useState('active');
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

  const fetchPendingPassports = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`passportVerifications`);
      setPendingPassports(response.data.results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApprovedPassports = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`passportVerifications/approved`);
      setApprovedPassports(response.data.results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassportTabChange = (newTab: 'reviewing' | 'approved') => {
    setPassportTab(newTab);
    if (newTab === 'approved') fetchApprovedPassports();
    else fetchPendingPassports();
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

  const handleViewChange = (newView: 'list' | 'wallets' | 'passport') => {
    setView(newView);
    if (newView === 'wallets') fetchActiveWallets();
    else if (newView === 'passport') {
      setPassportTab('reviewing');
      fetchPendingPassports();
    }
    else fetchClients();
  };

  const tabs = [
    { label: 'Active', value: 'active', icon: <Badge text={String(meta.counts.userCounts)} color="sky" /> },
    { label: 'Verify', value: 'verifyPayments', icon: <Badge text={String(meta.counts.verifyStatementCounts)} color="warning" /> },
    { label: 'Opened', value: 'openedWallet', icon: <Badge text={String(meta.counts.openedWalletCounts)} color="success" /> },
  ];

  // Admin only - accountants (who can also open Passport Review) get just the reviewing
  // list below, no tabs at all.
  const passportTabs = [
    { label: 'Reviewing', value: 'reviewing' },
    { label: 'Approved', value: 'approved' },
  ];
  const showPassportTabs = view === 'passport' && account.roles.isAdmin;

  return (
    <div className="clients-view-wrapper m-4">
      <div className="view-header">
        <div className="switcher-pill">
          <button className={view === 'list' ? 'active' : ''} onClick={() => handleViewChange('list')}>Clients</button>
          {account.roles.isAdmin && <button className={view === 'wallets' ? 'active' : ''} onClick={() => handleViewChange('wallets')}>Wallets</button>}
          {canReviewPassports && <button className={view === 'passport' ? 'active' : ''} onClick={() => handleViewChange('passport')}>Passport Review</button>}
        </div>
      </div>

      <Card
        tabs={view === 'list' ? tabs : showPassportTabs ? passportTabs : undefined}
        tabsOnChange={(value: string) => { if (view === 'passport') handlePassportTabChange(value as 'reviewing' | 'approved'); }}
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
            : view === 'passport' ?
            (passportTab === 'approved' && account.roles.isAdmin ?
              <ApprovedPassportList customers={approvedPassports} />
              :
              <PassportReviewList
                customers={pendingPassports}
                onReviewed={(customerId) => setPendingPassports((prev) => prev.filter((c: any) => c._id !== customerId))}
              />
            )
            :
            <WalletsView wallets={wallets} />
        )}
      </Card>
    </div>
  );
};