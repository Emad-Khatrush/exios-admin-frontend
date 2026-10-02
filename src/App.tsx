import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { connect } from 'react-redux';

import PrivateRoute from './routes/PrivateRoute';
import Login from './containers/Login/Login';
import AllowToAccessApp from './containers/AllowToAccessApp/AllowToAccessApp';
import AuthChecker from './utils/AuthChecker';
import { Session } from './models';

import './App.scss';
import EditTask from './containers/EditTask/EditTask';
import Settings from './containers/Settings/Settings';
import ServicesPrice from './containers/Settings/ServicesPrice';
import Announcements from './components/Announcements/Announcements';
import AdminPosts from './containers/AdminPosts/AdminPosts';
import PopupAds from './containers/Settings/PopupAds';
import CompanyNotes from './containers/Settings/CompanyNotes';

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import RatingsPage from './containers/RatingsPage/RatingsPage';
import Balances from './containers/Balances/Balances';
import Inventory from './containers/Inventory/Inventory';
import AddInventory from './containers/Inventory/AddInventory';
import EditInventory from './containers/Inventory/EditInventory';
import WarehouseInventory from './containers/WarehouseInventory/WarehouseInventory';
import ReturnedPayments from './containers/ReturnedPayments/ReturnedPayments';
import { ClientsView } from './containers/ClientsView/ClientsView';
import SpecialPriceCustomers from './containers/SpecialPriceCustomers/SpecialPriceCustomers';
import UserDetails from './containers/UserDetails/UserDetails';
import MonthReport from './containers/MonthReport/MonthReport';
import OdoExport from './containers/OdoExport/OdoExport';
import DeletedStatements from './containers/DeletedStatements/DeletedStatements';
import Marketing from './containers/Marketing/Marketing';
import Analytics from './containers/Analytics/Analytics';
import AccountingLayout from './containers/Accounting/AccountingLayout';
import AccountingDashboard from './containers/Accounting/Dashboard';
import JournalEntries from './containers/Accounting/JournalEntries';
import EntryForm from './containers/Accounting/EntryForm';
import EntryDetail from './containers/Accounting/EntryDetail';
import ChartOfAccounts from './containers/Accounting/ChartOfAccounts';
import AccountLedger from './containers/Accounting/AccountLedger';
import TrialBalance from './containers/Accounting/TrialBalance';
import DailyRates from './containers/Accounting/DailyRates';
import AccountingSettings from './containers/Accounting/AccountingSettings';
import AccountingAuditLog from './containers/Accounting/AuditLog';
import { BillsList, BillDetail } from './containers/Accounting/Bills';
import BillForm from './containers/Accounting/BillForm';
import { VendorsList, VendorStatement } from './containers/Accounting/Vendors';
import { CustomerInvoicePage, CustomerInvoicesList, CustomerPage, CustomersList } from './containers/Accounting/Customers';
import { PaymentsList, PaymentForm, ReceiptForm } from './containers/Accounting/Payments';
import QuickExpenses from './containers/Accounting/QuickExpenses';
import OfficeExpensesReview from './containers/Accounting/OfficeExpensesReview';
import TripCosts from './containers/Accounting/TripCosts';
import Treasury from './containers/Accounting/Treasury';
import AccountingAssets from './containers/Accounting/Assets';
import AccountingEmployees from './containers/Accounting/Employees';
import { Equity as AccountingEquity, Netting as AccountingNetting } from './containers/Accounting/EquityAndNetting';
import BankReconciliation from './containers/Accounting/BankReconciliation';
import AccountingMigration from './containers/Accounting/Migration';
import AccountingGuide from './containers/Accounting/Guide';
import AccountingSuspense from './containers/Accounting/Suspense';
import AccountingReports from './containers/Accounting/Reports';
import AccountingExceptions from './containers/Accounting/Exceptions';
import AccountingClosing from './containers/Accounting/Closing';
import AccountingVoucher from './containers/Accounting/Voucher';
import AccountingOdooExport from './containers/Accounting/OdooExport';
import AccountingStartWizard from './containers/Accounting/StartWizard';
import AccountingAccessControl from './containers/Accounting/AccessControl';

const Home = React.lazy(() => import('./containers/Home/Home'));
const EmployeeHomePage = React.lazy(() => import('./containers/EmployeeHomePage/EmployeeHomePage'));
const AddInvoice = React.lazy(() => import('./containers/AddInvoice/AddInvoice'));
const UnsureOrder = React.lazy(() => import('./containers/UnsureOrder/UnsureOrder'));
const Invoices = React.lazy(() => import('./containers/Invoices/Invoices'));
const OfficeExpenses = React.lazy(() => import('./containers/OfficeExpenses/OfficeExpenses'));
const Shippings = React.lazy(() => import('./containers/Shippings/Shippings'));
const Activities = React.lazy(() => import('./containers/Activities/Activities'));
const EditInvoice = React.lazy(() => import('./containers/EditInvoice/EditInvoice'));
// X-Tracking page plus the order control tab (XTrackingPage itself is unchanged)
const XTrackingPage = React.lazy(() => import('./containers/XTrackingPage/XTrackingHub'));
const MyTasks = React.lazy(() => import('./containers/MyTasks/MyTasks'));
const CreateTask = React.lazy(() => import('./containers/CreateTask/CreateTask'));
const IssuedInvoices = React.lazy(() => import('./containers/IssuedInvoices/IssuedInvoices'));

type MyProps = {
  session: Session
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_ANALYTICS_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: "exios-admin-frontend",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const getRoutesByRole = (roles: any) => {
  if (roles?.isEmployee) {
    return <>
      <Route path='/' element={<EmployeeHomePage />} />
      <Route path='/xtracking' element={<XTrackingPage />} />
      <Route path='/unsureOrder/add' element={<UnsureOrder />} />
      <Route path='/invoice/add' element={<AddInvoice />} />
      <Route path='/invoice/:id/edit' element={<EditInvoice />} />
      <Route path='/expenses' element={<OfficeExpenses />} />
      <Route path='/mytasks' element={<MyTasks />} />
      <Route path='/task/add' element={<CreateTask />} />
      <Route path='/task/:id/edit' element={<EditTask />} />
      {roles?.isAccountant && <>
        <Route path='/settings' element={<Settings />} />
        <Route path='/settings/pricing' element={<ServicesPrice />} />
        <Route path='/settings/announcements' element={<Announcements />} />
        <Route path='/settings/posts' element={<AdminPosts />} />
        <Route path='/settings/popup-ads' element={<PopupAds />} />
      </>}
      <Route path='/balances' element={<Balances />} />
      <Route path='/clients' element={<ClientsView />} />
      <Route path='/special-prices' element={<SpecialPriceCustomers />} />
      <Route path='/user/:id' element={<UserDetails />} />
      <Route path='/inventory' element={<Inventory />} />
      <Route path='/inventory/add' element={<AddInventory />} />
      <Route path='/inventory/:id/edit' element={<EditInventory />} />
      <Route path='/mangage' element={<WarehouseInventory />} />
      <Route path='/returnedPayments' element={<ReturnedPayments />} />
      <Route path='/reports' element={<MonthReport />} />
    </>
  } else if (roles?.isAdmin) {
    return <>
      <Route path='/' element={<Home />} />
      <Route path='/activities' element={<Activities />} />
      <Route path='/expenses' element={<OfficeExpenses />} />
      <Route path='/invoices' element={<Invoices />} />
      <Route path='/dailyReport' element={<IssuedInvoices />} />
      <Route path='/invoice/add' element={<AddInvoice />} />
      <Route path='/invoice/:id/edit' element={<EditInvoice />} />
      <Route path='/shippings' element={<Shippings />} />
      <Route path='/unsureOrder/add' element={<UnsureOrder />} />
      <Route path='/xtracking' element={<XTrackingPage />} />
      <Route path='/mytasks' element={<MyTasks />} />
      <Route path='/task/add' element={<CreateTask />} />
      <Route path='/task/:id/edit' element={<EditTask />} />
      <Route path='/settings' element={<Settings />} />
      <Route path='/settings/pricing' element={<ServicesPrice />} />
      <Route path='/settings/announcements' element={<Announcements />} />
      <Route path='/settings/posts' element={<AdminPosts />} />
      <Route path='/settings/popup-ads' element={<PopupAds />} />
      <Route path='/settings/company-notes' element={<CompanyNotes />} />
      <Route path='/ratings' element={<RatingsPage />} />
      <Route path='/balances' element={<Balances />} />
      <Route path='/clients' element={<ClientsView />} />
      <Route path='/special-prices' element={<SpecialPriceCustomers />} />
      <Route path='/user/:id' element={<UserDetails />} />
      <Route path='/inventory' element={<Inventory />} />
      <Route path='/inventory/add' element={<AddInventory />} />
      <Route path='/inventory/:id/edit' element={<EditInventory />} />
      <Route path='/mangage' element={<WarehouseInventory />} />
      <Route path='/returnedPayments' element={<ReturnedPayments />} />
      <Route path='/reports' element={<MonthReport />} />
      <Route path='/odo-export' element={<OdoExport />} />
      <Route path='/deleted-payments' element={<DeletedStatements />} />
      <Route path='/marketing' element={<Marketing />} />
      <Route path='/analytics' element={<Analytics />} />
      <Route path='/accounting' element={<AccountingLayout />}>
        <Route index element={<AccountingDashboard />} />
        <Route path='entries' element={<JournalEntries />} />
        <Route path='entries/new' element={<EntryForm />} />
        <Route path='entries/:id' element={<EntryDetail />} />
        <Route path='accounts' element={<ChartOfAccounts />} />
        <Route path='accounts/:id' element={<AccountLedger />} />
        <Route path='trial-balance' element={<TrialBalance />} />
        <Route path='rates' element={<DailyRates />} />
        <Route path='settings' element={<AccountingSettings />} />
        <Route path='audit' element={<AccountingAuditLog />} />
        <Route path='bills' element={<BillsList />} />
        <Route path='bills/new' element={<BillForm />} />
        <Route path='bills/:id' element={<BillDetail />} />
        <Route path='bills/:id/edit' element={<BillForm />} />
        <Route path='customers' element={<CustomersList />} />
        <Route path='customers/:id' element={<CustomerPage />} />
        <Route path='customer-invoices' element={<CustomerInvoicesList />} />
        <Route path='customer-invoices/:id' element={<CustomerInvoicePage />} />
        <Route path='receivables' element={<Navigate to='/accounting/reports?tab=receivables' replace />} />
        <Route path='vendors' element={<VendorsList />} />
        <Route path='vendors/:id' element={<VendorStatement />} />
        <Route path='payments' element={<PaymentsList />} />
        <Route path='payments/new' element={<PaymentForm />} />
        <Route path='receipts/new' element={<ReceiptForm />} />
        <Route path='expenses' element={<QuickExpenses />} />
        <Route path='office-expenses' element={<OfficeExpensesReview />} />
        <Route path='trips' element={<TripCosts />} />
        <Route path='treasury' element={<Treasury />} />
        <Route path='bank' element={<BankReconciliation />} />
        <Route path='employees' element={<AccountingEmployees />} />
        <Route path='assets' element={<AccountingAssets />} />
        <Route path='equity' element={<AccountingEquity />} />
        <Route path='netting' element={<AccountingNetting />} />
        <Route path='migration' element={<AccountingMigration />} />
        <Route path='guide' element={<AccountingGuide />} />
        <Route path='suspense' element={<AccountingSuspense />} />
        <Route path='reports' element={<AccountingReports />} />
        <Route path='exceptions' element={<AccountingExceptions />} />
        <Route path='closing' element={<AccountingClosing />} />
        <Route path='vouchers/:entryId' element={<AccountingVoucher />} />
        <Route path='odoo' element={<AccountingOdooExport />} />
        <Route path='start' element={<AccountingStartWizard />} />
        <Route path='access' element={<AccountingAccessControl />} />
      </Route>
    </>
  }
}

class App extends React.Component<MyProps> {

  render() {
    const { session } = this.props;
    
    const routes = getRoutesByRole(session?.account?.roles);
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    getAnalytics(app);

    return (
        <Router>
          <AuthChecker />
          <Routes>
            <Route path='/shouldAllowToAccessApp' element={<AllowToAccessApp session={session} />} />
            <Route path='/login' element={<Login />} />;
            <Route element={<PrivateRoute session={session} />}>
              {routes}
            <Route path='*' element={<Navigate to='/' />} />;
            </Route>
          </Routes>
        </Router>
    );
  }
}

const mapStateToProps = (state: any) => {  
  return {
    session: state.session,
  };
}

export default connect(mapStateToProps)(App);
