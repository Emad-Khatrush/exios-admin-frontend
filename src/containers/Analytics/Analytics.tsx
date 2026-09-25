import { useEffect, useState } from 'react';
import { CircularProgress } from '@mui/material';
import { Eye, Globe2, LineChart, Smartphone, Users } from 'lucide-react';
import api from '../../api';
import { AnalyticsSummary, SiteVisit } from '../../models';
import '../Settings/SettingsCommon.scss';
import './Analytics.scss';

const DEVICE_LABEL: Record<string, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
};

const formatPath = (path: string) => path === '/' ? 'Landing page' : path;

const formatDay = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Analytics = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisitsLoading, setIsVisitsLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
    fetchVisits();
  }, []);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('analytics/summary');
      setSummary(res.data);
    } catch (err) {
      // leave summary null - the page shows nothing rather than stale numbers
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVisits = async () => {
    try {
      setIsVisitsLoading(true);
      const res = await api.get('analytics/visits', { limit: 20 });
      setVisits(res.data.results || []);
    } catch (err) {
      // ignore, table stays empty
    } finally {
      setIsVisitsLoading(false);
    }
  };

  const maxDaily = summary ? Math.max(1, ...summary.dailySeries.map((d) => d.count)) : 1;
  const maxDeviceCount = summary ? Math.max(1, ...summary.deviceBreakdown.map((d) => d.count)) : 1;
  const maxPageCount = summary ? Math.max(1, ...summary.topPages.map((p) => p.count)) : 1;

  return (
    <div className="analytics-page">
      <header className="analytics-page__header">
        <h1>Website analytics</h1>
        <p>How many people are visiting Exios-Client, and what they're looking at. Visible to admins only.</p>
      </header>

      {isLoading ? (
        <div className="analytics-loading"><CircularProgress /></div>
      ) : !summary ? (
        <div className="settings-empty">
          <strong>No data yet</strong>
          <p>Visits will appear here once customers start using the site.</p>
        </div>
      ) : (
        <>
          <div className="analytics-stats">
            <div className="analytics-stat">
              <span className="analytics-stat__icon"><Eye size={18} strokeWidth={2} /></span>
              <div>
                <p className="analytics-stat__value">{summary.totalVisits.toLocaleString()}</p>
                <p className="analytics-stat__label">Total page views</p>
              </div>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__icon"><Users size={18} strokeWidth={2} /></span>
              <div>
                <p className="analytics-stat__value">{summary.totalVisitors.toLocaleString()}</p>
                <p className="analytics-stat__label">Unique visitors</p>
              </div>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__icon"><LineChart size={18} strokeWidth={2} /></span>
              <div>
                <p className="analytics-stat__value">{summary.todayVisits.toLocaleString()}</p>
                <p className="analytics-stat__label">Views today ({summary.todayVisitors.toLocaleString()} visitors)</p>
              </div>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__icon"><Globe2 size={18} strokeWidth={2} /></span>
              <div>
                <p className="analytics-stat__value">{summary.loggedInVisits.toLocaleString()}</p>
                <p className="analytics-stat__label">Logged-in views ({summary.guestVisits.toLocaleString()} guest)</p>
              </div>
            </div>
          </div>

          <div className="analytics-grid">
            <section className="analytics-panel analytics-panel--wide">
              <div className="analytics-panel__head">
                <h2>Daily views</h2>
                <p>Last {summary.dailySeries.length} days</p>
              </div>

              {summary.dailySeries.length === 0 ? (
                <div className="settings-empty"><strong>No visits in this window</strong></div>
              ) : (
                <div className="analytics-bars" role="img" aria-label="Daily page views over the last 30 days">
                  {summary.dailySeries.map((day) => (
                    <div key={day.date} className="analytics-bar-col">
                      <span className="analytics-bar-col__tooltip">
                        {formatDay(day.date)} · {day.count} view{day.count === 1 ? '' : 's'} · {day.uniqueVisitors} visitor{day.uniqueVisitors === 1 ? '' : 's'}
                      </span>
                      <div className="analytics-bar-col__track">
                        <div
                          className="analytics-bar-col__fill"
                          style={{ height: `${Math.max(4, (day.count / maxDaily) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="analytics-panel">
              <div className="analytics-panel__head">
                <h2>Device</h2>
              </div>

              {summary.deviceBreakdown.length === 0 ? (
                <div className="settings-empty"><strong>No data</strong></div>
              ) : (
                <div className="analytics-ranked">
                  {summary.deviceBreakdown
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((d) => (
                      <div key={d.device} className="analytics-ranked__row">
                        <span className="analytics-ranked__icon"><Smartphone size={14} strokeWidth={2} /></span>
                        <span className="analytics-ranked__label">{DEVICE_LABEL[d.device] || d.device}</span>
                        <div className="analytics-ranked__track">
                          <div className="analytics-ranked__fill" style={{ width: `${Math.max(4, (d.count / maxDeviceCount) * 100)}%` }} />
                        </div>
                        <span className="analytics-ranked__value">{d.count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="analytics-panel">
              <div className="analytics-panel__head">
                <h2>Top pages</h2>
              </div>

              {summary.topPages.length === 0 ? (
                <div className="settings-empty"><strong>No data</strong></div>
              ) : (
                <div className="analytics-ranked">
                  {summary.topPages.map((p) => (
                    <div key={p.path} className="analytics-ranked__row">
                      <span className="analytics-ranked__label analytics-ranked__label--path">{formatPath(p.path)}</span>
                      <div className="analytics-ranked__track">
                        <div className="analytics-ranked__fill" style={{ width: `${Math.max(4, (p.count / maxPageCount) * 100)}%` }} />
                      </div>
                      <span className="analytics-ranked__value">{p.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="analytics-panel analytics-panel--wide">
              <div className="analytics-panel__head">
                <h2>Recent visits</h2>
                <p>Most recent 20</p>
              </div>

              {isVisitsLoading ? (
                <div className="analytics-loading"><CircularProgress size={24} /></div>
              ) : visits.length === 0 ? (
                <div className="settings-empty"><strong>No visits yet</strong></div>
              ) : (
                <div className="analytics-table">
                  <div className="analytics-table__row analytics-table__row--head">
                    <span>Page</span>
                    <span>Visitor</span>
                    <span>Device</span>
                    <span>When</span>
                  </div>
                  {visits.map((visit) => (
                    <div key={visit._id} className="analytics-table__row">
                      <span className="analytics-table__path">{formatPath(visit.path)}</span>
                      <span>{visit.user ? `${visit.user.firstName} ${visit.user.lastName}` : 'Guest'}</span>
                      <span className="analytics-table__device">{DEVICE_LABEL[visit.device] || visit.device} · {visit.browser}</span>
                      <span className="analytics-table__date">
                        {new Date(visit.createdAt).toLocaleDateString()} {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
