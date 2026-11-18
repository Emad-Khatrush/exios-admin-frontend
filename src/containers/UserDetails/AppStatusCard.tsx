import { useEffect, useState } from 'react';
import { Bell, BellOff, Download, Globe, Smartphone } from 'lucide-react';
import api from '../../api';
import { PLATFORM_LABEL } from '../Analytics/AppUsage';
import './appStatusCard.scss';

/* On the customer's page: whether they use the client app on their phone, get notifications, and
   when they last opened it. "Stopped" = installed once but not opened for `activeDays` (browsers
   never say when an app is removed). */

type Device = { platform: string, browser: string, status: 'installed' | 'stopped' | 'browser', push: boolean, firstAppAt: string | null, lastAppAt: string | null, lastSeenAt: string };
type AppStatus = { status: 'installed' | 'stopped' | 'browser' | 'never', installedDevices: number, pushDevices: number, lastAppAt: string | null, activeDays: number, devices: Device[] };

const STATUS: Record<AppStatus['status'], { label: string, hint: (d: AppStatus) => string, tone: string }> = {
  installed: { label: 'Uses the app', tone: 'on', hint: (d) => `Installed on ${d.installedDevices} device${d.installedDevices === 1 ? '' : 's'}` },
  stopped: { label: 'Stopped using the app', tone: 'off', hint: (d) => `Not opened for over ${d.activeDays} days (removed, most likely)` },
  browser: { label: 'Browser only', tone: 'muted', hint: () => 'Uses the site in a browser, has not installed the app' },
  never: { label: 'Not seen yet', tone: 'muted', hint: () => 'Has not opened the site since this was added' },
};

const ago = (date: string | null) => {
  if (!date) return '—';
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const AppStatusCard = ({ userId }: { userId: string }) => {
  const [data, setData] = useState<AppStatus | null>(null);

  useEffect(() => {
    let alive = true;
    api.get(`user/${userId}/app`).then((res) => { if (alive) setData(res.data); }).catch(() => undefined);
    return () => { alive = false; };
  }, [userId]);

  if (!data) return null;
  const s = STATUS[data.status];

  return (
    <section className="app-card" aria-labelledby="app-card-title">
      <div className="app-card__head">
        <span className={`app-card__icon is-${s.tone}`} aria-hidden>{data.status === 'browser' || data.status === 'never' ? <Globe size={18} /> : <Download size={18} />}</span>
        <div className="app-card__title">
          <h3 id="app-card-title">Client app · <span className={`is-${s.tone}`}>{s.label}</span></h3>
          <p>{s.hint(data)}</p>
        </div>
        <div className="app-card__facts">
          <span className={`app-card__pill ${data.pushDevices ? 'is-on' : ''}`}>
            {data.pushDevices ? <Bell size={13} aria-hidden /> : <BellOff size={13} aria-hidden />}
            Notifications {data.pushDevices ? 'on' : 'off'}
          </span>
          <span className="app-card__pill">Last opened {ago(data.lastAppAt)}</span>
        </div>
      </div>

      {data.devices.length > 0 && (
        <ul className="app-card__devices">
          {data.devices.map((d, i) => (
            <li key={i}>
              <Smartphone size={14} aria-hidden />
              <span className="app-card__device">{PLATFORM_LABEL[d.platform] || d.platform}{d.browser ? ` · ${d.browser}` : ''}</span>
              <span className={`app-card__tag is-${STATUS[d.status].tone}`}>{d.status === 'installed' ? 'App' : d.status === 'stopped' ? 'Stopped' : 'Browser'}</span>
              {d.push && <span className="app-card__tag is-on">Notifications</span>}
              <span className="app-card__when">seen {ago(d.lastSeenAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default AppStatusCard;
