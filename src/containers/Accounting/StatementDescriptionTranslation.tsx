import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { acc, errorText } from './accountingApi';
import { Sub } from './ui';

export const canTranslateDescription = (line: any) => !!line?._id && /[A-Za-z\u00c0-\u024f\u3400-\u9fff]/.test(line.description || '');

export default function StatementDescriptionTranslation({ line, onTranslated }: any) {
  const [translation, setTranslation] = useState<any>(line.descriptionTranslation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setTranslation(line.descriptionTranslation); setError(''); }, [line._id, line.description, line.descriptionTranslation]);
  const saved = translation?.original === line.description && translation?.targetLanguage === 'ar' ? translation : null;
  if (!canTranslateDescription(line) && !saved) return null;
  return <div>
    {saved ? <Sub><span dir="rtl">{saved.text}</span><span className="acc-muted"> · {saved.provider === 'dictionary' ? 'ترجمة المصطلح' : 'ترجمة آلية'}</span></Sub>
      : <Button size="small" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try {
          const response = await acc.post(`bank/lines/${line._id}/translate`);
          setTranslation(response.data.translation);
          onTranslated?.(line._id, response.data.translation);
        } catch (err: any) { setError(errorText(err)); }
        finally { setBusy(false); }
      }}>{busy ? 'جارٍ الترجمة...' : 'ترجمة البيان للعربية'}</Button>}
    {error && <Sub><span role="alert" style={{ color: '#b42318' }}>{error}</span></Sub>}
  </div>;
}
