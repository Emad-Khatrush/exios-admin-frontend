import { ChevronRight, DollarSign, Megaphone, MonitorSmartphone, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import './SettingsCommon.scss';
import './Settings.scss';

const sections = [
  { to: '/settings/pricing', icon: DollarSign, label: 'Pricing', description: 'Exchange rate and the selling price for each shipping route.' },
  { to: '/settings/announcements', icon: Megaphone, label: 'Announcements', description: 'Short notices shown to customers in the app.' },
  { to: '/settings/posts', icon: Newspaper, label: 'Posts', description: 'News and updates published to customers.' },
  { to: '/settings/popup-ads', icon: MonitorSmartphone, label: 'Popup ads', description: 'Full-screen announcements customers must acknowledge.' },
];

const Settings = () => {
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
        {sections.map(({ to, icon: Icon, label, description }) => (
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
