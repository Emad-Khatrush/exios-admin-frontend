import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, BadgeDollarSign, BookMarked, BookOpen, Building2, CalendarClock, ChartColumn, CircleDollarSign, Contact, FileSpreadsheet, FileText, Gauge, HandCoins, History, KeyRound, Landmark, ListChecks,
  ListTree, Lock, Receipt, ReceiptText, Rocket, Scale, ScrollText, Settings2, ShieldCheck, Ship, Truck, Users, Wallet,
} from 'lucide-react';
import { AccountingTheme } from './ui/AccountingTheme';
import { acc } from './accountingApi';
import { useAccountingAccess } from './useAccountingAccess';
// @ts-ignore
import './Accounting.scss';

// `perms`: any of them shows the link (and opens its pages); none = every member; `owner` = the
// owner accounts only
type NavItem = { to: string, label: string, icon: any, end?: boolean, wizard?: boolean, perms?: string[], owner?: boolean };

const NAV: { label: string | null, links: NavItem[] }[] = [
  {
    label: null,
    links: [
      { to: '/accounting', label: 'لوحة المحاسبة', icon: Gauge, end: true, perms: ['dashboard'] },
      { to: '/accounting/start', label: 'معالج البدء', icon: Rocket, wizard: true, perms: ['setup'] },
      { to: '/accounting/guide', label: 'دليل النظام', icon: BookMarked },
    ],
  },
  {
    label: 'المبيعات والعملاء',
    links: [
      { to: '/accounting/customer-invoices', label: 'فواتير العملاء', icon: ReceiptText, perms: ['reports'] },
      { to: '/accounting/customers', label: 'العملاء والمحافظ', icon: Contact, perms: ['reports'] },
      { to: '/accounting/receivables', label: 'ذمم العملاء وأعمارها', icon: BadgeDollarSign, perms: ['reports'] },
    ],
  },
  {
    label: 'المشتريات والمصروفات',
    links: [
      { to: '/accounting/bills', label: 'فواتير الموردين', icon: FileText, perms: ['purchases', 'payments'] },
      { to: '/accounting/expenses', label: 'مصروفات سريعة', icon: Receipt, perms: ['purchases'] },
      { to: '/accounting/trips', label: 'تكاليف الرحلات', icon: Ship, perms: ['purchases'] },
      { to: '/accounting/payments', label: 'دفعات الموردين', icon: HandCoins, perms: ['payments'] },
      { to: '/accounting/vendors', label: 'الموردون', icon: Truck, perms: ['purchases', 'payments'] },
    ],
  },
  {
    label: 'الخزينة',
    links: [
      { to: '/accounting/treasury', label: 'الخزينة والتحويلات', icon: Wallet, perms: ['treasury'] },
      { to: '/accounting/bank', label: 'مطابقة البنك', icon: Landmark, perms: ['treasury'] },
      { to: '/accounting/employees', label: 'الموظفون والرواتب', icon: Users, perms: ['payroll'] },
      { to: '/accounting/assets', label: 'الأصول والمقدمات', icon: Building2, perms: ['assets'] },
      { to: '/accounting/equity', label: 'رأس المال والقروض', icon: CircleDollarSign, perms: ['assets'] },
      { to: '/accounting/netting', label: 'المقاصة', icon: ArrowLeftRight, perms: ['assets'] },
    ],
  },
  {
    label: 'الدفاتر والتقارير',
    links: [
      { to: '/accounting/reports', label: 'التقارير', icon: ChartColumn, perms: ['reports'] },
      { to: '/accounting/exceptions', label: 'المطابقة والاستثناءات', icon: ShieldCheck, perms: ['reports'] },
      { to: '/accounting/entries', label: 'القيود', icon: BookOpen, perms: ['entries'] },
      { to: '/accounting/accounts', label: 'شجرة الحسابات', icon: ListTree, perms: ['setup', 'reports', 'treasury'] },
      { to: '/accounting/trial-balance', label: 'ميزان المراجعة', icon: Scale, perms: ['reports'] },
      { to: '/accounting/suspense', label: 'تسوية المعلّق', icon: ListChecks, perms: ['suspense'] },
      { to: '/accounting/rates', label: 'الأسعار اليومية', icon: CalendarClock, perms: ['rates', 'setup'] },
    ],
  },
  {
    label: 'النظام',
    links: [
      { to: '/accounting/closing', label: 'إقفال الشهر والسنة', icon: Lock, perms: ['closing'] },
      { to: '/accounting/migration', label: 'الترحيل التاريخي', icon: History, perms: ['setup'] },
      { to: '/accounting/odoo', label: 'التصدير إلى أودو', icon: FileSpreadsheet, perms: ['setup'] },
      { to: '/accounting/settings', label: 'الإعدادات', icon: Settings2, perms: ['setup'] },
      { to: '/accounting/audit', label: 'سجل التدقيق', icon: ScrollText, perms: ['audit'] },
      { to: '/accounting/access', label: 'الصلاحيات', icon: KeyRound, owner: true },
    ],
  },
];
const LINKS = NAV.flatMap((group) => group.links);

// Pages reached from inside others, not from the menu
const EXTRA: NavItem[] = [
  { to: '/accounting/entries/', label: '', icon: null, perms: ['entries', 'reports'] },
  { to: '/accounting/accounts/', label: '', icon: null, perms: ['reports', 'treasury'] },
  { to: '/accounting/vouchers', label: '', icon: null, perms: ['entries', 'treasury', 'payments', 'purchases'] },
];

// The menu item a path belongs to: the longest one it starts with
const itemOf = (path: string) => [...EXTRA, ...LINKS]
  .filter((item) => (item.end ? path === item.to : path === item.to || path.startsWith(item.to.endsWith('/') ? item.to : `${item.to}/`)))
  .sort((a, b) => b.to.length - a.to.length)[0];

const AccountingLayout = () => {
  const access = useAccountingAccess();
  // How much of the admin's top bar is still on screen: the section's own list sticks right
  // below it, and at the very top of the window once the bar has scrolled away
  const [topBar, setTopBar] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const allowed = (item?: NavItem) => !item || (item.owner ? access.isOwner : !item.perms || access.can(...item.perms));
  const hasAccess = access.permissions.length > 0;

  // The start wizard stays in the menu with its progress until it is complete, and the first
  // screen of the section is the wizard until then ("later" skips it for this visit)
  const [wizard, setWizard] = useState<{ completed: boolean, done: number, total: number } | null>(null);
  const canSetup = access.can('setup');
  useEffect(() => {
    if (!canSetup) return;
    acc.get('wizard').then((res: any) => setWizard({ completed: res.data.completed, ...res.data.progress })).catch(() => {});
  }, [canSetup, location.pathname]);
  useEffect(() => {
    if (access.loading || !hasAccess || path !== '/accounting') return;
    if (new URLSearchParams(location.search).get('later')) {
      try { sessionStorage.setItem('acc-wizard-later', '1'); } catch { /* storage may be blocked */ }
    }
    let later = false;
    try { later = sessionStorage.getItem('acc-wizard-later') === '1'; } catch { /* storage may be blocked */ }
    if (canSetup && wizard && !wizard.completed && !later) return navigate('/accounting/start', { replace: true });
    // Without the dashboard, the section opens on the first screen this person may use
    if (!access.can('dashboard')) {
      const first = LINKS.find((item) => item.perms && allowed(item));
      if (first) navigate(first.to, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard, path, location.search, access.loading, hasAccess, canSetup]);

  useEffect(() => {
    const measure = () => setTopBar(Math.max(0, Math.round(document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0)));
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, []);

  const pageAllowed = allowed(itemOf(path));

  let content;
  if (access.loading) {
    content = <div className="acc-empty"><p>جارٍ التحميل…</p></div>;
  } else if (!hasAccess) {
    content = (
      <div className="acc-empty">
        <h3>لا صلاحية لديك في المحاسبة</h3>
        <p>اطلب من المالك أن يعطيك الصلاحيات التي تحتاجها من شاشة «الصلاحيات».</p>
      </div>
    );
  } else {
    content = (
      <div className="acc-shell" style={{ '--acc-top': `${topBar}px` } as any}>
        <nav className="acc-nav" aria-label="قسم المحاسبة">
          <div className="acc-nav__brand">المحاسبة</div>
          {NAV.map((group, index) => {
            const links = group.links.filter((link) => allowed(link) && (!link.wizard || (wizard && !wizard.completed)));
            if (!links.length) return null;
            return (
              <div key={index} className="acc-nav__group">
                {group.label && <div className="acc-nav__label">{group.label}</div>}
                {links.map(({ to, label, icon: Icon, end, wizard: isWizard }) => (
                  <NavLink key={to} to={to} end={end} className={({ isActive }) => `acc-nav__link${isActive ? ' acc-nav__link--active' : ''}`}>
                    <Icon size={17} strokeWidth={1.75} />
                    {label}
                    {isWizard && wizard && <span className="acc-nav__count">{wizard.done}/{wizard.total}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <main className="acc-main">
          {pageAllowed ? <Outlet /> : (
            <div className="acc-empty">
              <h3>هذه الصفحة خارج صلاحياتك</h3>
              <p>اختر من القائمة ما هو متاح لك، أو اطلب الصلاحية من المالك.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  return <AccountingTheme>{content}</AccountingTheme>;
};

export default AccountingLayout;
