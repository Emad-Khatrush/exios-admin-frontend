import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../api';
import UserWidget from '../ClientsView/UserWidget/UserWidget';
import { CircularProgress, Dialog, Tab, Tabs } from '@mui/material';
import { MdToll } from 'react-icons/md';
import CashflowUser from './CashflowUser';
import AddBalanceToWallet from './AddBalanceToWallet';
import UseWalletBalance from './UseWalletBalance';
import ShippingMarkDialog, { ShippingMarkCard } from './ShippingMarkDialog';
import WalletExchangeDialog from './WalletExchangeDialog';
import UserOrders from './UserOrders';
import UserInvoices from './UserInvoices';
import SpecialPricesTab from './SpecialPricesTab';
import PassportVerificationTab from './PassportVerificationTab';
import { CustomerCodeCard, CustomerInfoCard } from './CustomerInfoSettings';
import { CustomerAccounting } from '../Accounting/AccountingPanels';
import CustomerWallet, { CustomerPoints } from './CustomerWallet';
import LoyaltyTab from './LoyaltyTab';
import AppStatusCard from './AppStatusCard';
import { money, pointsText } from '../Loyalty/format';
import { LevelBadge, useTiers } from '../Loyalty/levels';
import '../Loyalty/loyalty.scss';
import { useStaffAccess } from '../../utils/useStaffAccess';

// The fields the Customer info card edits; the rest of the loaded user stays as it is
const pickCustomerInfo = (updated: any) => ({
  firstName: updated?.firstName,
  lastName: updated?.lastName,
  username: updated?.username,
  phone: updated?.phone,
  city: updated?.city,
});

type Props = {}

const UserDetails = (props: Props) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isAdminRole = useSelector((state: any) => Boolean(state.session.account.roles?.isAdmin));
  const isAdminOrAccountant = useSelector((state: any) => Boolean(state.session.account.roles?.isAdmin || state.session.account.roles?.isAccountant));
  // «الإضافة والخصم من المحفظة» and «الصرافة داخل المحفظة» in Settings > Permissions. Staff nobody has
  // configured yet keep what their role gave them: deposit and withdrawal for every staff member,
  // exchange for admins and accountants.
  const staff = useStaffAccess();
  // The Points tab: «تبويب Points في ملف العميل», or either operation on the customer's points (the
  // Loyalty page's own permission does not open it)
  const canLoyalty = isAdminRole || staff.can('loyalty_customer', 'loyalty_adjust', 'loyalty_level');
  const canTransact = staff.configured ? staff.can('wallet_transactions') : true;
  const canExchangeWallet = staff.configured ? staff.can('wallet_exchange') : isAdminOrAccountant;
  const canReviewPassports = useSelector((state: any) => (state.session.account.roles.isAdmin || state.session.account.roles?.isAccountant));

  const [user, setUser] = useState<any>();
  const [debts, setDebts] = useState<any>();
  const [debtLoading, setDebtLoading] = useState(true);
  const [debtError, setDebtError] = useState(false);
  const [wallet, setWallet] = useState<any>();
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [userStatement, setUserStatement] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [isStatementLoading, setIsStatementLoading] = useState(false);
  const [dialog, setDialog] = useState<any>();
  const [dialogBusy, setDialogBusy] = useState(false);
  const [activeTap, setActiveTap] = useState<'profile' | 'orders' | 'invoices' | 'specialPrices' | 'settings' | 'accounting' | 'points'>(searchParams.get('tab') === 'points' ? 'points' : 'profile');
  // The customer's points, for the header chip and the wallet box (null when unknown or not allowed)
  const [points, setPoints] = useState<CustomerPoints | null>(null);
  const [pointsVersion, setPointsVersion] = useState(0);
  // The customer's loyalty level: every staff member sees it (priority and perks at the counter)
  const [level, setLevel] = useState<string | null>(null);
  const tiers = useTiers();
  const [statementCurrency, setStatementCurrency] = useState('USD');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!canLoyalty || !id) return;
    let stale = false;
    api.get(`user/${id}/loyalty`)
      .then((res: any) => {
        if (stale) return;
        const soon = res.data?.expiringSoon;
        setPoints({
          points: Number(res.data?.points || 0),
          usd: Number(res.data?.usd ?? Number(res.data?.points || 0) / 100),
          expiringSoon: soon ? { points: Number(soon.points || 0), at: soon.at } : null,
        });
      })
      .catch(() => { if (!stale) setPoints(null); });
    return () => { stale = true; };
  }, [id, canLoyalty, pointsVersion]);

  useEffect(() => {
    if (!id) return;
    let stale = false;
    api.get(`user/${id}/loyalty/level`)
      .then((res: any) => { if (!stale) setLevel(res.data?.level || null); })
      .catch(() => { if (!stale) setLevel(null); });
    return () => { stale = true; };
  }, [id, pointsVersion]);

  useEffect(() => {
    fetchUserStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementCurrency])

  const loadData = async () => {
    try {
      await fetchUser();
      await fetchDebtsOfUser();
    } catch (error) {
      console.log(error);
    }
  }

  const fetchUserStatement = async () => {
    try {
      setIsStatementLoading(true);
      const statementResponse = await api.get(`user/${id}/statement?currency=${statementCurrency}`);
      setUserStatement(statementResponse.data.results);
      setIsStatementLoading(false);
    } catch (error) {
      console.log(error);
      setIsStatementLoading(false);
    }
  }

  const refreshWalletAndStatement = async () => {
    try {
      const walletResponse = await api.get(`wallet/${id}`);
      setWallet(walletResponse.data.results);
    } catch (error) {
      console.log(error);
    }
    await fetchUserStatement();
  }

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`customer/${id}`);
      const walletResponse = await api.get(`wallet/${id}`);
      const statementResponse = await api.get(`user/${id}/statement?currency=${statementCurrency}`);
      setUser(response.data);
      setWallet(walletResponse.data.results);
      setUserStatement(statementResponse.data.results);
      setIsLoading(false);
    } catch (error) {
      console.log(error);
      setIsLoading(false);
    }
  }

  const fetchDebtsOfUser = async () => {
    setDebtLoading(true);
    setDebtError(false);
    try {
      const response = await api.get(`debts/${id}`);
      if (!Array.isArray(response.data)) throw new Error('Invalid debts response');
      setDebts(response.data);
    } catch (error) {
      setDebtError(true);
    } finally {
      setDebtLoading(false);
    }
  }

  if (isLoading || !user) {
    return (
      <CircularProgress />
    )
  }

  const { totalUsd: walletUsd, totalLyd: walletLyd } = calculateTotalWallet(wallet);
  const Tag = dialog?.component;
  const openPoints = () => setActiveTap('points');

  return (
    <div className="m-2 row">
      {/* On the profile tab the wallet box shows the points, so the chip is only for the other tabs */}
      {level && tiers.length > 0 && (
        <div className="mb-2 lp" dir="rtl">
          <span className="lp-level-line">مستوى العميل: <LevelBadge level={level} tiers={tiers} perks /></span>
        </div>
      )}
      {points && activeTap !== 'profile' && (
        <div className="mb-2">
          <button type="button" className="lp lp-header-chip lp-press lp-fade-in" dir="rtl" onClick={openPoints} title="فتح تبويب النقاط">
            <MdToll aria-hidden="true" />
            <bdi dir="ltr" className="lp-num">{pointsText(points.points)}</bdi> نقطة <span>· <bdi dir="ltr" className="lp-num">${money(points.usd)}</bdi></span>
          </button>
        </div>
      )}
      <Tabs
        className='mb-4'
        value={activeTap}
        onChange={(_, value) => setActiveTap(value as any)}
        variant="scrollable"
        scrollButtons={false}
        aria-label="scrollable prevent tabs example"
      >
        <Tab label="Profile" value="profile" />
        <Tab label="Orders" value="orders" />
        <Tab label="Created Invoices" value="invoices" />
        <Tab label="Special Prices" value="specialPrices" />
        <Tab label="Settings" value="settings" />
        {canReviewPassports && <Tab label="Accounting" value="accounting" />}
        {canLoyalty && <Tab label="Points" value="points" />}
      </Tabs>

      {activeTap === 'profile' ? (
        <div className="row">
          <div className="col-12">
            <CustomerWallet user={user} debts={debts} debtLoading={debtLoading} debtError={debtError} walletUsd={walletUsd} walletLyd={walletLyd}
              onDeposit={canTransact ? () => setDialog({ component: AddBalanceToWallet }) : undefined}
              onWithdraw={canTransact ? () => setDialog({ component: UseWalletBalance, actionType: 'withdrawal' }) : undefined}
              onExchange={canExchangeWallet ? () => setExchangeOpen(true) : undefined}
              points={canLoyalty ? points : null}
              onOpenPoints={canLoyalty ? openPoints : undefined}
              onRefreshDebts={fetchDebtsOfUser}
              onPaymentSaved={async () => { await Promise.all([fetchDebtsOfUser(), refreshWalletAndStatement()]); }} />
          </div>

          <div className="col-12"><UserWidget client={user} onEdit={() => setActiveTap('settings')} /></div>
          <div className="col-12"><AppStatusCard userId={user._id} /></div>
          <div className="col-12"><ShippingMarkCard customerCode={user.customerId} onOpen={() => setDialog({ component: ShippingMarkDialog })} /></div>

          <CashflowUser
            userStatement={userStatement}
            onChangeCurrency={(value: string) => setStatementCurrency(value)}
            onStatementChanged={refreshWalletAndStatement}
            isLoading={isStatementLoading}
          />
        </div>
      ) : activeTap === 'points' && canLoyalty ? (
        <div className="col-md-12">
          <LoyaltyTab userId={user._id} version={pointsVersion} onChanged={() => setPointsVersion((v) => v + 1)} />
        </div>
      ) : activeTap === 'accounting' ? (
        <div className="col-md-12">
          <CustomerAccounting customerId={user._id} />
        </div>
      ) : activeTap === 'orders' ? (
        <div className="col-md-12">
          <UserOrders
            customerId={user._id}
            balances={{ walletLyd, walletUsd }}
            onDelivered={() => { refreshWalletAndStatement(); fetchDebtsOfUser(); }}
          />
        </div>
      ) : activeTap === 'specialPrices' ? (
        <div className="col-md-12">
          <SpecialPricesTab
            user={user}
            onSaved={(specialPrices) => setUser({ ...user, specialPrices })}
          />
        </div>
      ) : activeTap === 'settings' ? (
        <div className="col-md-12">
          <div className="ci-stack">
            <CustomerInfoCard
              user={user}
              onSaved={(updated) => setUser({ ...user, ...pickCustomerInfo(updated) })}
            />
            <CustomerCodeCard
              key={user.customerId}
              user={user}
              onSaved={(updated) => setUser({ ...user, customerId: updated?.customerId ?? user.customerId })}
            />
          </div>

          {canReviewPassports && (
            <div className="mt-4">
              <PassportVerificationTab
                user={user}
                onSaved={({ passportVerification, firstName, lastName }) => setUser({ ...user, passportVerification, firstName, lastName })}
              />
            </div>
          )}
        </div>
      ) : activeTap === 'invoices' && (
        <div className="col-md-12">
          <UserInvoices customerId={user._id} onInvoiceCanceled={() => { refreshWalletAndStatement(); fetchDebtsOfUser(); }} />
        </div>
      )}

      {canExchangeWallet && <WalletExchangeDialog open={exchangeOpen} onClose={() => setExchangeOpen(false)} customerId={user._id}
        balances={{ walletLyd, walletUsd }} onSaved={refreshWalletAndStatement} />}
      <Dialog
        open={!!dialog}
        onClose={() => { if (!dialogBusy) setDialog(undefined); }}
        disableEscapeKeyDown={dialogBusy}
        fullWidth
        maxWidth={dialog?.component === ShippingMarkDialog ? 'md' : 'sm'}
        PaperProps={{ sx: { borderRadius: 2, maxHeight: 'calc(100% - 32px)', margin: { xs: '12px', sm: '32px' }, width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' } } }}
      >
        {dialog?.component &&
          <Tag
            balances={{ walletLyd, walletUsd }}
            user={user}
            actionType={dialog?.actionType}
            onClose={() => setDialog(undefined)}
            onBusyChange={setDialogBusy}
          />
        }
      </Dialog>
    </div>
  )
}

const calculateTotalWallet = (wallet: any) => {
  let totalUsd = 0, totalLyd = 0;
  (wallet || []).forEach((w: any) => {
    if (w.currency === 'USD') totalUsd += w.balance
    else if (w.currency === 'LYD') totalLyd += w.balance;
  })

  return { totalUsd, totalLyd }
}

export default UserDetails;
