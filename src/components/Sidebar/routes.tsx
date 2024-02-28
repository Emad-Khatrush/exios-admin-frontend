import { MdLineStyle, MdOutlineAccountBalanceWallet, MdOutlineInput, MdOutlineInventory, MdOutlineStarRate } from 'react-icons/md';
import { FaFileInvoice, FaArchive, FaTasks, FaWarehouse } from 'react-icons/fa';
import { FiPackage, FiSettings } from 'react-icons/fi';
import { HiDocumentReport } from 'react-icons/hi';
import { RiBillFill } from 'react-icons/ri';

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
        title: 'Shippings',
        path: '/shippings',      
        icon: <FiPackage className="sidebar-icon" />,
     },
     {   
        title: 'Expenses',
        path: '/expenses',      
        icon: <RiBillFill className="sidebar-icon" />,
     },
     {   
        title: 'Incomes',
        path: '/incomes',      
        icon: <MdOutlineInput className="sidebar-icon" />,
     },
     {
      title: 'Balances',
      path: '/balances',
      icon: <MdOutlineAccountBalanceWallet className="sidebar-icon" />,
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
      title: 'My Tasks',
      path: '/mytasks',
      icon: <FaTasks className="sidebar-icon" />,
     },
     {
      title: 'Ratings',
      path: '/ratings',
      icon: <MdOutlineStarRate className="sidebar-icon" />,
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
      mainTitle: 'Settings'
     },
     {
      title: 'General',
      path: '/settings',
      icon: <FiSettings className="sidebar-icon" />,
     }
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
      title: 'Balances',
      path: '/balances',
      icon: <MdOutlineAccountBalanceWallet className="sidebar-icon" />,
     },
     {   
        title: 'Invoice',
        path: '/invoice/add',      
        icon: <FaFileInvoice className="sidebar-icon" />,
     },
     {   
        title: 'Expense',
        path: '/expense/add',      
        icon: <RiBillFill className="sidebar-icon" />,
     },
     {   
        title: 'Incomes',
        path: '/income/add',      
        icon: <MdOutlineInput className="sidebar-icon" />,
     },
     {   
      title: 'My Tasks',
      path: '/mytasks',
      icon: <FaTasks className="sidebar-icon" />,
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
      mainTitle: 'Settings'
     },
     {
      title: 'General',
      path: '/settings',
      icon: <FiSettings className="sidebar-icon" />,
     }
 ];

const getRoutes = (roles: any) => {
    if (roles?.isAdmin) {
        return adminRoutes;
    } else if (roles?.isEmployee) {
        return employeeRoutes;
    }
}

export default getRoutes;