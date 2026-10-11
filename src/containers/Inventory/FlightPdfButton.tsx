import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Download } from 'lucide-react';
import { base } from '../../api';

type Props = { flightId: string; voyage?: string; customerId?: string };

const FlightPdfButton = ({ flightId, voyage, customerId }: Props) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setIsDownloading(true);
    setError('');
    try {
      const response = await base.axios.get(`inventory/${flightId}/report.pdf`, {
        params: customerId ? { customerId } : undefined,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const filename = Array.from(String(voyage || flightId))
        .filter(char => char.charCodeAt(0) >= 32).join('').replace(/[<>:"/\\|?*]/g, '_');
      link.download = `Exios-flight-${filename}${customerId ? '-customer' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('تعذر تحميل تقرير الرحلة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <span>
      <Button size="small" onClick={download} disabled={isDownloading}
        startIcon={isDownloading ? <CircularProgress size={15} /> : <Download size={15} />}>
        {isDownloading ? 'جارٍ إعداد التقرير…' : 'تحميل PDF'}
      </Button>
      {error && <span role="alert" style={{ display: 'block', color: '#b42318', fontSize: 12 }}>{error}</span>}
    </span>
  );
};

export default FlightPdfButton;
