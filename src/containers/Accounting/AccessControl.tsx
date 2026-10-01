import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Checkbox, FormControlLabel } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { forgetAccountingAccess, useAccountingAccess } from './useAccountingAccess';
import { Badge, Notice, PageHeader, Panel, Sub } from './ui';

type Permission = { key: string, label: string, hint: string };
type Preset = { key: string, label: string, permissions: string[] };

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((key) => b.includes(key));

// The owner's screen: every admin and accountant, and what each may do in accounting. The owner
// accounts always have everything; everyone else has only what is ticked here.
const AccessControl = () => {
  const access = useAccountingAccess();
  const [members, setMembers] = useState<any[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  // Unsaved choices, by user
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await acc.get('access/members');
      setMembers(res.data.results);
      setPermissions(res.data.permissions);
      setPresets(res.data.presets);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };
  useEffect(() => { if (access.isOwner) load(); }, [access.isOwner]);

  const current = (member: any) => drafts[member._id] ?? member.permissions;
  const setFor = (member: any, next: string[]) => setDrafts({ ...drafts, [member._id]: next });
  const toggle = (member: any, key: string) => {
    const list = current(member);
    setFor(member, list.includes(key) ? list.filter((k: string) => k !== key) : [...list, key]);
  };

  const save = async (member: any) => {
    setSaving(member._id);
    setMessage(null);
    try {
      await acc.put(`access/members/${member._id}`, { permissions: current(member) });
      const { [member._id]: _saved, ...rest } = drafts;
      setDrafts(rest);
      forgetAccountingAccess();
      await load();
      setMessage({ type: 'success', text: `حُفظت صلاحيات ${member.firstName} ${member.lastName}.` });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
    setSaving(null);
  };

  const others = useMemo(() => (members || []).filter((m) => !m.isOwner), [members]);
  const owners = useMemo(() => (members || []).filter((m) => m.isOwner), [members]);

  if (!access.loading && !access.isOwner) {
    return <div className="acc-empty"><h3>للمالك فقط</h3><p>الصلاحيات يديرها حسابا المالك فقط.</p></div>;
  }

  return (
    <>
      <PageHeader
        title="الصلاحيات"
        subtitle="حسابا المالك لهما كل شيء دائماً. أي مدير أو محاسب آخر يرى في المحاسبة ما تختاره له هنا فقط، وبدون أي صلاحية لا يرى قسم المحاسبة أصلاً."
      />
      <Notice message={message} onClose={() => setMessage(null)} />

      {owners.length > 0 && (
        <Panel title="حسابات المالك">
          <div className="acc-access__owners">
            {owners.map((owner) => (
              <div key={owner._id} className="acc-access__person">
                <Avatar src={owner.imgUrl} alt={owner.firstName} sx={{ width: 32, height: 32 }} />
                <div><strong>{owner.firstName} {owner.lastName}</strong><Sub>{owner.username}</Sub></div>
                <Badge tone="accent">كل الصلاحيات</Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {members && !others.length && (
        <Panel><p className="acc-sub">لا يوجد مدير أو محاسب آخر. أعطِ الحساب دور مدير أو محاسب من صفحة المستخدم أولاً، ثم يظهر هنا.</p></Panel>
      )}

      {others.map((member) => {
        const list: string[] = current(member);
        const changed = !sameSet(list, member.permissions);
        return (
          <Panel
            key={member._id}
            title={(
              <span className="acc-access__person">
                <Avatar src={member.imgUrl} alt={member.firstName} sx={{ width: 32, height: 32 }} />
                <span>{member.firstName} {member.lastName}</span>
                <Badge tone={member.role === 'admin' ? 'info' : 'muted'}>{member.role === 'admin' ? 'مدير' : 'محاسب'}</Badge>
                {list.length === 0 ? <Badge tone="danger">بلا صلاحية</Badge> : list.length === permissions.length ? <Badge tone="ok">كاملة</Badge> : <Badge tone="warn">{list.length} من {permissions.length}</Badge>}
              </span>
            )}
            subtitle={member.username}
            actions={<Button variant="contained" size="small" onClick={() => save(member)} disabled={!changed || saving === member._id}>{saving === member._id ? 'جارٍ الحفظ…' : 'حفظ'}</Button>}
          >
            <div className="acc-access__presets">
              <span className="acc-sub">جاهزة:</span>
              {presets.map((preset) => (
                <Button key={preset.key} size="small" variant={sameSet(list, preset.permissions) ? 'contained' : 'outlined'} onClick={() => setFor(member, preset.permissions)}>
                  {preset.label}
                </Button>
              ))}
              <Button size="small" color="error" onClick={() => setFor(member, [])} disabled={!list.length}>إزالة الكل</Button>
            </div>
            <div className="acc-access__grid">
              {permissions.map((permission) => (
                <FormControlLabel
                  key={permission.key}
                  className={`acc-access__item${list.includes(permission.key) ? ' is-on' : ''}`}
                  control={<Checkbox size="small" checked={list.includes(permission.key)} onChange={() => toggle(member, permission.key)} />}
                  label={<span><strong>{permission.label}</strong><Sub>{permission.hint}</Sub></span>}
                />
              ))}
            </div>
            {changed && <p className="acc-sub mt-2">تعديلات لم تُحفظ.</p>}
          </Panel>
        );
      })}
    </>
  );
};

export default AccessControl;
