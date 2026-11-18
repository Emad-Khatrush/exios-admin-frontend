import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Skeleton } from '@mui/material';
import api from '../../api';
import { requestError } from './PaymentPoints';
import { fullDate, pointsText } from './format';
import { LoyaltyRtl, Num, stagger } from './LoyaltyRtl';
import { LevelBadge, WHY, timesText, useTiers } from './levels';
import './loyalty.scss';

type Report = {
  tiers: { key: string, name: string, color: string, rank: number, min: number, multiplier: number, customers: number }[]
  upgraded: { userId: string, name: string, customerId: string, from: string, to: string, at: string, why: string }[]
  atRisk: { userId: string, name: string, customerId: string, phone: number | null, level: string, points: number, needed: number, reviewAt: string }[]
  near: { userId: string, name: string, customerId: string, phone: number | null, level: string, next: string, points: number, remaining: number }[]
};

// The levels at a glance for the points staff: customers in each level, who moved up this month,
// who is close to the next level and whose level drops at a review within 30 days (people for the
// sales team to call)
const LoyaltyLevels = () => {
  const navigate = useNavigate();
  const tiers = useTiers();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get('loyalty/levels/report')
      .then((res: any) => setReport(res.data))
      .catch((e: any) => setError(requestError(e, 'تعذّر تحميل تقرير المستويات.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (userId: string) => navigate(`/user/${userId}?tab=points`);
  const total = (report?.tiers || []).reduce((sum, t) => sum + t.customers, 0);

  const person = (row: { userId: string, name: string, customerId: string }) => (
    <button type="button" className="lp-feed__who" onClick={() => open(row.userId)} dir="auto">
      {row.name || 'عميل'} {row.customerId && <span className="lp-muted">· <Num>{row.customerId}</Num></span>}
    </button>
  );

  return (
    <LoyaltyRtl>
      <div className="lp lp-page lp-enter" dir="rtl">
        <header className="lp-head" style={stagger(0)}>
          <h1>مستويات الولاء</h1>
          <p>كم عميلاً في كل مستوى، ومن يستحق اتصالاً هذا الشهر.</p>
          <Link to="/loyalty" className="lp-head__link">العودة إلى النقاط</Link>
        </header>

        {error && <Alert severity="error" action={<Button size="small" onClick={load}>إعادة</Button>}>{error}</Alert>}

        <section className="lp-ladder" aria-label="المستويات" style={stagger(1)}>
          {(report?.tiers || tiers.map((t) => ({ ...t, customers: 0 }))).map((tier) => (
            <div key={tier.key} className="lp-ladder__step" style={{ ['--lv' as any]: tier.color }}>
              <span className="lp-ladder__name">{tier.name}</span>
              <strong className="lp-ladder__count">{report ? <Num>{pointsText(tier.customers)}</Num> : <Skeleton width={40} />}</strong>
              <span className="lp-muted">عميل{report && total > 0 ? <> · <Num>{Math.round((tier.customers / total) * 100)}%</Num></> : null}</span>
              <span className="lp-ladder__rule">
                {tier.min > 0 ? <>من <Num>{pointsText(tier.min)}</Num> نقطة</> : 'البداية'} · <Num>{timesText(tier.multiplier)}</Num>
              </span>
            </div>
          ))}
        </section>

        <div className="lp-levels-grid" style={stagger(2)}>
          <section className="lp-panel" aria-labelledby="lv-near">
            <h2 id="lv-near" className="lp-panel__title">قريبون من الترقية</h2>
            <p className="lp-muted lp-panel__hint">شحنة أو اثنتان وينتقلون للمستوى التالي.</p>
            {!report ? <Skeleton height={80} /> : !report.near.length ? <p className="lp-muted lp-panel__empty">لا أحد الآن.</p> : (
              <ul className="lp-feed">
                {report.near.map((row) => (
                  <li key={row.userId} className="lp-feed__item">
                    <div className="lp-feed__body">
                      {person(row)}
                      <div className="lp-feed__what"><LevelBadge level={row.level} tiers={tiers} size="sm" /> ← <LevelBadge level={row.next} tiers={tiers} size="sm" />{row.phone ? <> · <Num>{row.phone}</Num></> : null}</div>
                    </div>
                    <div className="lp-feed__side"><strong>باقي <Num>{pointsText(row.remaining)}</Num></strong><small>نقطة</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="lp-panel" aria-labelledby="lv-risk">
            <h2 id="lv-risk" className="lp-panel__title">ينزل مستواهم قريباً</h2>
            <p className="lp-muted lp-panel__hint">مراجعتهم خلال 30 يوماً ولم يصلوا نقاط مستواهم.</p>
            {!report ? <Skeleton height={80} /> : !report.atRisk.length ? <p className="lp-muted lp-panel__empty">لا أحد الآن.</p> : (
              <ul className="lp-feed">
                {report.atRisk.map((row) => (
                  <li key={row.userId} className="lp-feed__item is-warn">
                    <div className="lp-feed__body">
                      {person(row)}
                      <div className="lp-feed__what"><LevelBadge level={row.level} tiers={tiers} size="sm" /> · المراجعة <Num>{fullDate(row.reviewAt)}</Num>{row.phone ? <> · <Num>{row.phone}</Num></> : null}</div>
                    </div>
                    <div className="lp-feed__side"><strong>ينقصه <Num>{pointsText(row.needed)}</Num></strong><small>نقطة</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="lp-panel" aria-labelledby="lv-up">
            <h2 id="lv-up" className="lp-panel__title">ترقّوا هذا الشهر</h2>
            {!report ? <Skeleton height={80} /> : !report.upgraded.length ? <p className="lp-muted lp-panel__empty">لا ترقيات بعد هذا الشهر.</p> : (
              <ul className="lp-feed">
                {report.upgraded.map((row, index) => (
                  <li key={`${row.userId}-${index}`} className="lp-feed__item is-gain">
                    <div className="lp-feed__body">
                      {person(row)}
                      <div className="lp-feed__what"><LevelBadge level={row.from} tiers={tiers} size="sm" /> ← <LevelBadge level={row.to} tiers={tiers} size="sm" /> · {WHY[row.why] || row.why}</div>
                    </div>
                    <div className="lp-feed__side"><small><Num>{fullDate(row.at)}</Num></small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

      </div>
    </LoyaltyRtl>
  );
};

export default LoyaltyLevels;
