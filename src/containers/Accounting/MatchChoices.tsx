import { Box, Chip, Radio, Stack, Typography } from '@mui/material';
import { Check, TriangleAlert } from 'lucide-react';
import { Ltr } from './ui';

// The operations in the books that may be this statement line, one card per possibility: each
// operation in its own currency (6,000 CNY salary) with the dollars that left the account under it,
// and whether the total equals the statement in dollars and in the original currency.
const KIND: Record<string, string> = { salary: 'راتب', payment: 'دفعة مورد', yuan: 'شراء يوان' };
const ACCENT = '#14634f';

const format = (amount: number, currency: string, digits = 2) => `${Number(amount).toLocaleString('en-US', { maximumFractionDigits: digits })} ${currency}`;

export type MatchOption = { entries: any[]; strong?: boolean };

export default function MatchChoices({ line, options, currency, decimals, selected, onSelect, statementOriginal }: {
  line: any; options: MatchOption[]; currency: string; decimals: number; selected: number | null; onSelect: (index: number) => void;
  statementOriginal?: { amount: number; currency: string };
}) {
  const unit = 10 ** decimals;
  // The yuan total printed in the description wins over the amount read when the file was imported
  const lineOriginal = statementOriginal ? statementOriginal : line?.originalAmount > 0 && line.originalCurrency && line.originalCurrency !== currency
    ? { amount: Number(line.originalAmount), currency: line.originalCurrency } : null;

  return <Stack gap={1.5}>
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
      {options.length === 1 ? 'وُجدت عمليات مسجلة مجموعها مبلغ هذا السطر.' : `وُجدت ${options.length} مجموعات مسجلة، كل منها مجموعه مبلغ هذا السطر. اختر الصحيحة.`}
    </Typography>
    {options.map((option, index) => {
      const active = selected === index;
      const usd = option.entries.reduce((sum, e) => sum + e.amount, 0);
      const originals = option.entries.map((e) => e.original).filter((o) => o?.currency && o.amount != null);
      // The original total only when every operation has one and they share the statement's currency
      const sameCurrency = lineOriginal && originals.length === option.entries.length && originals.every((o) => o.currency === lineOriginal.currency);
      const originalTotal = sameCurrency ? originals.reduce((sum, o) => sum + Number(o.amount), 0) : null;
      const originalGap = originalTotal != null ? Math.round((originalTotal - lineOriginal!.amount) * 100) / 100 : null;
      return <Box key={index} role="radio" aria-checked={active} tabIndex={0} onClick={() => onSelect(index)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(index); } }}
        sx={{ borderRadius: 3, border: '1px solid', borderColor: active ? ACCENT : '#dbe6ee', bgcolor: active ? '#f3faf7' : '#fff', cursor: 'pointer',
          transition: 'border-color .15s, background-color .15s', '&:hover': { borderColor: active ? ACCENT : '#a9c9c2' }, '&:focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 } }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, pt: 1.5 }}>
          <Radio size="small" checked={active} tabIndex={-1} sx={{ p: 0, color: '#9fb3bf', '&.Mui-checked': { color: ACCENT } }} />
          <Typography fontWeight={700} fontSize={14}>{option.entries.length === 2 ? 'عمليتان' : `${option.entries.length} عمليات`}</Typography>
          {option.strong && <Chip size="small" label="نفس رقم العملية في الكشف" sx={{ bgcolor: '#e6f4ef', color: ACCENT, fontWeight: 600 }} />}
        </Stack>

        <Box sx={{ px: 2, py: 1 }}>
          {option.entries.map((e: any) => <Box key={e._id} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, alignItems: 'center', py: 1.1, '& + &': { borderTop: '1px dashed #e3ebf0' } }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                {e.original?.kind && <Typography component="span" fontSize={12} fontWeight={700} sx={{ color: ACCENT, bgcolor: '#e6f4ef', px: 1, py: .2, borderRadius: 1.5 }}>{KIND[e.original.kind]}</Typography>}
                <Typography component="span" fontSize={14} fontWeight={600}>{e.original?.party || e.description}</Typography>
              </Stack>
              <Typography fontSize={12.5} color="text.secondary" sx={{ mt: .4 }}>
                {e.original?.detail && <>{e.original.detail} · </>}<Ltr>{e.number}</Ltr> · <Ltr>{e.day}</Ltr>
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'left' }}>
              {e.original?.currency && e.original.currency !== currency && e.original.amount != null
                ? <>
                  <Typography fontSize={15} fontWeight={700}><Ltr>{format(e.original.amount, e.original.currency)}</Ltr></Typography>
                  <Typography fontSize={12.5} color="text.secondary"><Ltr>{format(Math.abs(e.amount) / unit, currency, decimals)}</Ltr></Typography>
                  {e.original.fromStatement && <Typography fontSize={11} color="text.secondary">اليوان حسب بيان الكشف</Typography>}
                </>
                : <Typography fontSize={15} fontWeight={700}><Ltr>{format(Math.abs(e.amount) / unit, currency, decimals)}</Ltr></Typography>}
            </Box>
          </Box>)}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: originalTotal != null ? '1fr 1fr' : '1fr' }, gap: 1, px: 2, pb: 1.5 }}>
          <Total label="المجموع بالدولار" value={format(Math.abs(usd) / unit, currency, decimals)} ok={usd === line.amount}
            note={usd === line.amount ? 'يساوي الكشف' : `الكشف ${format(Math.abs(line.amount) / unit, currency, decimals)}`} />
          {originalTotal != null && <Total label={`المجموع بـ ${lineOriginal!.currency}`} value={format(originalTotal, lineOriginal!.currency)} ok={originalGap === 0}
            note={originalGap === 0 ? 'يساوي الكشف' : `الكشف ${format(lineOriginal!.amount, lineOriginal!.currency)}، الفرق ${format(Math.abs(originalGap!), lineOriginal!.currency)}`} />}
        </Box>
      </Box>;
    })}
  </Stack>;
}

function Total({ label, value, ok, note }: { label: string; value: string; ok: boolean; note: string }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: 2, bgcolor: ok ? '#f0f8f5' : '#fff7ed' }}>
    <Box>
      <Typography fontSize={12} color="text.secondary">{label}</Typography>
      <Typography fontSize={14} fontWeight={700}><Ltr>{value}</Ltr></Typography>
    </Box>
    <Stack direction="row" alignItems="center" gap={.5} sx={{ color: ok ? ACCENT : '#92400e' }}>
      {ok ? <Check size={15} strokeWidth={2.2} /> : <TriangleAlert size={15} strokeWidth={2.2} />}
      <Typography fontSize={12.5} fontWeight={600}>{note}</Typography>
    </Stack>
  </Box>;
}
