import { Bar, Doughnut } from 'react-chartjs-2';
import { baseOptions, barStyle, C1, C2, FONT, INK, NEUTRAL } from './charts';
import { count, monthName, monthShort, pct, usdWhole } from './format';
import { ChartTable, Empty, Loading, Num, Panel, PeriodLine, SectionError, Segment, useEnv, useSection } from './shared';
import InsightsPanel from './InsightsPanel';
import { MixData } from './types';

type Part = { label: string, color: string, orders: number, customers: number, valueCents: number }

const doughnutOptions: any = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      rtl: true, textDirection: 'rtl', backgroundColor: INK, padding: 10, cornerRadius: 8, titleFont: { family: FONT }, bodyFont: { family: FONT },
      callbacks: { label: (ctx: any) => `${ctx.label}: ${Number(ctx.parsed).toLocaleString('en-US')} طلب` },
    },
  },
};

// A doughnut of order counts with its legend as a small table (name, orders, share, customers, value)
const Split = ({ parts }: { parts: Part[] }) => {
  const total = parts.reduce((s, p) => s + p.orders, 0);
  return (
    <div className="ca-split">
      <div className="ca-split__chart">
        {total ? (
          <Doughnut
            data={{ labels: parts.map((p) => p.label), datasets: [{ data: parts.map((p) => p.orders), backgroundColor: parts.map((p) => p.color), borderColor: '#ffffff', borderWidth: 2 }] }}
            options={doughnutOptions}
          />
        ) : null}
      </div>
      <ul className="ca-split__legend">
        {parts.map((p) => (
          <li key={p.label}>
            <span className="ca-swatch" style={{ background: p.color }} aria-hidden="true" />
            <strong>{p.label}</strong>
            <span><Num>{count(p.orders)}</Num> طلب · <Num>{pct(total ? p.orders / total : null)}</Num></span>
            <small><Num>{count(p.customers)}</Num> عميل · <Num>{usdWhole(p.valueCents)}</Num></small>
          </li>
        ))}
      </ul>
    </div>
  );
};

// مزيج الخدمات: purchases vs shipments, air vs sea, and who switched between air and sea
const MixSection = () => {
  const { filters, param, setParam } = useEnv();
  const view = param('view') === 'method' ? 'method' : 'kind';
  const { data, error, loading, retry } = useSection<MixData>('mix', filters);

  if (error) return <SectionError error={error} retry={retry} />;
  if (!data) return <Loading tiles={0} />;

  const k = data.byKind;
  const m = data.byMethod;
  const months = data.months || [];
  const t = data.transitions || { airFirst: 0, airThenSea: 0, seaFirst: 0, seaThenAir: 0 };
  const totalOrders = (k?.purchase?.orders || 0) + (k?.shipment?.orders || 0);
  const zero = { orders: 0, customers: 0, valueCents: 0 };

  const kindParts: Part[] = [
    { label: 'شراء', color: C1, ...(k?.purchase || zero) },
    { label: 'شحن فقط', color: C2, ...(k?.shipment || zero) },
  ];
  const methodParts: Part[] = [
    { label: 'جوي', color: C1, ...(m?.air || zero) },
    { label: 'بحري', color: C2, ...(m?.sea || zero) },
    ...((m?.unknown?.orders || 0) > 0 ? [{ label: 'غير محدد', color: NEUTRAL, ...m.unknown }] : []),
  ];

  const series = view === 'kind'
    ? [{ label: 'شراء', key: 'purchase' as const, color: C1 }, { label: 'شحن فقط', key: 'shipment' as const, color: C2 }]
    : [{ label: 'جوي', key: 'air' as const, color: C1 }, { label: 'بحري', key: 'sea' as const, color: C2 }];

  return (
    <div className={`ca-section${loading ? ' is-loading' : ''}`}>
      <PeriodLine period={data.period} extra={<> · <Num>{count(totalOrders)}</Num> طلب</>} />
      <InsightsPanel insights={data.insights} />
      {!totalOrders ? <Empty>لا توجد طلبات في هذه الفترة.</Empty> : (
        <>
          <div className="ca-grid">
            <Panel title="شراء أم شحن فقط" en="Purchase vs Shipping" sub={<><Num>{count(data.bothKinds)}</Num> عميل استعمل الخدمتين في هذه الفترة.</>}>
              <Split parts={kindParts} />
            </Panel>
            <Panel title="جوي أم بحري" en="Air vs Sea">
              <Split parts={methodParts} />
            </Panel>
          </div>

          <Panel
            title="الطلبات كل شهر"
            actions={<Segment label="التقسيم" value={view} options={[['kind', 'شراء / شحن'], ['method', 'جوي / بحري']]} onChange={(v) => setParam({ view: v === 'kind' ? null : v })} />}
          >
            <div className="ca-chart" dir="ltr">
              <Bar
                data={{
                  labels: months.map((x) => monthShort(x.month)),
                  datasets: series.map((s, i) => ({
                    label: s.label, data: months.map((x) => x[s.key]), backgroundColor: s.color, ...barStyle, ...(i === 0 ? { borderRadius: 0 } : {}),
                  })),
                }}
                options={baseOptions({ stacked: true })}
              />
            </div>
            {view === 'method' && <p className="ca-note">الطلبات التي لم تحدد طريقة شحنها لا تظهر في هذا الرسم.</p>}
            <ChartTable
              head={['الشهر', 'شراء', 'شحن فقط', 'جوي', 'بحري']}
              rows={months.map((x) => [monthName(x.month), <Num>{count(x.purchase)}</Num>, <Num>{count(x.shipment)}</Num>, <Num>{count(x.air)}</Num>, <Num>{count(x.sea)}</Num>])}
            />
          </Panel>
        </>
      )}

      <Panel title="من غيّر طريقة الشحن" en="Mode Switching" sub="منذ البداية، لا في الفترة فقط: طريقة أول طلب، ثم هل جرّب الأخرى لاحقاً.">
        <ul className="ca-sentences">
          <li>
            <Num>{count(t.airFirst)}</Num> عميل بدأ بالشحن <b>الجوي</b>، منهم <Num>{count(t.airThenSea)}</Num> جرّب <b>البحري</b> لاحقاً
            {t.airFirst ? <> (<Num>{pct(t.airThenSea / t.airFirst)}</Num>)</> : null}.
          </li>
          <li>
            <Num>{count(t.seaFirst)}</Num> عميل بدأ بالشحن <b>البحري</b>، منهم <Num>{count(t.seaThenAir)}</Num> جرّب <b>الجوي</b> لاحقاً
            {t.seaFirst ? <> (<Num>{pct(t.seaThenAir / t.seaFirst)}</Num>)</> : null}.
          </li>
        </ul>
      </Panel>
    </div>
  );
};

export default MixSection;
