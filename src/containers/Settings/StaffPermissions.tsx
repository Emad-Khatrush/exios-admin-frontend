import { Alert } from '@mui/material';
import {
  ArrowRight, Banknote, Briefcase, Calculator, Check, ChevronDown, Crown, Handshake, Keyboard, Lock, PackageOpen,
  ReceiptText, RefreshCw, Save, Search, ShieldCheck, TrendingUp, Undo2, Wallet, Warehouse, X,
} from 'lucide-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { canOpen, MENU_PAGES } from '../../constants/staffPermissions';
import { forgetStaffAccess, useStaffAccess } from '../../utils/useStaffAccess';
import { forgetAccountingAccess } from '../Accounting/useAccountingAccess';
import './SettingsCommon.scss';
import './StaffPermissions.scss';

type Permission = { key: string, label: string, hint: string };
type Group = { key: string, label: string, permissions: Permission[] };
type StaffType = { key: string, label: string, permissions: string[] };
type Preset = { key: string, label: string, permissions: string[] };
type Member = {
  _id: string, firstName: string, lastName: string, username: string, imgUrl?: string,
  role: 'admin' | 'accountant' | 'employee', isOwner: boolean, isAdmin: boolean,
  lockedReason: 'owner' | 'self' | null, configured: boolean, kind: string | null,
  permissions: string[], accounting: string[],
  updatedAt: string | null, updatedBy: { firstName: string, lastName: string } | null,
};
type Draft = { isAdmin: boolean, kind: string, permissions: string[], accountingOn: boolean, accounting: string[] };

const TYPE_ICONS: Record<string, ReactNode> = {
  data_entry: <Keyboard size={18} />,
  accountant: <Calculator size={18} />,
  cashier: <Banknote size={18} />,
  sales: <Handshake size={18} />,
  warehouse: <PackageOpen size={18} />,
};
const TYPE_HINTS: Record<string, string> = {
  data_entry: 'الفواتير وأرقام التتبع',
  accountant: 'الدفعات والديون والتقارير',
  cashier: 'الصندوق والمحافظ والتسليم',
  sales: 'العملاء والتسويق والأسعار',
  warehouse: 'الرحلات والمخزن والتسليم',
};
const GROUP_ICONS: Record<string, ReactNode> = {
  orders: <ReceiptText size={17} />,
  money: <Wallet size={17} />,
  warehouse: <Warehouse size={17} />,
  sales: <TrendingUp size={17} />,
  management: <Briefcase size={17} />,
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((key) => b.includes(key));
const toggleIn = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
const messageOf = (error: any) => {
  const message = error?.response?.data?.message || error?.data?.message;
  if (message === 'permission-denied') return 'هذه الصفحة للمدراء والمالك فقط.';
  return message || 'تعذر الاتصال بالخادم. حاول مرة أخرى.';
};
const fullName = (m: Member) => `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.username;
const initials = (m: Member) => `${m.firstName?.[0] || ''}${m.lastName?.[0] || ''}`.toUpperCase() || '?';
// A steady muted tint per person, so faces are easy to tell apart in the list
const hueOf = (text: string) => Array.from(text).reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 360, 7);
const draftOf = (m: Member): Draft => ({
  isAdmin: m.isAdmin,
  kind: m.isAdmin ? '' : (m.kind || ''),
  permissions: m.configured ? m.permissions : [],
  accountingOn: m.accounting.length > 0,
  accounting: m.accounting,
});
// The menu pages a draft gives, plus accounting
const pagesOf = (d: Draft) => {
  const pages = d.isAdmin ? MENU_PAGES.map((p) => p.label) : MENU_PAGES.filter((p) => canOpen(p.path, d.permissions)).map((p) => p.label);
  if (d.accountingOn && d.accounting.length) pages.push('المحاسبة');
  return pages;
};

const Avatar = ({ member, large }: { member: Member, large?: boolean }) => (
  <span className={`sp-avatar${large ? ' sp-avatar--lg' : ''}`} style={{ ['--hue' as any]: hueOf(member.username || member._id) }} aria-hidden>
    {member.imgUrl ? <img src={member.imgUrl} alt="" /> : initials(member)}
  </span>
);

const Switch = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label: string }) => (
  <span className="sp-switch">
    <input type="checkbox" role="switch" checked={checked} onChange={onChange} aria-label={label} />
    <span className="sp-switch__track" aria-hidden><span className="sp-switch__thumb" /></span>
  </span>
);

// Settings > Permissions: what every staff member can open. Owners are fixed, admins have the whole
// system (only their accounting is set here), everyone else gets a type of work and its permissions.
const StaffPermissions = () => {
  const access = useStaffAccess();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [types, setTypes] = useState<StaffType[]>([]);
  const [accPermissions, setAccPermissions] = useState<Permission[]>([]);
  const [accPresets, setAccPresets] = useState<Preset[]>([]);
  // Only an owner moves someone between admin and employee (the API checks it too)
  const [canChangeRole, setCanChangeRole] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editorRef = useRef<HTMLElement>(null);

  const load = async (keepSelection?: string | null) => {
    setLoading(true); setError('');
    try {
      const res = await api.get('staff-access/members');
      const list: Member[] = res.data.results;
      setMembers(list);
      setGroups(res.data.groups);
      setTypes(res.data.types);
      setAccPermissions(res.data.accounting.permissions);
      setAccPresets(res.data.accounting.presets);
      setCanChangeRole(!!res.data.viewer?.canChangeRole);
      const next = list.find((m) => m._id === keepSelection) || list.find((m) => !m.lockedReason && !m.isAdmin) || list[0];
      setSelectedId(next?._id || null);
      setDraft(next ? draftOf(next) : null);
    } catch (err) {
      setError(messageOf(err));
    }
    setLoading(false);
  };

  useEffect(() => { if (access.canManage) void load(); }, [access.canManage]);

  const selected = members?.find((m) => m._id === selectedId) || null;
  const allKeys = useMemo(() => groups.flatMap((g) => g.permissions.map((p) => p.key)), [groups]);
  const typeLabel = (key: string | null) => types.find((t) => t.key === key)?.label;

  const dirty = !!selected && !!draft && !selected.lockedReason && (() => {
    const saved = draftOf(selected);
    const accountingNow = draft.accountingOn ? draft.accounting : [];
    if (!sameSet(accountingNow, saved.accounting)) return true;
    if (draft.isAdmin !== saved.isAdmin) return true;
    if (draft.isAdmin) return false;
    return draft.kind !== saved.kind || !sameSet(draft.permissions, saved.permissions);
  })();

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const select = (member: Member) => {
    if (member._id === selectedId) return;
    if (dirty && !window.confirm('لديك تعديلات لم تُحفظ. تجاهلها والانتقال؟')) return;
    setSelectedId(member._id);
    setDraft(draftOf(member));
    setError(''); setNotice('');
    // On a phone the editor is under the list: bring it into view
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const update = (change: Partial<Draft>) => { setDraft((d) => (d ? { ...d, ...change } : d)); setNotice(''); setError(''); };

  const chooseType = (type: StaffType) => {
    if (!draft || draft.kind === type.key) return;
    update({ kind: type.key, permissions: type.permissions });
  };

  const save = async () => {
    if (!selected || !draft || saving) return;
    if (!draft.isAdmin && !draft.kind) { setError('اختر نوع العمل أولاً.'); return; }
    if (draft.accountingOn && draft.accounting.length === 0) { setError('اختر قسماً واحداً على الأقل من المحاسبة، أو أوقف المحاسبة.'); return; }
    const demoting = selected.isAdmin && !draft.isAdmin;
    const promoting = !selected.isAdmin && draft.isAdmin;
    if (demoting && !window.confirm(`${fullName(selected)} سيصبح موظفاً ولن يرى إلا الصلاحيات المحددة له. متابعة؟`)) return;
    if (promoting && !window.confirm(`${fullName(selected)} سيصبح مديراً ويرى كل صفحات النظام. متابعة؟`)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const body: any = { accounting: draft.accountingOn ? draft.accounting : [] };
      if (draft.isAdmin !== selected.isAdmin) body.role = draft.isAdmin ? 'admin' : 'staff';
      if (!draft.isAdmin) { body.kind = draft.kind; body.permissions = draft.permissions; }
      await api.update(`staff-access/members/${selected._id}`, body);
      forgetStaffAccess();
      forgetAccountingAccess();
      await load(selected._id);
      setNotice(`حُفظت صلاحيات ${fullName(selected)}. تُطبق من الصفحة التالية التي يفتحها.`);
    } catch (err) {
      setError(messageOf(err));
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members || []).filter((m) => !q || `${fullName(m)} ${m.username}`.toLowerCase().includes(q));
  }, [members, query]);

  // What the person will find in their menu, against what they have now
  const preview = useMemo(() => {
    if (!selected || !draft) return null;
    const now = pagesOf(draftOf(selected));
    const next = pagesOf(draft);
    return {
      kept: next.filter((p) => now.includes(p)),
      added: next.filter((p) => !now.includes(p)),
      removed: now.filter((p) => !next.includes(p)),
      total: next.length,
    };
  }, [selected, draft]);

  if (!access.loading && !access.canManage) {
    return <div className="settings-page" dir="rtl"><Alert severity="error">هذه الصفحة للمدراء والمالك فقط.</Alert></div>;
  }

  const sections: { title: string, list: Member[] }[] = [
    { title: 'المالك', list: filtered.filter((m) => m.isOwner) },
    { title: 'المدراء', list: filtered.filter((m) => !m.isOwner && m.isAdmin) },
    { title: 'الموظفون', list: filtered.filter((m) => !m.isOwner && !m.isAdmin) },
  ];

  const tagOf = (m: Member) => {
    if (m.isOwner) return <span className="sp-tag sp-tag--owner"><Crown size={11} aria-hidden /> المالك</span>;
    if (m.isAdmin) return <span className="sp-tag sp-tag--admin">مدير</span>;
    if (!m.configured) return <span className="sp-tag sp-tag--warn">لم تُحدد</span>;
    return <span className="sp-tag">{typeLabel(m.kind) || m.kind}</span>;
  };

  const lastEdit = selected?.updatedAt
    ? `آخر تعديل ${new Date(selected.updatedAt).toLocaleDateString('ar-LY', { day: 'numeric', month: 'long' })}${selected.updatedBy ? ` · ${selected.updatedBy.firstName} ${selected.updatedBy.lastName}` : ''}`
    : null;

  return (
    <div className="settings-page sp" dir="rtl" lang="ar">
      <Link className="settings-page__back" to="/settings"><ArrowRight size={15} /> الإعدادات</Link>
      <header className="sp-header">
        <div>
          <h1>الصلاحيات</h1>
          <p>حدد دور كل شخص ونوع عمله وما يستطيع فتحه. المالك له كل شيء دائماً، والمدير يرى كل النظام وتُحدد له المحاسبة فقط.</p>
        </div>
        <button type="button" className="sp-btn sp-btn--quiet" disabled={loading || saving}
          onClick={() => { if (!dirty || window.confirm('التحديث سيتجاهل تعديلاتك غير المحفوظة. متابعة؟')) void load(selectedId); }}>
          <RefreshCw size={15} className={loading && members ? 'sp-spin' : ''} /> تحديث
        </button>
      </header>

      {error && <Alert severity="error" className="sp-alert" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" className="sp-alert" role="status" onClose={() => setNotice('')}>{notice}</Alert>}

      <div className="sp-layout">
        {/* ---- People */}
        <aside className="sp-people" aria-label="الموظفون">
          <label className="sp-search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="ابحث بالاسم" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="ابحث عن موظف" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={14} /></button>}
          </label>

          {!members ? (
            <div className="sp-people__skeleton" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <span key={i} className="sp-skel sp-skel--row" style={{ animationDelay: `${i * 90}ms` }} />)}
            </div>
          ) : (
            <>
              {sections.filter((s) => s.list.length).map((section) => (
                <section key={section.title} className="sp-people__section">
                  <h2>{section.title}<span>{section.list.length}</span></h2>
                  <ul>
                    {section.list.map((m) => (
                      <li key={m._id}>
                        <button type="button" className="sp-person" aria-pressed={m._id === selectedId} onClick={() => select(m)}>
                          <Avatar member={m} />
                          <span className="sp-person__who">
                            <strong>{fullName(m)}</strong>
                            <small dir="ltr">{m.username}</small>
                          </span>
                          {tagOf(m)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!filtered.length && <p className="sp-empty">لا يوجد أحد بهذا الاسم.</p>}
            </>
          )}
        </aside>

        {/* ---- Editor */}
        <section className="sp-editor" ref={editorRef} aria-live="polite">
          {!members ? (
            <div className="sp-card sp-editor__skeleton" aria-hidden>
              <span className="sp-skel sp-skel--head" />
              <span className="sp-skel sp-skel--block" />
              <span className="sp-skel sp-skel--block" style={{ animationDelay: '120ms' }} />
            </div>
          ) : !selected || !draft ? (
            <div className="sp-card sp-empty">اختر شخصاً من القائمة لترى صلاحياته.</div>
          ) : (
            <div key={selected._id} className="sp-editor__inner">
              {/* Who */}
              <div className="sp-card sp-who">
                <Avatar member={selected} large />
                <div className="sp-who__text">
                  <h2>{fullName(selected)}</h2>
                  <p><span dir="ltr">{selected.username}</span>{lastEdit && <> · {lastEdit}</>}</p>
                </div>
                {tagOf(selected)}
              </div>

              {selected.lockedReason ? (
                <div className="sp-card sp-locked">
                  <span className="sp-locked__icon">{selected.lockedReason === 'owner' ? <Crown size={22} /> : <Lock size={22} />}</span>
                  <div>
                    <strong>{selected.lockedReason === 'owner' ? 'صلاحيات المالك كاملة دائماً' : 'لا يمكنك تعديل صلاحياتك بنفسك'}</strong>
                    <p>{selected.lockedReason === 'owner'
                      ? 'هذا الحساب يملك كل النظام والمحاسبة، ولا يستطيع أي مدير أو موظف تغيير ذلك.'
                      : 'يعدّلها لك مدير آخر أو المالك.'}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* What they will see */}
                  {preview && (
                    <div className="sp-card sp-preview">
                      <div className="sp-preview__head">
                        <h3>ما سيظهر له في القائمة</h3>
                        <span>{preview.total} {preview.total === 1 ? 'صفحة' : 'صفحات'}</span>
                      </div>
                      {preview.total === 0 && !preview.removed.length ? (
                        <p className="sp-preview__none">لن يرى إلا الصفحة الرئيسية. اختر نوع عمله أو صلاحياته.</p>
                      ) : (
                        <ul className="sp-preview__chips">
                          {preview.added.map((p) => <li key={`a-${p}`} className="is-added"><span aria-hidden>+</span>{p}</li>)}
                          {preview.kept.map((p) => <li key={`k-${p}`}>{p}</li>)}
                          {preview.removed.map((p) => <li key={`r-${p}`} className="is-removed"><span className="sp-sr">ستُزال: </span>{p}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Role (owner only) */}
                  {canChangeRole && (
                    <div className="sp-card sp-row">
                      <div className="sp-row__text">
                        <h3>الدور</h3>
                        <p>المدير يرى كل النظام. الموظف يرى ما تحدده له فقط.</p>
                      </div>
                      <div className="sp-segment" role="radiogroup" aria-label="الدور" data-value={draft.isAdmin ? 'admin' : 'staff'}>
                        <span className="sp-segment__thumb" aria-hidden />
                        <button type="button" role="radio" aria-checked={!draft.isAdmin} onClick={() => update({ isAdmin: false })}>موظف</button>
                        <button type="button" role="radio" aria-checked={draft.isAdmin} onClick={() => update({ isAdmin: true })}>مدير</button>
                      </div>
                    </div>
                  )}

                  {draft.isAdmin ? (
                    <p className="sp-note">المدير يرى كل صفحات النظام دائماً. ما يمكن تحديده له هنا هو المحاسبة فقط.</p>
                  ) : (
                    <>
                      {selected.isAdmin && <p className="sp-note sp-note--warn">سيتحول هذا المدير إلى موظف عند الحفظ. اختر نوع عمله وصلاحياته.</p>}
                      {!selected.isAdmin && !selected.configured && (
                        <p className="sp-note sp-note--warn">لم تُحدد صلاحياته بعد، فهو يرى الآن ما كان يعطيه دوره القديم. اختر نوع عمله ثم احفظ.</p>
                      )}

                      {/* Type */}
                      <section className="sp-card">
                        <div className="sp-card__head">
                          <div>
                            <h3>نوع العمل</h3>
                            <p>يضع الصلاحيات الأساسية للنوع، ثم تزيد أو تنقص منها.</p>
                          </div>
                        </div>
                        <div className="sp-types" role="radiogroup" aria-label="نوع العمل">
                          {types.map((type) => (
                            <button key={type.key} type="button" role="radio" aria-checked={draft.kind === type.key} className="sp-type" onClick={() => chooseType(type)}>
                              <span className="sp-type__icon">{TYPE_ICONS[type.key] || <Briefcase size={18} />}</span>
                              <span className="sp-type__label">{type.label}</span>
                              <span className="sp-type__hint">{TYPE_HINTS[type.key] || `${type.permissions.length} صلاحيات`}</span>
                              <span className="sp-type__check" aria-hidden><Check size={12} strokeWidth={3} /></span>
                            </button>
                          ))}
                        </div>
                      </section>

                      {/* Permissions */}
                      <section className="sp-card sp-perms">
                        <div className="sp-card__head">
                          <div>
                            <h3>الصلاحيات</h3>
                            <p><b>{draft.permissions.length}</b> من {allKeys.length} مفعّلة</p>
                          </div>
                          <div className="sp-card__actions">
                            {draft.kind && (
                              <button type="button" className="sp-link"
                                disabled={sameSet(draft.permissions, types.find((t) => t.key === draft.kind)?.permissions || [])}
                                onClick={() => update({ permissions: types.find((t) => t.key === draft.kind)?.permissions || [] })}>
                                <Undo2 size={13} /> صلاحيات النوع
                              </button>
                            )}
                            <button type="button" className="sp-link" disabled={draft.permissions.length === allKeys.length} onClick={() => update({ permissions: allKeys })}>كاملة</button>
                            <button type="button" className="sp-link sp-link--danger" disabled={!draft.permissions.length} onClick={() => update({ permissions: [] })}>إزالة الكل</button>
                          </div>
                        </div>

                        {groups.map((group, index) => {
                          const keys = group.permissions.map((p) => p.key);
                          const on = keys.filter((k) => draft.permissions.includes(k)).length;
                          const open = !closed.includes(group.key);
                          return (
                            <div key={group.key} className={`sp-group${open ? ' is-open' : ''}`} style={{ ['--i' as any]: index }}>
                              <div className="sp-group__head">
                                <button type="button" className="sp-group__toggle" aria-expanded={open} onClick={() => setClosed(toggleIn(closed, group.key))}>
                                  <span className="sp-group__icon">{GROUP_ICONS[group.key] || <Briefcase size={17} />}</span>
                                  <span className="sp-group__label">{group.label}</span>
                                  <span className="sp-group__meter" aria-hidden><span style={{ transform: `scaleX(${keys.length ? on / keys.length : 0})` }} /></span>
                                  <span className="sp-group__count">{on}/{keys.length}</span>
                                  <ChevronDown size={16} className="sp-group__chevron" aria-hidden />
                                </button>
                                <Switch
                                  checked={on === keys.length}
                                  label={`كل صلاحيات ${group.label}`}
                                  onChange={() => update({ permissions: on === keys.length ? draft.permissions.filter((k) => !keys.includes(k)) : Array.from(new Set(draft.permissions.concat(keys))) })}
                                />
                              </div>
                              <div className="sp-group__body">
                                <div className="sp-group__inner">
                                  {group.permissions.map((p) => {
                                    const checked = draft.permissions.includes(p.key);
                                    return (
                                      <label key={p.key} className={`sp-item${checked ? ' is-on' : ''}`}>
                                        <span className="sp-item__text"><strong>{p.label}</strong><small>{p.hint}</small></span>
                                        <Switch checked={checked} label={p.label} onChange={() => update({ permissions: toggleIn(draft.permissions, p.key) })} />
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    </>
                  )}

                  {/* Accounting */}
                  <section className={`sp-card sp-accounting${draft.accountingOn ? ' is-on' : ''}`}>
                    <div className="sp-card__head">
                      <div className="sp-accounting__title">
                        <span className="sp-group__icon"><Calculator size={17} /></span>
                        <div>
                          <h3>المحاسبة</h3>
                          <p>{draft.accountingOn ? `يرى ${draft.accounting.length} من ${accPermissions.length} أقسام فقط.` : 'قسم المحاسبة لا يظهر له أبداً.'}</p>
                        </div>
                      </div>
                      <Switch checked={draft.accountingOn} label="تفعيل المحاسبة"
                        onChange={() => update({ accountingOn: !draft.accountingOn, accounting: draft.accountingOn ? [] : draft.accounting })} />
                    </div>
                    <div className="sp-group__body">
                      <div className="sp-group__inner sp-accounting__inner">
                        <div className="sp-presets">
                          <span>جاهزة</span>
                          {accPresets.map((preset) => (
                            <button key={preset.key} type="button" aria-pressed={sameSet(draft.accounting, preset.permissions)} onClick={() => update({ accounting: preset.permissions })}>
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div className="sp-accounting__list">
                          {accPermissions.map((p) => {
                            const checked = draft.accounting.includes(p.key);
                            return (
                              <label key={p.key} className={`sp-item${checked ? ' is-on' : ''}`}>
                                <span className="sp-item__text"><strong>{p.label}</strong><small>{p.hint}</small></span>
                                <Switch checked={checked} label={p.label} onChange={() => update({ accounting: toggleIn(draft.accounting, p.key) })} />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* Save: appears only when there is something to save */}
              {!selected.lockedReason && (
                <div className={`sp-savebar${dirty ? ' is-visible' : ''}`} aria-hidden={!dirty}>
                  <span><ShieldCheck size={16} aria-hidden /> تعديلات على {fullName(selected)} لم تُحفظ</span>
                  <div>
                    <button type="button" className="sp-btn sp-btn--quiet" tabIndex={dirty ? 0 : -1} disabled={saving} onClick={() => setDraft(draftOf(selected))}>تراجع</button>
                    <button type="button" className="sp-btn sp-btn--primary" tabIndex={dirty ? 0 : -1} disabled={saving} onClick={save}>
                      {saving ? <RefreshCw size={15} className="sp-spin" /> : <Save size={15} />} حفظ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StaffPermissions;
