import { ChevronRight, DollarSign, FolderLock, Hash, Megaphone, MonitorSmartphone, Newspaper, ShieldCheck } from "lucide-react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useStaffAccess } from "../../utils/useStaffAccess";
import { canOpen } from "../../constants/staffPermissions";
import './SettingsCommon.scss';
import './Settings.scss';

const sections = [
  { to: '/settings/pricing', icon: DollarSign, label: 'Pricing', description: 'Exchange rate and the selling price for each shipping route.' },
  { to: '/settings/announcements', icon: Megaphone, label: 'Announcements', description: 'Short notices shown to customers in the app.' },
  { to: '/settings/posts', icon: Newspaper, label: 'Posts', description: 'News and updates published to customers.' },
  { to: '/settings/popup-ads', icon: MonitorSmartphone, label: 'Popup ads', description: 'Full-screen announcements customers must acknowledge.' },
];

const adminSections = [
  { to: '/settings/permissions', icon: ShieldCheck, label: 'Permissions', description: 'What each staff member can open, including accounting. Admins and owners only.' },
  { to: '/settings/trip-numbering', icon: Hash, label: 'Trip numbering', description: 'Automatic sequences and name templates for each country and shipping type.' },
  { to: '/settings/company-notes', icon: FolderLock, label: 'Company notes', description: 'Important notes and company files, visible to admins only.' },
];

const Settings = () => {
  const roles = useSelector((state: any) => state.session.account?.roles);
  const access = useStaffAccess();
  // A configured staff member sees the sections their permissions open; otherwise by role, as before
  const visibleSections = access.full ? [...sections, ...adminSections]
    : access.configured ? sections.filter((section) => canOpen(section.to, access.permissions))
    : roles?.isAccountant ? sections : [];

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div className="settings-page__title">
          <div>
            <h1>Settings</h1>
            <p>Choose a section to manage.</p>
          </div>
        </div>
      </div>

      <div className="settings-hub">
        {visibleSections.map(({ to, icon: Icon, label, description }) => (
          <Link key={to} to={to} className="settings-hub-card">
            <span className="settings-hub-card__icon"><Icon size={20} strokeWidth={2} /></span>
            <span className="settings-hub-card__text">
              <span className="settings-hub-card__label">{label}</span>
              <span className="settings-hub-card__description">{description}</span>
            </span>
            <ChevronRight size={18} className="settings-hub-card__chevron" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Settings;
