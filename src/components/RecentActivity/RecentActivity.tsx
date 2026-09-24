import { ArrowDownLeft, ArrowUpRight, FileText, Wallet } from 'lucide-react';
import moment from 'moment';
import { Link } from 'react-router-dom';

import './RecentActivity.scss';

type ActivityItem = {
  type: 'order' | 'payment';
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  isPositive: boolean;
  office: string | null;
  createdAt: string;
};

type Props = {
  items: ActivityItem[];
};

const formatMoney = (value: number, currency: string) =>
  `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const RecentActivity = ({ items }: Props) => {
  return (
    <div className="recent-activity">
      <h3>Recent activity</h3>

      {items.length === 0 ? (
        <p className="recent-activity-empty">Nothing to show yet.</p>
      ) : (
        <ul className="recent-activity-list">
          {items.map(item => (
            <li key={`${item.type}-${item.id}`} className="recent-activity-row">
              <span className={`recent-activity-icon ${item.isPositive ? 'is-up' : 'is-down'}`}>
                {item.type === 'order' ? <FileText size={15} strokeWidth={2} /> : <Wallet size={15} strokeWidth={2} />}
              </span>

              <div className="recent-activity-body">
                <span className="recent-activity-title">{item.title}</span>
                <span className="recent-activity-subtitle">{item.subtitle}</span>
              </div>

              <div className="recent-activity-meta">
                <span className={`recent-activity-amount ${item.isPositive ? 'is-up' : 'is-down'}`}>
                  {item.isPositive ? <ArrowUpRight size={13} strokeWidth={2.5} /> : <ArrowDownLeft size={13} strokeWidth={2.5} />}
                  {formatMoney(item.amount, item.currency)}
                </span>
                <span className="recent-activity-time">{moment(item.createdAt).fromNow()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link to="/invoices" className="recent-activity-link">View all invoices</Link>
    </div>
  );
};

export default RecentActivity;
