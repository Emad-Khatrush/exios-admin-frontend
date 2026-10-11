import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Download } from 'lucide-react';
import { base } from '../../api';
import { fontUri, renderFlightReportHtml } from '../../utils/flightReportHtml';

type Props = { flightId: string; voyage?: string; customerId?: string };

// Page setup and footer the server-side PDF used: A4 landscape, same margins,
// "إكسيوس · تقرير الرحلة" on one side and the page count on the other.
const footerBox = `font: 9px ReportArabic, Arial, sans-serif; color: #687f83; direction: rtl;
  border-top: 1px solid #dbe7e6; padding-top: 6px; margin-top: 4mm; vertical-align: top;`;
const printStyle = () => `<style>
  @font-face { font-family: ReportArabic; src: url('${fontUri()}') format('truetype'); }
  @page {
    size: A4 landscape;
    margin: 12mm 12mm 17mm 12mm;
    @bottom-right { content: 'إكسيوس · تقرير الرحلة'; ${footerBox} text-align: right; }
    @bottom-center { content: ''; ${footerBox} }
    @bottom-left { content: 'الصفحة ' counter(page) ' من ' counter(pages); ${footerBox} text-align: left; }
  }
</style>`;

const printHtml = (html: string, title: string) => new Promise<void>((resolve, reject) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  const pageTitle = document.title;
  const cleanup = () => {
    document.title = pageTitle;
    frame.remove();
  };
  frame.onload = async () => {
    try {
      const win = frame.contentWindow!;
      const doc = frame.contentDocument!;
      await Promise.all(Array.from(doc.images).map(img => img.complete ? null
        : new Promise(done => { img.onload = img.onerror = done; })));
      await doc.fonts.ready;
      // The browser suggests the document title as the PDF file name.
      doc.title = title;
      document.title = title;
      win.addEventListener('afterprint', () => window.setTimeout(cleanup, 0), { once: true });
      win.focus();
      win.print();
      resolve();
    } catch (error) {
      cleanup();
      reject(error);
    }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
});

const FlightPdfButton = ({ flightId, voyage, customerId }: Props) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setIsDownloading(true);
    setError('');
    try {
      const response = await base.axios.get(`inventory/${flightId}/report`, {
        params: customerId ? { customerId } : undefined,
      });
      const { inventory, orders } = response.data;
      const html = renderFlightReportHtml(inventory, orders, { customerOnly: !!customerId })
        .replace('</head>', `${printStyle()}</head>`);
      const filename = Array.from(String(voyage || flightId))
        .filter(char => char.charCodeAt(0) >= 32).join('').replace(/[<>:"/\\|?*]/g, '_');
      await printHtml(html, `Exios-flight-${filename}${customerId ? '-customer' : ''}`);
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
