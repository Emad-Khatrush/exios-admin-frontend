// The page each staff permission opens (the keys and their names live in the API:
// Exios-Api/constants/staffPermissions.js). Used for staff whose permissions were saved in
// Settings > Permissions; admins and owners see everything, and staff nobody has configured yet keep
// the pages their role gave them (App.tsx, components/Sidebar/routes.tsx).
export type StaffPermission =
  | 'invoices_create' | 'invoices_edit' | 'invoices_payments' | 'invoices_cancel' | 'invoices_list'
  | 'tracking' | 'delivery'
  | 'clients' | 'passports' | 'special_prices' | 'wallets' | 'debts' | 'returned_payments' | 'expenses'
  | 'inventory' | 'warehouse'
  | 'marketing' | 'goals' | 'analytics' | 'ratings'
  | 'tasks' | 'reports' | 'activities' | 'settings_prices' | 'settings_content';

// path -> the permissions that open it (any one is enough)
export const PAGE_PERMISSIONS: Record<string, StaffPermission[]> = {
  '/xtracking': ['tracking'],
  '/invoices': ['invoices_list'],
  '/dailyReport': ['invoices_list'],
  '/invoice/add': ['invoices_create'],
  '/invoice/:id/edit': ['invoices_edit', 'invoices_payments', 'invoices_cancel', 'delivery'],
  '/unsureOrder/add': ['invoices_create'],
  '/expenses': ['expenses'],
  '/mytasks': ['tasks'],
  '/task/add': ['tasks'],
  '/task/:id/edit': ['tasks'],
  '/balances': ['debts'],
  '/clients': ['clients', 'wallets', 'delivery', 'passports'],
  '/user/:id': ['clients', 'wallets', 'delivery', 'passports', 'special_prices', 'debts'],
  '/special-prices': ['special_prices'],
  '/inventory': ['inventory'],
  '/inventory/add': ['inventory'],
  '/inventory/:id/edit': ['inventory', 'warehouse'],
  '/mangage': ['warehouse'],
  '/returnedPayments': ['returned_payments'],
  '/reports': ['reports'],
  '/odo-export': ['reports'],
  '/activities': ['activities'],
  '/ratings': ['ratings'],
  '/marketing': ['marketing'],
  '/analytics': ['analytics'],
  '/goals': ['goals'],
  '/settings': ['settings_prices', 'settings_content'],
  '/settings/pricing': ['settings_prices'],
  '/settings/announcements': ['settings_content'],
  '/settings/posts': ['settings_content'],
  '/settings/popup-ads': ['settings_content'],
};

// The pages a person finds in their menu, in menu order, for the "what they will see" preview in
// Settings > Permissions (sub-pages such as editing an invoice are left out)
export const MENU_PAGES: { path: string, label: string }[] = [
  { path: '/invoice/add', label: 'فاتورة جديدة' },
  { path: '/invoices', label: 'كل الفواتير' },
  { path: '/dailyReport', label: 'التقرير اليومي' },
  { path: '/xtracking', label: 'X-Tracking' },
  { path: '/clients', label: 'العملاء' },
  { path: '/special-prices', label: 'الأسعار الخاصة' },
  { path: '/balances', label: 'الديون' },
  { path: '/returnedPayments', label: 'المبالغ المرجعة' },
  { path: '/expenses', label: 'المصروفات' },
  { path: '/inventory', label: 'الرحلات' },
  { path: '/mangage', label: 'المخزن' },
  { path: '/marketing', label: 'التسويق' },
  { path: '/goals', label: 'الأهداف' },
  { path: '/analytics', label: 'الإحصاءات' },
  { path: '/ratings', label: 'التقييمات' },
  { path: '/mytasks', label: 'المهام' },
  { path: '/reports', label: 'التقارير' },
  { path: '/activities', label: 'سجل النشاطات' },
  { path: '/settings/pricing', label: 'الأسعار وسعر الصرف' },
  { path: '/settings/announcements', label: 'الإعلانات والمنشورات' },
];

export const canOpen = (path: string, permissions: string[]) =>
  (PAGE_PERMISSIONS[path] || []).some((key) => permissions.includes(key));
