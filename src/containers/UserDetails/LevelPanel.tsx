import { ReactNode, useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { MdCheckCircle, MdExpandMore, MdHistory, MdShield, MdStars, MdTrendingUp, MdWarningAmber } from 'react-icons/md';
import api from '../../api';
import { requestError } from '../Loyalty/PaymentPoints';
import { fullDate, pointsText } from '../Loyalty/format';
import { Num, useDialogMotion } from '../Loyalty/LoyaltyRtl';
import { LevelBadge, Tier, WHY, tierOf, timesText, useTiers } from '../Loyalty/levels';
import LevelEmblem from '../Loyalty/LevelEmblem';

// The customer's level as staff see it (GET user/:id/loyalty → level)
export type StaffLevel = {
  level: string, name: string, rank: number, color: string, multiplier: number, perks: string[],
  since: string | null, reviewAt: string | null, points: number,
  next: { key: string, name: string, min: number, remaining: number } | null,
  // The points that keep the level at the yearly review (70% of what it needs); null at the first level
  keep?: { min: number, remaining: number } | null,
  review: { at: string, keeps: boolean, needed: number } | null,
  manual: { reason: string, at: string, by: string } | null,
  history?: { from: string, to: string, at: string, why: string, reason?: string, by?: string }[],
};

type Props = {
  userId: string
  level: StaffLevel
  // «تغيير مستوى العميل» in Settings > Permissions: without it the button is not shown
  canChange?: boolean
  // After a change: the points tab reads everything again
  onChanged: () => void
}

// A section of the card that opens in place (the perks, the level's history)
const Disclosure = ({ icon, title, count, children }: { icon: ReactNode, title: string, count: number, children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lv-disclose${open ? ' is-open' : ''}`}>
      <button type="button" className="lv-disclose__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="lv-disclose__icon" aria-hidden="true">{icon}</span>
        <span className="lv-disclose__title">{title}</span>
        <span className="lv-disclose__count"><Num>{count}</Num></span>
        <MdExpandMore className="lv-disclose__chev" aria-hidden="true" />
      </button>
      {open && <div className="lv-disclose__body">{children}</div>}
    </div>
  );
};

// The level card: the stamp and the level, the way to the next level (stamp to stamp), whether the
// level is kept at the yearly review (70% of its points), and the perks staff apply
const LevelPanel = ({ userId, level, canChange = false, onChanged }: Props) => {
  const tiers = useTiers();
  const [changing, setChanging] = useState(false);
  const start = tiers[level.rank]?.min ?? 0;
  const share = level.next ? Math.min(1, Math.max(0, (level.points - start) / Math.max(level.next.min - start, 1))) : 1;
  const nextTier = level.next ? tierOf(tiers, level.next.key) : undefined;
  const history = level.history || [];
  const keep = level.keep;
  const kept = !!keep && keep.remaining === 0;

  return (
    <section className="lv-card" style={{ ['--lv' as any]: level.color, ['--nx' as any]: nextTier?.color || level.color }} aria-label="مستوى العميل">
      <header className="lv-card__head">
        <LevelEmblem levelKey={level.level} rank={level.rank} size={76} className="lv-card__stamp" />
        <div className="lv-card__id">
          <span className="lp-label">المستوى</span>
          <h3 className="lv-card__name">{level.name}</h3>
          <div className="lv-card__tags">
            <span className="lv-tag">الكسب <Num>{timesText(level.multiplier)}</Num></span>
            {level.since && <span className="lv-tag is-quiet">منذ <Num>{fullDate(level.since)}</Num></span>}
          </div>
        </div>
        {canChange && <Button size="small" variant="outlined" startIcon={<MdTrendingUp />} onClick={() => setChanging(true)} className="lv-card__action">تغيير المستوى</Button>}
      </header>

      {level.next ? (
        <div className="lv-way" style={{ ['--share' as any]: `${Math.round(share * 100)}%` }}>
          <div className="lv-way__row" role="progressbar" aria-valuemin={start} aria-valuemax={level.next.min} aria-valuenow={level.points}
            aria-label={`نقاط المستوى ${pointsText(level.points)} من ${pointsText(level.next.min)}`}>
            <LevelEmblem levelKey={level.level} rank={level.rank} size={30} />
            <div className="lv-way__track" aria-hidden="true"><span className="lv-way__fill" /></div>
            <LevelEmblem levelKey={level.next.key} rank={level.rank + 1} size={30} locked />
          </div>
          <p className="lv-way__text">
            <strong><Num>{pointsText(level.points)}</Num></strong> نقطة مستوى في آخر 12 شهراً.
            باقي <strong><Num>{pointsText(level.next.remaining)}</Num></strong> للوصول إلى <b className="lv-way__next">{level.next.name}</b>
          </p>
        </div>
      ) : (
        <p className="lv-way__text">أعلى مستوى. <strong><Num>{pointsText(level.points)}</Num></strong> نقطة مستوى في آخر 12 شهراً.</p>
      )}

      {keep && (
        <div className={`lv-keep${kept ? ' is-ok' : ''}`}>
          <span className="lv-keep__icon" aria-hidden="true">{kept ? <MdCheckCircle /> : <MdShield />}</span>
          <div className="lv-keep__body">
            <strong>{kept ? 'مستواه محفوظ للمراجعة القادمة' : <>يحتاج <Num>{pointsText(keep.remaining)}</Num> نقطة ليحافظ على مستواه</>}</strong>
            <span>المحافظة تحتاج <Num>{pointsText(keep.min)}</Num> نقطة (70%){level.reviewAt ? <>، المراجعة في <Num>{fullDate(level.reviewAt)}</Num></> : null}</span>
          </div>
        </div>
      )}

      {level.review && !level.review.keeps && (
        <Alert severity="warning" icon={<MdWarningAmber />} className="lv-alert">
          ينزل مستوى واحداً في <Num>{fullDate(level.review.at)}</Num> ما لم يكسب <Num>{pointsText(level.review.needed)}</Num> نقطة. فرصة جيدة للتواصل معه.
        </Alert>
      )}

      {level.manual && (
        <p className="lv-note">
          غُيّر يدوياً في <Num>{fullDate(level.manual.at)}</Num>{level.manual.by ? <> بواسطة <bdi>{level.manual.by}</bdi></> : null}: <bdi dir="auto">{level.manual.reason}</bdi>
        </p>
      )}

      <div className="lv-card__more">
        {level.perks?.length > 0 && (
          <Disclosure icon={<MdStars />} title="مزايا المستوى" count={level.perks.length}>
            <ul className="lv-perks">{level.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul>
          </Disclosure>
        )}
        {history.length > 0 && (
          <Disclosure icon={<MdHistory />} title="سجل المستوى" count={history.length}>
            <ol className="lv-timeline">
              {history.map((row, index) => (
                <li key={`${row.at}-${index}`}>
                  <div className="lv-timeline__move">
                    <LevelBadge level={row.from} tiers={tiers} size="sm" /> <span aria-hidden="true">←</span> <LevelBadge level={row.to} tiers={tiers} size="sm" />
                  </div>
                  <div className="lv-timeline__meta">
                    {WHY[row.why] || row.why} · <Num>{fullDate(row.at)}</Num>{row.by ? <> · <bdi>{row.by}</bdi></> : null}
                    {row.reason && <> · <bdi dir="auto">{row.reason}</bdi></>}
                  </div>
                </li>
              ))}
            </ol>
          </Disclosure>
        )}
      </div>

      <ChangeLevelDialog open={changing && canChange} userId={userId} current={level.level} tiers={tiers} onClose={() => setChanging(false)} onSaved={() => { setChanging(false); onChanged(); }} />
    </section>
  );
};

const ChangeLevelDialog = ({ open, userId, current, tiers, onClose, onSaved }: { open: boolean, userId: string, current: string, tiers: Tier[], onClose: () => void, onSaved: () => void }) => {
  const motion = useDialogMotion();
  const [level, setLevel] = useState(current);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setLevel(current); setReason(''); setError(''); } }, [open, current]);
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.update(`user/${userId}/loyalty/level`, { level, reason: reason.trim() });
      onSaved();
    } catch (e: any) {
      setError(requestError(e, 'تعذّر تغيير المستوى.'));
    } finally {
      setSaving(false);
    }
  };
  const target = tierOf(tiers, level);
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" dir="rtl" PaperProps={{ className: 'lp lp-dialog' }} {...motion}>
      <DialogTitle>تغيير المستوى</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" dir="auto">{error}</Alert>}
        <div className="lp-quick" role="radiogroup" aria-label="المستوى">
          {tiers.map((tier) => (
            <button key={tier.key} type="button" role="radio" aria-checked={level === tier.key} className="lp-chip lp-press lp-level-pick"
              style={{ ['--lv' as any]: tier.color }} disabled={saving} onClick={() => setLevel(tier.key)}>{tier.name}</button>
          ))}
        </div>
        <p className="lp-muted" style={{ margin: '10px 0' }}>
          يبقى المستوى سنة من اليوم، ثم يُراجع كالعادة. لا تُعطى هدية الترقية عند التغيير اليدوي.
          {target && target.rank > 0 && <> مضاعف الكسب في {target.name}: <Num>{timesText(target.multiplier)}</Num>.</>}
        </p>
        <TextField fullWidth required multiline minRows={2} label="السبب" dir="auto" value={reason} disabled={saving}
          onChange={(event) => setReason(event.target.value)} helperText={!reason.trim() ? 'السبب إجباري' : ''} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>تراجع</Button>
        <Button variant="contained" onClick={save} disabled={saving || !reason.trim() || level === current}>{saving ? 'جارٍ الحفظ' : 'حفظ'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LevelPanel;
