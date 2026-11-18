import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { Bell, BellOff, Download, Percent, Smartphone, UserX } from 'lucide-react';
import api from '../../api';

/* The client app on customers' devices: how many installed it, how many turned notifications on,
   which phones, new installs per day, and who opened it last. An installed app not opened for
   `activeDays` counts as no longer used: browsers never say when an app is removed. */

type AppSummary = {
  activeDays: number
  clients: number
  installedCustomers: number
  stoppedCustomers: number
  pushCustomers: number
  platforms: { platform: 'android' | 'ios' | 'desktop', devices: number }[]
  newInstalls: { date: string, count: number }[]
  appVisitShare: number
  recent: { customerId: string, name: string, userId: string | null, platform: string, push: boolean, lastAppAt: string, status: 'installed' | 'stopped' }[]
};

export const PLATFORM_LABEL: Record<string, string> = { android: 'Android', ios: 'iPhone / iPad', desktop: 'Computer' };

const formatDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '0%');

const AppUsage = () => {
  const [data, setData] = useState<AppSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('analytics/app')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="analytics-loading"><CircularProgress size={24} /></div>;
  if (!data) return null;

  const maxPlatform = Math.max(1, ...data.platforms.map((p) => p.devices));
  const maxInstalls = Math.max(1, ...data.newInstalls.map((d) => d.count));

  return (
    <section className="analytics-app" aria-labelledby="analytics-app-title">
      <div className="analytics-app__head">
        <h2 id="analytics-app-title">Client app</h2>
        <p>Customers who installed the app on their phone, and who get notifications. Not opened for {data.activeDays} days counts as no longer used.</p>
      </div>

      <div className="analytics-stats">
        <div className="analytics-stat">
          <span className="analytics-stat__icon"><Download size={18} strokeWidth={2} /></span>
          <div>
            <p className="analytics-stat__value">{data.installedCustomers.toLocaleString()}</p>
            <p className="analytics-stat__label">Customers using the app ({percent(data.installedCustomers, data.clients)} of {data.clients.toLocaleString()})</p>
          </div>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat__icon"><Bell size={18} strokeWidth={2} /></span>
          <div>
            <p className="analytics-stat__value">{data.pushCustomers.toLocaleString()}</p>
            <p className="analytics-stat__label">Customers with notifications on</p>
          </div>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat__icon"><UserX size={18} strokeWidth={2} /></span>
          <div>
            <p className="analytics-stat__value">{data.stoppedCustomers.toLocaleString()}</p>
            <p className="analytics-stat__label">Stopped using it (removed, most likely)</p>
          </div>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat__icon"><Percent size={18} strokeWidth={2} /></span>
          <div>
            <p className="analytics-stat__value">{data.appVisitShare}%</p>
            <p className="analytics-stat__label">Of logged-in page views were in the app (30 days)</p>
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        <section className="analytics-panel">
          <div className="analytics-panel__head">
            <h2>Phones using the app</h2>
          </div>
          <div className="analytics-ranked">
            {data.platforms.map((p) => (
              <div key={p.platform} className="analytics-ranked__row">
                <span className="analytics-ranked__icon"><Smartphone size={14} strokeWidth={2} /></span>
                <span className="analytics-ranked__label">{PLATFORM_LABEL[p.platform]}</span>
                <div className="analytics-ranked__track">
                  <div className="analytics-ranked__fill" style={{ width: `${p.devices ? Math.max(4, (p.devices / maxPlatform) * 100) : 0}%` }} />
                </div>
                <span className="analytics-ranked__value">{p.devices.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel__head">
            <h2>New installs</h2>
            <p>Last 30 days</p>
          </div>
          {data.newInstalls.length === 0 ? (
            <div className="settings-empty"><strong>No installs in this window</strong></div>
          ) : (
            <div className="analytics-bars analytics-bars--short" role="img" aria-label="New app installs per day over the last 30 days">
              {data.newInstalls.map((day) => (
                <div key={day.date} className="analytics-bar-col">
                  <span className="analytics-bar-col__tooltip">{formatDay(day.date)} · {day.count} install{day.count === 1 ? '' : 's'}</span>
                  <div className="analytics-bar-col__track">
                    <div className="analytics-bar-col__fill" style={{ height: `${Math.max(4, (day.count / maxInstalls) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="analytics-panel analytics-panel--wide">
          <div className="analytics-panel__head">
            <h2>Last opened the app</h2>
            <p>Most recent 10</p>
          </div>
          {data.recent.length === 0 ? (
            <div className="settings-empty"><strong>No one has opened the app yet</strong></div>
          ) : (
            <div className="analytics-table">
              <div className="analytics-table__row analytics-table__row--head">
                <span>Customer</span>
                <span>Phone</span>
                <span>Notifications</span>
                <span>Last opened</span>
              </div>
              {data.recent.map((r, i) => (
                <div key={`${r.customerId}-${i}`} className="analytics-table__row">
                  <span>
                    {r.userId ? <Link to={`/user/${r.userId}`}>{r.customerId}</Link> : r.customerId} {r.name}
                    {r.status === 'stopped' && <span className="analytics-pill analytics-pill--muted">stopped</span>}
                  </span>
                  <span className="analytics-table__device">{PLATFORM_LABEL[r.platform] || r.platform}</span>
                  <span>{r.push ? <span className="analytics-pill"><Bell size={12} /> On</span> : <span className="analytics-pill analytics-pill--muted"><BellOff size={12} /> Off</span>}</span>
                  <span className="analytics-table__date">
                    {new Date(r.lastAppAt).toLocaleDateString()} {new Date(r.lastAppAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
};

export default AppUsage;
