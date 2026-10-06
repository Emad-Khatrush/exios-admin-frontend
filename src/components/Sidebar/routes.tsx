import { MdLineStyle, MdOutlineAccountBalanceWallet, MdOutlineInventory, MdOutlineStarRate, MdOutlineInsights } from 'react-icons/md';
import { FaFileInvoice, FaArchive, FaTasks, FaWarehouse, FaUsers, FaFileInvoiceDollar, FaTrashAlt, FaPercentage, FaBullhorn, FaBalanceScale } from 'react-icons/fa';
import { FiSettings } from 'react-icons/fi';
import { HiDocumentReport } from 'react-icons/hi';
import { RiBillFill } from 'react-icons/ri';

// Shown only to whoever has some accounting permission (the owner decides who); see Sidebar
const accountingRoutes = [
  { mainTitle: 'Accounting', accountingGate: true },
  { title: 'Accounting', path: '/accounting', icon: <FaBalanceScale className="sidebar-icon" />, accountingGate: true },
];

const adminRoutes = [
    {
      mainTitle: 'Dashboard'
    },
    {
        title: 'Home',
        path: '/',
        icon: <MdLineStyle className="sidebar-icon" />,
    },
    {   
        title: 'Activities',
        path: '/activities',      
        icon: <HiDocumentReport className="sidebar-icon" />,
     },
     {   
        title: 'Invoices',
        path: '/invoices',      
        icon: <FaFileInvoice className="sidebar-icon" />,
     },
     {   
        title: 'Expenses',
        path: '/expenses',      
        icon: <RiBillFill className="sidebar-icon" />,
     },
     {
      title: 'Debts',
      path: '/balances',
      icon: <MdOutlineAccountBalanceWallet className="sidebar-icon" />,
     },
     {
      title: 'Clients',
      path: '/clients',
      icon: <FaUsers className="sidebar-icon" />,
     },
     ...accountingRoutes,
     {
      mainTitle: 'Management'
     },
     {
        title: 'X-Tracking',
        path: '/xtracking',
        icon: <FaArchive className="sidebar-icon" />,
     },
     {
      title: 'My Tasks',
      path: '/mytasks',
      icon: <FaTasks className="sidebar-icon" />,
     },
     {   
        title: 'Daily Report',
        path: '/dailyReport',      
        icon: <FaFileInvoice className="sidebar-icon" />,
     },
     {
      title: 'Reports',
      path: '/reports',
      icon: <FaFileInvoiceDollar className="sidebar-icon" />,
     },
     {
      title: 'Odo Export',
      path: '/odo-export',
      icon: <FaFileInvoiceDollar className="sidebar-icon" />,
     },
     {
      mainTitle: 'Inventory'
     },
     {
      title: 'Inventory',
      path: '/inventory',
      icon: <MdOutlineInventory className="sidebar-icon" />,
     },
     {
      title: 'Warehouse',
      path: '/mangage',
      icon: <FaWarehouse className="sidebar-icon" />,
     },
     {
      mainTitle: 'Marketing'
     },
     {
      title: 'Marketing',
      path: '/marketing',
      icon: <FaBullhorn className="sidebar-icon" />,
     },
     {
      title: 'Analytics',
      path: '/analytics',
      icon: <MdOutlineInsights className="sidebar-icon" />,
     },
   {
      title: 'Special Prices',
      path: '/special-prices',
      icon: <FaPercentage className="sidebar-icon" />,
     },
   {
      title: 'Ratings',
      path: '/ratings',
      icon: <MdOutlineStarRate className="sidebar-icon" />,
     },
     {
      mainTitle: 'Settings'
     },
     {
      title: 'General',
      path: '/settings',
      icon: <FiSettings className="sidebar-icon" />,
     },
   {
      title: 'Deleted Payments',
      path: '/deleted-payments',
      icon: <FaTrashAlt className="sidebar-icon" />,
     },
 ];

 const employeeRoutes = [
    {
      mainTitle: 'Dashboard'
    },
    {
        title: 'Home',
        path: '/',
        icon: <MdLineStyle className="sidebar-icon" />,
    },
    {
      mainTitle: 'Management'
    },
    {
        title: 'X-Tracking',
        path: '/xtracking',
        icon: <FaArchive className="sidebar-icon" />,
    },
    {
      title: 'Debts',
      path: '/balances',
      icon: <MdOutlineAccountBalanceWallet className="sidebar-icon" />,
     },
     {
      title: 'Clients',
      path: '/clients',
      icon: <FaUsers  className="sidebar-icon" />,
     },
     {   
        title: 'Invoice',
        path: '/invoice/add',      
        icon: <FaFileInvoice className="sidebar-icon" />,
     },
     {   
        title: 'Expenses',
        path: '/expenses',      
        icon: <RiBillFill className="sidebar-icon" />,
     },
     {   
      title: 'My Tasks',
      path: '/mytasks',
      icon: <FaTasks className="sidebar-icon" />,
     },
   {
      title: 'Special Prices',
      path: '/special-prices',
      icon: <FaPercentage className="sidebar-icon" />,
     },
     {
      mainTitle: 'Inventory'
     },
     {
      title: 'Inventory',
      path: '/inventory',
      icon: <MdOutlineInventory className="sidebar-icon" />,
     },
     {
      title: 'Warehouse',
      path: '/mangage',
      icon: <FaWarehouse className="sidebar-icon" />,
     }
 ];

const getRoutes = (roles: any) => {
    if (roles?.isAdmin) {
        return adminRoutes;
    } else if (roles?.isEmployee) {
      if (roles?.isAccountant) {
        return [
          ...employeeRoutes,
          ...accountingRoutes,
         {
            mainTitle: 'Settings'
         },
         {
            title: 'General',
            path: '/settings',
            icon: <FiSettings className="sidebar-icon" />,
         }
        ];
      }
        return [...employeeRoutes, ...accountingRoutes];
    }
}

export default getRoutes;
