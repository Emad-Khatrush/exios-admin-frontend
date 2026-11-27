import { CSSProperties } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { TargetMark } from './compare';
import { count, monthName, pct } from './format';
import { Empty, Loading, Num, Panel, SectionError, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { CohortsData, Rate } from './types';

// One blue, light → dark with the rate; dark cells switch to white text
const RAMP = ['#f3f8fe', '#cce3fd', '#b6d5f8', '#9dc8f7', '#84b9f3', '#6aabf1', '#519ced', '#338ced', '#257de0', '#2370cd', '#1b64be'];
const cellStyle = (rate: Rate): CSSProperties => {
  if (rate == null) return {};
  const step = Math.min(RAMP.length - 1, Math.round(Math.max(0, Math.min(1, rate)) * (RAMP.length - 1)));
  return { background: RAMP[step], color: step >= 7 ? '#ffffff' : '#18212b' };
};

const MONTH_OPTIONS = ['6', '12', '24'];

// الاحتفاظ: customers grouped by the month of their first order, and how many of them ordered again k months later
const CohortsSection = () => {
  const { filters, param, setParam } = useEnv();
  const months = MONTH_OPTIONS.includes(param('months')) ? param('months') : '12';
  const { data, error, loading, retry } = useSection<CohortsData>('cohorts', { months, office: filters.office });

  const picker = (
    <TextField select size="small" label="عدد الأشهر" value={months} onChange={(e) => setParam({ months: e.target.value === '12' ? null : e.target.value })} sx={{ minWidth: 130 }}>
      {MONTH_OPTIONS.map((m) => <MenuItem key={m} value={m}>آخر {m} شهراً</MenuItem>)}
    </TextField>
  );

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={0} />;

  const cohorts = data.cohorts || [];
  const width = Math.max(0, ...cohorts.map((c) => c.rates.length), (data.average || []).length);
  const offsets = Array.from({ length: width }, (_, k) => k);
  const average = new Map((data.average || []).map((a) => [a.offset, a]));

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <InsightsPanel insights={data.insights} />
      <Panel
        title="كم بقي من عملاء كل شهر"
        en="Cohort Retention"
        sub="كل صف: العملاء الذين كان أول طلب لهم في ذلك الشهر. الخانة «بعد 3» = نسبة من طلب منهم في الشهر الثالث بعد شهر أول طلب. الشهر الأول دائماً 100%."
        actions={picker}
      >
        {!cohorts.length ? <Empty>لا توجد طلبات كافية لعرض الاحتفاظ.</Empty> : (
          <div className="ca-table-wrap">
            <table className="ca-table ca-heat">
              <thead>
                <tr>
                  <th>شهر أول طلب</th>
                  <th className="is-num">العملاء</th>
                  {offsets.map((k) => <th key={k} className="is-num">{k === 0 ? 'الشهر نفسه' : <>بعد <Num>{k}</Num></>}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month}>
                    <th scope="row">{monthName(c.month)}</th>
                    <td className="is-num"><Num>{count(c.size)}</Num></td>
                    {offsets.map((k) => (k < c.rates.length ? (
                      <td key={k} className="is-num ca-heat__cell" style={cellStyle(c.rates[k])} title={`${count(c.retained[k])} من ${count(c.size)}`}>
                        <Num>{pct(c.rates[k])}</Num>
                      </td>
                    ) : <td key={k} className="ca-heat__none" />))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">المتوسط</th>
                  <td className="is-num ca-muted">مرجّح بالحجم</td>
                  {offsets.map((k) => {
                    const a = average.get(k);
                    return (
                      <td key={k} className="is-num ca-heat__cell" style={cellStyle(a?.rate ?? null)} title={a ? `من ${count(a.cohorts)} شهراً` : undefined}>
                        <Num>{pct(a?.rate)}</Num>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {data.targets?.month1Retention != null && (
          <p className="ca-period">
            المتوسط بعد شهر: <Num>{pct(average.get(1)?.rate)}</Num>{' '}
            <TargetMark now={average.get(1)?.rate ?? null} target={data.targets.month1Retention} unit="rate" better="up" />
          </p>
        )}
        <p className="ca-note">مرّر المؤشر على الخانة لترى العدد. الخانات الفارغة: لم يمرّ ذلك الوقت بعد.</p>
      </Panel>
    </div>
  );
};

export default CohortsSection;
