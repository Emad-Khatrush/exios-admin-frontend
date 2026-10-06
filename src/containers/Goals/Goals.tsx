import { useState } from 'react';
import { Globe2, Lightbulb, Pencil, Target, Trophy } from 'lucide-react';
import GoalsEditor from './GoalsEditor';
import { useGoalsDashboard } from './useGoalsDashboard';
import {
  buildInsights, formatMetric, GoalMetric, historyStats, METRIC_META, METRICS, officeName, PERIOD_WORD, scoresFor,
} from './goalsData';
import { CountryBreakdown, DailyChart, GoalsSkeleton, HistoryChart, MetricSwitch, MetricTile, OfficeGoals, PeriodControls } from './GoalsWidgets';

import './Goals.scss';

const Goals = () => {
  const { period, data, isLoading, error, reload, setPeriod, setDate, shift } = useGoalsDashboard();
  const [scope, setScope] = useState('all');
  const [metric, setMetric] = useState<GoalMetric>('sales');
  const [isEditing, setIsEditing] = useState(false);

  const scores = data ? scoresFor(scope, data.board, data.totals) : null;
  const hasGoals = !!data && METRICS.some((m) => data.history.some((item) => item.totals[m].target > 0));
  const word = PERIOD_WORD[period];
  const stats = data ? historyStats(data.history, scope, metric) : null;
  const insights = data ? buildInsights(data, scope) : [];

  return (
    <div className="goals-page" dir="rtl" lang="ar">
      <header className="goals-page__header">
        <div className="goals-page__title">
          <span className="goals-page__icon"><Target size={20} strokeWidth={2} /></span>
          <div>
            <h1>أهداف المبيعات</h1>
            <p>الأهداف الأسبوعية والشهرية لكل مكتب: المبيعات من كل الدول، والشحن من الصين.</p>
          </div>
        </div>
        <button type="button" className="goal-btn" onClick={() => setIsEditing(true)}>
          <Pencil size={15} strokeWidth={2} />
          تحديد الأهداف
        </button>
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
        {data && data.offices.length > 1 && (
          <div className="goal-chips" role="group" aria-label="المكتب">
            {[{ code: 'all', name: 'كل المكاتب' }, ...data.offices].map((office) => (
              <button key={office.code} type="button" aria-pressed={scope === office.code} className={scope === office.code ? 'is-active' : ''} onClick={() => setScope(office.code)}>
                {office.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="goal-banner goal-banner--error" role="alert">
          <p>{error}</p>
          <button type="button" className="goal-btn goal-btn--ghost" onClick={reload}>إعادة المحاولة</button>
        </div>
      )}

      {!data && isLoading && <GoalsSkeleton />}

      {data && scores && (
        <div className={`goals-body ${isLoading ? 'is-refreshing' : ''}`}>
          <div className="goals-period-line">
            <h2>{data.label}</h2>
            <p>
              {data.isCurrent
                ? `اليوم ${data.elapsedDays} من ${data.totalDays}`
                : data.elapsedDays === 0 ? 'لم يبدأ بعد' : `${word} منتهٍ`}
              {scope !== 'all' && `، مكتب ${officeName(data.offices, scope)}`}
            </p>
          </div>

          {!hasGoals && (
            <div className="goal-banner">
              <p><strong>لا توجد أهداف بعد.</strong> حدد الأهداف الأسبوعية والشهرية لكل مكتب لتبدأ متابعتها هنا.</p>
              <button type="button" className="goal-btn" onClick={() => setIsEditing(true)}>تحديد الأهداف</button>
            </div>
          )}

          <section className="goal-tiles" aria-label="أهداف هذه الفترة">
            {METRICS.map((m) => (
              <MetricTile key={m} metric={m} score={scores[m]} dashboard={data} isActive={metric === m} onSelect={() => setMetric(m)} />
            ))}
          </section>

          <div className="goals-grid">
            <section className="goal-panel goals-grid__main">
              <header className="goal-panel__head">
                <div>
                  <h2>آخر {data.history.length} {period === 'week' ? 'أسبوعاً' : 'شهراً'}</h2>
                  <p>{METRIC_META[metric].label}. اضغط على أي عمود لفتح ذلك {word}.</p>
                </div>
                <MetricSwitch value={metric} onChange={setMetric} />
              </header>
              <HistoryChart
                period={period}
                history={data.history}
                scope={scope}
                metric={metric}
                selectedKey={data.from}
                onSelect={(item) => setDate(item.isCurrent ? '' : item.from)}
              />
              {stats && (
                <dl className="goal-stats">
                  <div>
                    <dt>تحقق الهدف</dt>
                    <dd>{stats.periods ? `${stats.hits} من ${stats.periods}` : '-'}</dd>
                  </div>
                  <div>
                    <dt>المتوسط</dt>
                    <dd><bdi>{formatMetric(metric, stats.average)}</bdi></dd>
                  </div>
                  <div>
                    <dt>متوسط نسبة الهدف</dt>
                    <dd>{stats.averageProgress !== null ? `${Math.round(stats.averageProgress * 100)}%` : '-'}</dd>
                  </div>
                  <div>
                    <dt>أفضل {word}</dt>
                    <dd>{stats.best ? <><bdi>{formatMetric(metric, stats.best.value)}</bdi> <small>{stats.best.label}</small></> : '-'}</dd>
                  </div>
                </dl>
              )}

              <div className="goal-panel__sub">
                <h3>يوماً بيوم</h3>
                <p>{scores[metric].target > 0 ? `الخط المتقطع هو الهدف موزعاً بالتساوي على أيام ${word}.` : `${METRIC_META[metric].label} في كل يوم من ${word}.`}</p>
              </div>
              <DailyChart
                daily={data.daily}
                scope={scope}
                metric={metric}
                perDay={scores[metric].target > 0 ? scores[metric].target / data.totalDays : null}
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
                  <p className="goal-muted">حدد الأهداف لترى ما يحتاجه كل مكتب لتحقيقها.</p>
                )}
              </section>

              <section className="goal-panel">
                <header className="goal-panel__head">
                  <div>
                    <h2><Globe2 size={16} strokeWidth={2} aria-hidden="true" /> حصة الصين</h2>
                    <p>{METRIC_META[metric].label}: الصين مقارنة بالدول الأخرى.</p>
                  </div>
                </header>
                <CountryBreakdown dashboard={data} scope={scope} metric={metric} />
              </section>

              {data.leaderboard && (
                <section className="goal-panel">
                  <header className="goal-panel__head">
                    <h2><Trophy size={16} strokeWidth={2} aria-hidden="true" /> الأعلى مبيعاً</h2>
                  </header>
                  {(() => {
                    const rows = data.leaderboard.filter((row) => scope === 'all' || row.office === scope);
                    const top = Math.max(1, ...rows.map((row) => row.sales));
                    return rows.length ? (
                      <ol className="goal-leaders">
                        {rows.map((row, index) => (
                          <li key={row.userId}>
                            <span className="goal-leaders__rank">{index + 1}</span>
                            <div className="goal-leaders__who">
                              <strong>{row.name}</strong>
                              <span>{officeName(data.offices, row.office)}، {row.orders} {row.orders >= 3 && row.orders <= 10 ? 'فواتير' : 'فاتورة'}</span>
                              <span className="goal-leaders__bar" style={{ transform: `scaleX(${row.sales / top})` }} aria-hidden="true" />
                            </div>
                            <span className="goal-leaders__value">{formatMetric('sales', row.sales)}</span>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="goal-muted">لا توجد فواتير في هذا {word} بعد.</p>;
                  })()}
                </section>
              )}
            </aside>
          </div>

          <section className="goal-offices-section">
            <h2>المكاتب</h2>
            <div className="goal-offices">
              {data.offices.filter((office) => scope === 'all' || office.code === scope).map((office) => (
                <OfficeGoals key={office.code} name={office.name} scores={data.board[office.code]} dashboard={data} />
              ))}
            </div>
          </section>
        </div>
      )}

      <GoalsEditor
        open={isEditing}
        initialPeriod={period}
        onClose={() => setIsEditing(false)}
        onSaved={() => { setIsEditing(false); reload(); }}
      />
    </div>
  );
};

export default Goals;
