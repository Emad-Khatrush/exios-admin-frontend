import { useState } from 'react';
import { ChevronDown, ExternalLink, Sparkles } from 'lucide-react';
import { En, Num } from './shared';
import { InsightPriority, Insights, InsightStatus } from './types';

// «المحلل الذكي»: the API's rule engine reading of the open section (CONTRACT.md «Third round: the analyst»).
// Shown at the top of every section; hidden when the answer has no `insights`. Open by default, and the
// open/closed choice is remembered for this browser.

const STATUS: Record<InsightStatus, string> = { good: 'جيد', warn: 'انتبه', bad: 'سيئ', info: 'معلومة' };
const PRIORITY: Record<InsightPriority, string> = { high: 'عاجل', medium: 'مهم', low: 'لاحقاً' };
const STORE_KEY = 'ca-insights-open';

const readOpen = () => {
  try { return window.localStorage.getItem(STORE_KEY) !== '0'; } catch { return true; }
};
const saveOpen = (open: boolean) => {
  try { window.localStorage.setItem(STORE_KEY, open ? '1' : '0'); } catch { /* storage blocked: the choice lasts this visit */ }
};

const InsightsPanel = ({ insights }: { insights?: Insights | null }) => {
  const [open, setOpen] = useState(readOpen);
  if (!insights) return null;

  const toggle = () => { const next = !open; setOpen(next); saveOpen(next); };
  const summary = insights.summary || [];
  const indicators = insights.indicators || [];
  const actions = insights.actions || [];
  const sources = insights.sources || [];

  return (
    <section className={`ca-insights${open ? ' is-open' : ''}`} aria-label="المحلل الذكي">
      <button type="button" className="ca-insights__toggle" aria-expanded={open} onClick={toggle}>
        <span className="ca-insights__icon" aria-hidden="true"><Sparkles size={18} /></span>
        <span className="ca-insights__titles">
          <span className="ca-insights__name">المحلل الذكي · <bdi dir="ltr">Smart Analyst</bdi></span>
          <span className="ca-insights__section">
            {insights.title}{insights.titleEn ? <> <En>{insights.titleEn}</En></> : null}
          </span>
        </span>
        <span className="ca-insights__state">{open ? 'إخفاء' : 'إظهار'}</span>
        <ChevronDown size={18} className="ca-insights__chev" aria-hidden="true" />
      </button>

      {open && (
        <div className="ca-insights__body">
          {insights.headline && <p className="ca-insights__headline">{insights.headline}</p>}

          {summary.length > 0 && (
            <ul className="ca-insights__summary">
              {summary.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}

          {indicators.length > 0 && (
            <div className="ca-insights__grid">
              {indicators.map((ind) => (
                <div key={ind.key} className={`ca-ind is-${ind.status}`}>
                  <div className="ca-ind__head">
                    <span className="ca-ind__label">
                      {ind.label}{ind.labelEn ? <> <En>{ind.labelEn}</En></> : null}
                    </span>
                    <span className={`ca-badge is-${ind.status}`}>{STATUS[ind.status] || ind.status}</span>
                  </div>
                  <strong className="ca-ind__value"><Num>{ind.value}</Num></strong>
                  {ind.benchmark && <small className="ca-ind__note">المرجع: {ind.benchmark}</small>}
                  {ind.target && <small className="ca-ind__note">الهدف: <Num>{ind.target}</Num></small>}
                </div>
              ))}
            </div>
          )}

          {actions.length > 0 && (
            <div className="ca-insights__actions">
              <h3>ماذا تفعل</h3>
              <ol>
                {actions.map((a, i) => (
                  <li key={i}>
                    <span className={`ca-prio is-${a.priority}`}>{PRIORITY[a.priority] || a.priority}</span>
                    <span>{a.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(insights.method || sources.length > 0) && (
            <details className="ca-details ca-insights__how">
              <summary>كيف وصل المحلل لهذا؟</summary>
              {insights.method && <p>{insights.method}</p>}
              {sources.length > 0 && (
                <ul className="ca-insights__sources">
                  {sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.label} <ExternalLink size={12} aria-hidden="true" />
                        <span className="ca-sr">(يفتح في نافذة جديدة)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          )}
        </div>
      )}
    </section>
  );
};

export default InsightsPanel;
