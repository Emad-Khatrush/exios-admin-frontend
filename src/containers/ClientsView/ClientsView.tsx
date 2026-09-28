import { useState } from 'react';
import { CircularProgress } from '@mui/material';
import { IdCard, Users, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import Card from '../../components/Card/Card';
import api from '../../api';
import { Account } from '../../models';

// Sub-components
import ClientsList from './ClientsList';
import WalletsView from './WalletsView';
import PassportReviewList from './PassportReviewList';
import ApprovedPassportList from './ApprovedPassportList';
// @ts-ignore
import './ClientsView.scss';

type View = 'list' | 'wallets' | 'passport';

const VIEW_COPY: Record<View, { title: string, description: string }> = {
  list: { title: 'Clients', description: 'Everyone registered in the app, newest first.' },
  wallets: { title: 'Wallets', description: 'Client wallet balances and the latest deposits and payments.' },
  passport: { title: 'Passport review', description: 'Check uploaded passports and approve or reject them.' },
};

export const ClientsView = () => {
  const account: Account = useSelector((state: any) => state.session?.account);
  const canReviewPassports = useSelector((state: any) => (state.session.account.roles.isAdmin || state.session.account.roles?.isAccountant));

  const [view, setView] = useState<View>('list');
  // Admin only (see the tab buttons below) - accountants just get the reviewing list, no tabs.
  const [passportTab, setPassportTab] = useState<'reviewing' | 'approved'>('reviewing');
  const [pendingPassports, setPendingPassports] = useState([]);
  const [approvedPassports, setApprovedPassports] = useState([]);
  const [isPassportLoading, setIsPassportLoading] = useState(false);

  const fetchPendingPassports = async () => {
    setIsPassportLoading(true);
    try {
      const response = await api.get(`passportVerifications`);
      setPendingPassports(response.data.results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPassportLoading(false);
    }
  };

  const fetchApprovedPassports = async () => {
    setIsPassportLoading(true);
    try {
      const response = await api.get(`passportVerifications/approved`);
      setApprovedPassports(response.data.results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPassportLoading(false);
    }
  };

  const handlePassportTabChange = (newTab: 'reviewing' | 'approved') => {
    setPassportTab(newTab);
    if (newTab === 'approved') fetchApprovedPassports();
    else fetchPendingPassports();
  };

  const handleViewChange = (newView: View) => {
    if (newView === view) return;
    setView(newView);
    if (newView === 'passport') {
      setPassportTab('reviewing');
      fetchPendingPassports();
    }
  };

  // Admin only - accountants (who can also open Passport Review) get just the reviewing
  // list below, no tabs at all.
  const passportTabs = [
    { label: 'Reviewing', value: 'reviewing' },
    { label: 'Approved', value: 'approved' },
  ];
  const showPassportTabs = view === 'passport' && account.roles.isAdmin;

  const views: { value: View, label: string, icon: typeof Users, visible: boolean }[] = [
    { value: 'list', label: 'Clients', icon: Users, visible: true },
    { value: 'wallets', label: 'Wallets', icon: Wallet, visible: !!account.roles.isAdmin },
    { value: 'passport', label: 'Passport Review', icon: IdCard, visible: !!canReviewPassports },
  ];

  return (
    <div className="clients-page">
      <header className="cl-header">
        <div className="cl-header__title">
          <h1>{VIEW_COPY[view].title}</h1>
          <p>{VIEW_COPY[view].description}</p>
        </div>
        <nav className="cl-switcher" aria-label="Clients sections">
          {views.filter((v) => v.visible).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-current={view === value ? 'page' : undefined}
              className={view === value ? 'is-active' : ''}
              onClick={() => handleViewChange(value)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'list' && <ClientsList />}

      {view === 'wallets' && <WalletsView />}

      {view === 'passport' && (
        <Card
          tabs={showPassportTabs ? passportTabs : undefined}
          tabsOnChange={(value: string) => handlePassportTabChange(value as 'reviewing' | 'approved')}
          bodyStyle={{ height: '60vh', overflow: 'auto', marginTop: '20px' }}
        >
          {isPassportLoading ? (
            <div className="text-center p-5"><CircularProgress /></div>
          ) : (
            passportTab === 'approved' && account.roles.isAdmin ?
              <ApprovedPassportList customers={approvedPassports} />
              :
              <PassportReviewList
                customers={pendingPassports}
                onReviewed={(customerId) => setPendingPassports((prev) => prev.filter((c: any) => c._id !== customerId))}
              />
          )}
        </Card>
      )}
    </div>
  );
};
