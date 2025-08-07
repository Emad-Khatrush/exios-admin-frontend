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
import UserDetails from './containers/UserDetails/UserDetails';
import MonthReport from './containers/MonthReport/MonthReport';

const Home = React.lazy(() => import('./containers/Home/Home'));
const EmployeeHomePage = React.lazy(() => import('./containers/EmployeeHomePage/EmployeeHomePage'));
const AddInvoice = React.lazy(() => import('./containers/AddInvoice/AddInvoice'));
const UnsureOrder = React.lazy(() => import('./containers/UnsureOrder/UnsureOrder'));
const Invoices = React.lazy(() => import('./containers/Invoices/Invoices'));
const Expenses = React.lazy(() => import('./containers/Expenses/Expenses'));
const Incomes = React.lazy(() => import('./containers/Incomes/Incomes'));
const Shippings = React.lazy(() => import('./containers/Shippings/Shippings'));
const Activities = React.lazy(() => import('./containers/Activities/Activities'));
const CreateExpense = React.lazy(() => import('./containers/CreateExpense/CreateExpense'));
const CreateIncome = React.lazy(() => import('./containers/CreateIncome/CreateIncome'));
const EditExpense = React.lazy(() => import('./containers/EditExpense/EditExpense'));
const EditIncome = React.lazy(() => import('./containers/EditIncome/EditIncome'));
const EditInvoice = React.lazy(() => import('./containers/EditInvoice/EditInvoice'));
const XTrackingPage = React.lazy(() => import('./containers/XTrackingPage/XTrackingPage'));
const MyTasks = React.lazy(() => import('./containers/MyTasks/MyTasks'));
const CreateTask = React.lazy(() => import('./containers/CreateTask/CreateTask'));
const MessagesControl = React.lazy(() => import('./containers/MessagesControl/MessagesControl'));
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
      <Route path='/income/:id/edit' element={<EditIncome />} />
      <Route path='/expense/add' element={<CreateExpense />} />
      <Route path='/income/add' element={<CreateIncome />} />
      <Route path='/mytasks' element={<MyTasks />} />
      <Route path='/task/add' element={<CreateTask />} />
      <Route path='/task/:id/edit' element={<EditTask />} />
      <Route path='/settings' element={<Settings />} />
      <Route path='/balances' element={<Balances />} />
      <Route path='/clients' element={<ClientsView />} />
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
      <Route path='/expenses' element={<Expenses />} />
      <Route path='/expenses/add' element={<CreateExpense />} />
      <Route path='/expenses/:id/edit' element={<EditExpense />} />
      <Route path='/incomes' element={<Incomes />} />
      <Route path='/income/add' element={<CreateIncome />} />
      <Route path='/income/:id/edit' element={<EditIncome />} />
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
      <Route path='/ratings' element={<RatingsPage />} />
      <Route path='/balances' element={<Balances />} />
      <Route path='/clients' element={<ClientsView />} />
      <Route path='/user/:id' element={<UserDetails />} />
      <Route path='/inventory' element={<Inventory />} />
      <Route path='/inventory/add' element={<AddInventory />} />
      <Route path='/inventory/:id/edit' element={<EditInventory />} />
      <Route path='/mangage' element={<WarehouseInventory />} />
      <Route path='/messages' element={<MessagesControl />} />
      <Route path='/returnedPayments' element={<ReturnedPayments />} />
      <Route path='/reports' element={<MonthReport />} />
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
