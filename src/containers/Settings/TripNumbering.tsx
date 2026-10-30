import { Alert, CircularProgress } from '@mui/material';
import { ArrowLeft, Check, Hash, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api';
import './SettingsCommon.scss';
import './TripNumbering.scss';

type Option = { value: string; label: string };
type Rule = {
  _id: string; country: string; kind: string; enabled: boolean; format: 'number' | 'number-year';
  year: string; nameTemplate: string; nextNumber: number; highestNumber: number; version: number; voyage: string;
};
type Draft = Omit<Rule, 'nextNumber'> & { nextNumber: string };
const TOKEN = '{number}';
const messageOf = (error: any) => error?.response?.data?.message || 'Unable to load or save trip numbering. Please try again.';
const normalizeDigits = (value: string) => value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
const toDraft = (rule: Rule): Draft => ({ ...rule, nextNumber: String(rule.nextNumber) });

const TripNumbering = () => {
  const isAdmin = useSelector((state: any) => !!state.session.account?.roles?.isAdmin);
  const [countries, setCountries] = useState<Option[]>([]);
  const [kinds, setKinds] = useState<Option[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [country, setCountry] = useState('CN');
  const [kind, setKind] = useState('air');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const current = rules.find(rule => rule.country === country && rule.kind === kind);
  const dirty = !!draft && !!current && JSON.stringify(draft) !== JSON.stringify(toDraft(current));
  const namePreview = draft?.nameTemplate.replace(TOKEN,
    draft.format === 'number-year' ? `${normalizeDigits(draft.nextNumber) || '…'}-${normalizeDigits(draft.year) || '…'}` : normalizeDigits(draft.nextNumber) || '…');
  const nextExample = draft && Number.isSafeInteger(Number(normalizeDigits(draft.nextNumber)))
    ? draft.nameTemplate.replace(TOKEN, `${Number(normalizeDigits(draft.nextNumber)) + 1}${draft.format === 'number-year' ? `-${normalizeDigits(draft.year)}` : ''}`) : '';

  const load = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await api.get('trip-numbering');
      setCountries(response.data.countries);
      setKinds(response.data.kinds);
      setRules(response.data.rules);
    } catch (err) { setError(messageOf(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);
  useEffect(() => { setDraft(current ? toDraft(current) : null); }, [current]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const changeSelection = (nextCountry: string, nextKind: string) => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them and switch?')) return;
    setCountry(nextCountry); setKind(nextKind); setError(''); setNotice('');
  };
  const update = (change: Partial<Draft>) => { setDraft(value => value ? { ...value, ...change } : value); setError(''); setNotice(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await api.update(`trip-numbering/${country}/${kind}`, {
        enabled: draft.enabled, format: draft.format, year: normalizeDigits(draft.year), nameTemplate: draft.nameTemplate,
        nextNumber: normalizeDigits(draft.nextNumber), version: draft.version,
      });
      setRules(values => values.map(rule => rule._id === response.data._id ? response.data : rule));
      setNotice('Settings saved. They apply to new trips only.');
    } catch (err) { setError(messageOf(err)); }
    finally { setSaving(false); }
  };

  if (!isAdmin) return <Alert severity="error">This section is available to admins only.</Alert>;
  return (
    <div className="settings-page trip-numbering" dir="ltr" lang="en">
      <Link className="settings-page__back" to="/settings"><ArrowLeft size={15} /> Settings</Link>
      <header className="settings-page__header">
        <div className="settings-page__title"><div><h1>Trip numbering</h1><p>Set a name template and an automatic sequence for each country and shipping type.</p></div></div>
        <button type="button" className="settings-btn settings-btn--ghost" disabled={saving || loading} onClick={() => { if (!dirty || window.confirm('Refreshing will discard your unsaved changes. Continue?')) void load(); }}><RefreshCw size={14} /> Refresh</button>
      </header>
      {error && <Alert severity="error" className="trip-numbering__alert">{error}</Alert>}
      {notice && <Alert severity="success" className="trip-numbering__alert" role="status">{notice}</Alert>}
      {loading ? <div className="trip-numbering__loading" role="status"><CircularProgress size={21} /><span>Loading sequences and previous trips…</span></div> : draft ? (
        <section className="settings-panel">
          <div className="settings-panel__head">
            <label className="trip-numbering__country" htmlFor="numbering-country"><span>Shipping country</span><select id="numbering-country" value={country} disabled={saving} onChange={event => changeSelection(event.target.value, kind)}>{countries.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <span className="settings-panel__hint">One sequence per country and type, shared across destination offices.</span>
          </div>
          <div className="trip-numbering__layout">
            <nav className="trip-numbering__types" aria-label="Trip type">
              {kinds.map(item => {
                const saved = rules.find(rule => rule.country === country && rule.kind === item.value);
                return <button key={item.value} type="button" aria-pressed={kind === item.value} disabled={saving} onClick={() => changeSelection(country, item.value)}><span>{item.label}</span><small>{saved?.enabled ? `Next: ${saved.nextNumber}` : 'Manual naming'}</small></button>;
              })}
            </nav>
            <form className="trip-numbering__form" onSubmit={save}>
              <label className="trip-numbering__toggle"><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={event => update({ enabled: event.target.checked })} /><span><strong>Automatic numbering for this type</strong><small>When disabled, enter trip names manually. Previously issued numbers stay reserved.</small></span></label>
              <fieldset disabled={saving}>
                <legend>Number format</legend>
                <div className="trip-numbering__formats">
                  <label><input type="radio" name="number-format" checked={draft.format === 'number'} onChange={() => update({ format: 'number' })} /><span>Number only <small dir="ltr">20</small></span></label>
                  <label><input type="radio" name="number-format" checked={draft.format === 'number-year'} onChange={() => update({ format: 'number-year' })} /><span>Number and year <small dir="ltr">20-2026</small></span></label>
                </div>
              </fieldset>
              <div className="trip-numbering__grid">
                <label htmlFor="numbering-next"><span>Next trip number</span><input id="numbering-next" inputMode="numeric" pattern="[0-9٠-٩۰-۹]+" required maxLength={9} value={draft.nextNumber} disabled={saving} onChange={event => update({ nextNumber: event.target.value })} /><small>Highest matching number: <b>{current?.highestNumber || 'None'}</b></small></label>
                {draft.format === 'number-year' && <label htmlFor="numbering-year"><span>Year or period code</span><input id="numbering-year" inputMode="numeric" pattern="[0-9٠-٩۰-۹]+" required maxLength={12} value={draft.year} disabled={saving} onChange={event => update({ year: event.target.value })} /><small>Set this yourself. It does not change automatically each year.</small></label>}
              </div>
              <label className="trip-numbering__template" htmlFor="numbering-template"><span>Trip name template</span><input id="numbering-template" dir="auto" required maxLength={160} value={draft.nameTemplate} disabled={saving} onChange={event => update({ nameTemplate: event.target.value })} /><small>Include <b>{TOKEN}</b> exactly once. Example: Air shipment {TOKEN}</small></label>
              <div className="trip-numbering__preview" aria-live="polite"><span><Hash size={15} /> Next trip name</span><strong dir="auto">{namePreview}</strong><small>Then: <b dir="auto">{nextExample}</b></small></div>
              <p className="trip-numbering__note">A number is reserved only when a trip is successfully created. Matching names from the same template and period are checked to prevent duplicates. Existing trips keep their names. To start a new period, change the year and set its starting number before saving.</p>
              <footer><span className="settings-panel__hint">{dirty ? 'Unsaved changes' : 'Current settings or defaults'}</span><button type="submit" className="settings-btn settings-btn--primary" disabled={saving || !dirty}>{saving ? <CircularProgress size={15} color="inherit" /> : notice ? <Check size={15} /> : <Save size={15} />}{saving ? 'Saving…' : 'Save settings'}</button></footer>
            </form>
          </div>
        </section>
      ) : <p>Numbering settings could not be loaded. Select Refresh to try again.</p>}
    </div>
  );
};

export default TripNumbering;
