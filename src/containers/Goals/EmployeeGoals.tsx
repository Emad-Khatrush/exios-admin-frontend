import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Lightbulb } from 'lucide-react';
import { useGoalsDashboard } from './useGoalsDashboard';
import { buildInsights, formatMetric, GoalMetric, METRIC_META, METRICS, officeName, PERIOD_WORD, THIS_PERIOD } from './goalsData';
import { GoalsSkeleton, HistoryChart, MetricSwitch, MetricTile, PeriodControls } from './GoalsWidgets';

import './Goals.scss';

// The employee home page: their office's goals and what they sold themselves
const EmployeeGoals = () => {
  const account = useSelector((state: any) => state.session.account);
  const { period, data, isLoading, error, reload, setPeriod, setDate, shift } = useGoalsDashboard();
  const [metric, setMetric] = useState<GoalMetric>('sales');

  const office = data?.me?.office || account?.city || 'tripoli';
  const myScores = data?.board[office];
  const word = PERIOD_WORD[period];
  const myOffice = officeName(data?.offices || [], office);
  const insights = data && myScores ? buildInsights(data, office) : [];

  return (
    <div className="goals-page" dir="rtl" lang="ar">
      <header className="goals-page__header">
        <div>
          <h1>{account?.firstName ? `مرحباً ${account.firstName}` : 'أهدافك'}</h1>
          <p>أهداف {THIS_PERIOD[period]} لمكتب {myOffice}، وما بعته أنت.</p>
        </div>
      </header>

      <div className="goals-toolbar">
        <PeriodControls
          period={period}
          label={data?.label || ''}
          isCurrent={data?.isCurrent ?? true}
          canGoNext={!!data?.canGoNext}
          history={data?.history || []}
          selectedKey={data?.from || ''}
          onPeriod={setPeriod}
          onShift={shift}
          onJump={setDate}
        />
      </div>

      {error && (
        <div className="goal-banner goal-banner--error" role="alert">
          <p>{error}</p>
          <button type="button" className="goal-btn goal-btn--ghost" onClick={reload}>إعادة المحاولة</button>
        </div>
      )}

      {!data && isLoading && <GoalsSkeleton />}

      {data && (
        <div className={`goals-body ${isLoading ? 'is-refreshing' : ''}`}>
          {data.me && (
            <section className="goal-me" aria-label="مبيعاتك">
              <div className="goal-me__main">
                <p className="goal-me__label">مبيعاتك، {data.label}</p>
                <p className="goal-me__value"><bdi>{formatMetric('sales', data.me.sales)}</bdi></p>
                <p className="goal-me__sub">
                  {data.me.orders} {data.me.orders >= 3 && data.me.orders <= 10 ? 'فواتير' : 'فاتورة'}
                  {data.me.shareOfOffice !== null && `، ${Math.round(data.me.shareOfOffice * 100)}% من مبيعات مكتب ${myOffice}`}
                </p>
              </div>
              <dl className="goal-me__facts">
                <div>
                  <dt>جوي من الصين</dt>
                  <dd><bdi>{formatMetric('air', data.me.air)}</bdi></dd>
                </div>
                <div>
                  <dt>LCL من الصين</dt>
                  <dd><bdi>{formatMetric('lcl', data.me.lcl)}</bdi></dd>
                </div>
                {myScores && myScores.sales.target > 0 && (
                  <div>
                    <dt>المتبقي على المكتب</dt>
                    <dd><bdi>{myScores.sales.hit ? 'تحقق الهدف' : formatMetric('sales', myScores.sales.remaining)}</bdi></dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {myScores ? (
            <section className="goal-tiles" aria-label={`أهداف مكتب ${myOffice}`}>
              {METRICS.map((m) => (
                <MetricTile key={m} metric={m} score={myScores[m]} dashboard={data} isActive={metric === m} onSelect={() => setMetric(m)} />
              ))}
            </section>
          ) : (
            <div className="goal-banner"><p>لم تُحدد أهداف لمكتبك بعد.</p></div>
          )}

          <div className="goals-grid">
            <section className="goal-panel goals-grid__main">
              <header className="goal-panel__head">
                <div>
                  <h2>آخر {data.history.length} {period === 'week' ? 'أسبوعاً' : 'شهراً'}</h2>
                  <p>مكتب {myOffice}، {METRIC_META[metric].label}.</p>
                </div>
                <MetricSwitch value={metric} onChange={setMetric} />
              </header>
              <HistoryChart
                period={period}
                history={data.history}
                scope={myScores ? office : 'all'}
                metric={metric}
                selectedKey={data.from}
                onSelect={(item) => setDate(item.isCurrent ? '' : item.from)}
              />
            </section>
            <aside className="goals-grid__side">
              <section className="goal-panel">
                <header className="goal-panel__head">
                  <h2><Lightbulb size={16} strokeWidth={2} aria-hidden="true" /> ما المطلوب</h2>
                </header>
                {insights.length ? (
                  <ul className="goal-insights">
                    {insights.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                ) : (
                  <p className="goal-muted">لا يوجد ما يستدعي الانتباه في هذا {word}.</p>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeGoals;
