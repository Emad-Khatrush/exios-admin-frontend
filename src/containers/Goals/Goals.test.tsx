import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import api from '../../api';
import Goals from './Goals';
import { clearGoalsCache } from './useGoalsDashboard';
import EmployeeGoals from './EmployeeGoals';
import { buildInsights, countryRows, GoalScore, GoalsDashboard, historyStats, paceOf } from './goalsData';

jest.mock('../../api', () => ({ __esModule: true, default: { get: jest.fn(), update: jest.fn() } }));
const mockedApi = api as unknown as { get: jest.Mock, update: jest.Mock };
beforeEach(() => { clearGoalsCache(); mockedApi.get.mockReset(); });

const score = (target: number, actual: number, incentiveLYD = 0): GoalScore => ({
  target, actual, remaining: Math.max(0, target - actual), progress: target ? actual / target : null, incentiveLYD, hit: target > 0 && actual >= target,
});
const scores = (sales: GoalScore, rest = score(0, 0)) => ({ sales, air: rest, lcl: rest, fcl: rest });

const history = (n: number, make: (i: number) => GoalScore) => Array.from({ length: n }, (_, i) => ({
  key: `2026-0${(i % 9) + 1}-01`, label: `Week ${i + 1}`, from: `2026-0${(i % 9) + 1}-01`, to: `2026-0${(i % 9) + 1}-07`, isCurrent: i === n - 1,
  offices: { tripoli: scores(make(i)) }, totals: scores(make(i)),
}));

const dashboard = (extra: Partial<GoalsDashboard> = {}): GoalsDashboard => ({
  period: 'week', country: 'CN', countries: ['CN'],
  breakdown: {
    current: { tripoli: { CN: { sales: 3000, air: 0, lcl: 0, fcl: 0, orders: 3 }, other: { sales: 1000, air: 0, lcl: 0, fcl: 0, orders: 1 } }, benghazi: {} },
    previous: { tripoli: { CN: { sales: 2000, air: 0, lcl: 0, fcl: 0, orders: 2 }, other: { sales: 1250, air: 0, lcl: 0, fcl: 0, orders: 1 } }, benghazi: {} },
  },
  from: '2026-10-04', to: '2026-10-10', label: '4 - 10 Oct 2026', isCurrent: true, canGoNext: false,
  totalDays: 7, elapsedDays: 3, offices: [{ code: 'tripoli', name: 'tripoli' }, { code: 'benghazi', name: 'benghazi' }],
  board: { tripoli: scores(score(7000, 1000, 300)), benghazi: scores(score(3000, 3200, 150)) },
  totals: { ...scores(score(10000, 4200, 450)), sales: { ...score(10000, 4200, 450), earnedLYD: 150 } },
  history: history(4, (i) => score(1000, i % 2 ? 1200 : 500)),
  daily: [{ day: '2026-10-04', label: 'Sun 4', isFuture: false, offices: { tripoli: { sales: 1000, air: 0, lcl: 0, fcl: 0 }, benghazi: { sales: 3200, air: 0, lcl: 0, fcl: 0 } } }],
  leaderboard: [{ userId: 'u1', name: 'Salem Ali', office: 'tripoli', sales: 1000, orders: 2 }],
  ...extra,
});

describe('goal pace', () => {
  const running = { totalDays: 7, elapsedDays: 3, isCurrent: true };
  test('behind pace asks for the rest spread over the days left, today included', () => {
    const pace = paceOf(score(7000, 1000), running);
    expect(pace.status).toBe('behind');
    expect(pace.daysLeft).toBe(5);
    expect(pace.perDay).toBe(1200);
  });
  test('on pace, reached, missed, upcoming and no goal', () => {
    expect(paceOf(score(7000, 2600), running).status).toBe('onPace');
    expect(paceOf(score(7000, 7000), running).status).toBe('reached');
    expect(paceOf(score(7000, 10), { ...running, isCurrent: false, elapsedDays: 7 }).status).toBe('missed');
    expect(paceOf(score(7000, 0), { ...running, isCurrent: false, elapsedDays: 0 }).status).toBe('upcoming');
    expect(paceOf(score(0, 50), running).status).toBe('noGoal');
  });
});

test('history stats leave out the running period', () => {
  const stats = historyStats(history(4, (i) => score(1000, i % 2 ? 1200 : 500)), 'tripoli', 'sales');
  expect(stats).toMatchObject({ periods: 3, hits: 1, best: { label: 'Week 2', value: 1200 } });
  expect(stats.averageProgress).toBeCloseTo((0.5 + 1.2 + 0.5) / 3);
});

test('insights say what each office needs', () => {
  const notes = buildInsights(dashboard(), 'tripoli');
  const [fsi, pdi] = [String.fromCharCode(0x2068), String.fromCharCode(0x2069)];
  expect(notes).toContain(`مكتب طرابلس يحتاج ${fsi}$1,200${pdi} يومياً في المبيعات خلال 5 أيام متبقية لتحقيق هدف الأسبوع.`);
  expect(notes).toContain('تحقق هدف المبيعات في 1 من آخر 3 أسابيع.');
  expect(buildInsights(dashboard(), 'all')).toContain('مكتب طرابلس هو الأبعد عن هدف المبيعات، بنسبة 14%.');
});

test('the admin page shows the goals, switches office and saves new goals', async () => {
  mockedApi.get.mockImplementation((url: string) => Promise.resolve({
    data: url === 'goals'
      ? { offices: [{ code: 'tripoli', name: 'Tripoli' }], goals: [{ office: 'tripoli', country: 'CN', metric: 'sales', period: 'week', target: 7000, incentiveLYD: 300 }] }
      : dashboard(),
  }));
  mockedApi.update.mockResolvedValue({ data: {} });
  render(<Goals />);

  expect(await screen.findByRole('heading', { name: '4 - 10 أكتوبر 2026' })).toBeInTheDocument();
  expect(screen.getByText('$4,200')).toBeInTheDocument();
  expect(screen.getByText('تم كسب 150 د.ل من 450 د.ل')).toBeInTheDocument();
  expect(screen.getByText('Salem Ali')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'طرابلس' }));
  expect(screen.getAllByText('$1,000').length).toBeGreaterThan(0);

  fireEvent.click(screen.getAllByRole('button', { name: /تحديد الأهداف/ })[0]);
  const target = await screen.findByLabelText(/^المبيعات/, { selector: 'input' });
  await waitFor(() => expect((target as HTMLInputElement).value).toBe('7000'));
  fireEvent.change(target, { target: { value: '8000' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات (1)' }));
  await waitFor(() => expect(mockedApi.update).toHaveBeenCalledWith('goals', { goals: [{ office: 'tripoli', country: 'CN', metric: 'sales', period: 'week', target: 8000, incentiveLYD: 300 }] }));
});

test('the employee home shows their own sales and their office first', async () => {
  mockedApi.get.mockResolvedValue({ data: dashboard({ leaderboard: undefined, me: { office: 'tripoli', sales: 640, orders: 3, air: 12, lcl: 1.5, shareOfOffice: 0.64 } }) });
  const store = createStore(() => ({ session: { account: { firstName: 'Huda', city: 'tripoli' } } }));
  render(<Provider store={store}><EmployeeGoals /></Provider>);

  expect(await screen.findByText('مرحباً Huda')).toBeInTheDocument();
  expect(screen.getByText('$640')).toBeInTheDocument();
  expect(screen.getByText(/3 فواتير، 64% من مبيعات مكتب طرابلس/)).toBeInTheDocument();
  expect(screen.queryByText('المكاتب الأخرى')).not.toBeInTheDocument();
  expect(screen.queryByText('بنغازي')).not.toBeInTheDocument();
  expect(screen.queryByText('الأعلى مبيعاً')).not.toBeInTheDocument();
});

test('the share of China is shown against the other countries, with no country filter', async () => {
  const rows = countryRows(dashboard(), 'tripoli', 'sales');
  expect(rows.map((row) => row.country)).toEqual(['CN', 'other']);
  expect(rows[0]).toMatchObject({ value: 3000, share: 0.75, previous: 2000, change: 0.5 });
  expect(rows[1].change).toBeCloseTo(-0.2);
  expect(buildInsights(dashboard(), 'tripoli')[0]).toBe('الصين تمثل 75% من المبيعات في هذا الأسبوع، بزيادة 50% عن الأسبوع السابق.');

  mockedApi.get.mockReset();
  mockedApi.get.mockResolvedValue({ data: dashboard() });
  render(<Goals />);
  await screen.findByText('حصة الصين');
  expect(mockedApi.get).toHaveBeenCalledWith('goals/dashboard', { period: 'week' });
  expect(screen.queryByRole('button', { name: 'كل الدول' })).not.toBeInTheDocument();
  expect(screen.getByText('دول أخرى')).toBeInTheDocument();
});

test('switching weekly and monthly shows the copy already loaded, and the other view is loaded ahead', async () => {
  mockedApi.get.mockImplementation((url: string, params: any) => Promise.resolve({ data: { ...dashboard(), period: params.period, ...(params.period === 'month' ? { from: '2026-10-01', to: '2026-10-31' } : {}) } }));
  render(<Goals />);
  await screen.findByRole('heading', { name: '4 - 10 أكتوبر 2026' });
  // The monthly view was fetched in the background after the weekly one
  await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('goals/dashboard', { period: 'month' }));
  const calls = mockedApi.get.mock.calls.length;

  fireEvent.click(screen.getByRole('tab', { name: 'شهري' }));
  expect(await screen.findByRole('heading', { name: 'أكتوبر 2026' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'أسبوعي' }));
  expect(await screen.findByRole('heading', { name: '4 - 10 أكتوبر 2026' })).toBeInTheDocument();
  expect(mockedApi.get.mock.calls.length).toBe(calls);
});
