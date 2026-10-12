import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, MessageCircleQuestion, PlugZap, RotateCw, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
// @ts-ignore
import './LocalAccountingAssistant.scss';

const PORT = 5010;
// A path inside this admin, as the chat sends it when a screen it names is clicked
const ADMIN_PATH = /^\/(?!\/)[A-Za-z0-9\-_/?=&%#]*$/;

// The assistant runs as a local service next to the API (scripts/Start-ChatGPTLocal.ps1), so the
// button only shows on a local build that talks to a local API, and only to admins and accountants
export default function LocalAccountingAssistant({ page, pageLabel }: { page: string, pageLabel?: string }) {
  const roles = useSelector((state: any) => state.session.account?.roles);
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && process.env.REACT_APP_ENVIRONMENT !== 'qa'
    && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.REACT_APP_API_URL || '');
  const qa = process.env.REACT_APP_ENVIRONMENT === 'qa'
    && ['exios-admin-qa.web.app', 'exios-admin-qa.firebaseapp.com'].includes(window.location.hostname);
  if ((!local && !qa) || !(roles?.isAdmin || roles?.isAccountant)) return null;
  if (qa) return <div className="acc-assist"><button type="button" className="acc-assist__launcher"
    onClick={() => window.open(`http://127.0.0.1:${PORT}/?chat=1&page=${encodeURIComponent(page)}&admin=${encodeURIComponent(window.location.origin)}`, '_blank', 'noopener,noreferrer')}
    title="تجربة QA باستخدام خدمة المساعد المشغّلة على جهازك">
    <span className="acc-assist__launcher-icon"><MessageCircleQuestion size={18} strokeWidth={1.9} /></span>
    <span>اسأل المحاسب</span>
  </button></div>;
  return <AssistantPanel page={page} pageLabel={pageLabel} />;
}

type ServiceState = 'checking' | 'online' | 'offline';

function AssistantPanel({ page, pageLabel }: { page: string, pageLabel?: string }) {
  const [open, setOpen] = useState(false);
  // The chat frame is created on the first open and then kept, so closing the panel does not
  // lose the conversation
  const [mounted, setMounted] = useState(false);
  const [service, setService] = useState<ServiceState>('checking');
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  const frame = useRef<HTMLIFrameElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const origin = `http://${window.location.hostname}:${PORT}`;
  // The page the chat was opened from; a page change while it is open does not reload the frame
  const [framePage, setFramePage] = useState(page);

  const check = useCallback(() => {
    setService('checking');
    // An opaque request is enough: it fails only when nothing listens on the port
    fetch(`${origin}/client.js`, { mode: 'no-cors', cache: 'no-store' })
      .then(() => setService('online'))
      .catch(() => setService('offline'));
  }, [origin]);

  const show = () => {
    if (!mounted) { setFramePage(page); setMounted(true); check(); }
    setOpen(true);
  };
  const hide = () => { setOpen(false); launcher.current?.focus(); };
  const retry = () => { setLoaded(false); setFramePage(page); setAttempt((n) => n + 1); check(); };

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The chat asks about the page on screen now, not the one it was opened from
  useEffect(() => {
    if (loaded) frame.current?.contentWindow?.postMessage({ type: 'exios-assistant-page', path: page }, origin);
  }, [loaded, page, origin]);

  // A screen named in an answer was clicked: accounting pages open here and the chat stays open;
  // other pages of the system open in a new tab, since the assistant lives in accounting only
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const path = e.data?.type === 'exios-assistant-navigate' ? e.data.path : null;
      if (typeof path !== 'string' || !ADMIN_PATH.test(path)) return;
      if (path === '/accounting' || path.startsWith('/accounting/') || path.startsWith('/accounting?')) navigate(path);
      else window.open(path, '_blank', 'noopener');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, navigate]);

  const src = `${origin}/?chat=1&page=${encodeURIComponent(framePage)}&admin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="acc-assist">
      <button ref={launcher} type="button" className="acc-assist__launcher" data-hidden={open}
        aria-expanded={open} aria-controls="acc-assist-panel" tabIndex={open ? -1 : 0} onClick={show}>
        <span className="acc-assist__launcher-icon"><MessageCircleQuestion size={18} strokeWidth={1.9} /></span>
        <span>اسأل المحاسب</span>
      </button>

      <section id="acc-assist-panel" className="acc-assist__panel" data-open={open}
        role="dialog" aria-label="مساعد المحاسبة" aria-hidden={!open}>
        <header className="acc-assist__head">
          <span className="acc-assist__mark"><MessageCircleQuestion size={20} strokeWidth={1.8} /></span>
          <div className="acc-assist__title">
            <h2>مساعد المحاسبة</h2>
            <p>يشرح لك خطوات الإجراء من دليل المنظومة</p>
          </div>
          <a className="acc-assist__icon-btn" href={`${origin}/`} target="_blank" rel="noopener noreferrer"
            title="صفحة ربط الحساب" aria-label="فتح صفحة ربط الحساب في نافذة جديدة" tabIndex={open ? 0 : -1}>
            <ExternalLink size={17} strokeWidth={1.8} />
          </a>
          <button ref={closeButton} type="button" className="acc-assist__icon-btn" onClick={hide}
            aria-label="إغلاق المساعد" tabIndex={open ? 0 : -1}>
            <X size={19} strokeWidth={1.8} />
          </button>
        </header>

        {pageLabel && (
          <div className="acc-assist__context">
            <MapPin size={14} strokeWidth={1.8} />
            <span>السؤال من صفحة</span>
            <strong>{pageLabel}</strong>
          </div>
        )}

        <div className="acc-assist__body">
          {service === 'offline' ? (
            <div className="acc-assist__state">
              <span className="acc-assist__state-icon"><PlugZap size={22} strokeWidth={1.7} /></span>
              <h3>خدمة المساعد غير مشغّلة</h3>
              <p>شغّل الخدمة المحلية من مجلد الـ API ثم أعد المحاولة.</p>
              <code dir="ltr">accounting/scripts/Start-ChatGPTLocal.ps1</code>
              <button type="button" className="acc-assist__retry" onClick={retry}>
                <RotateCw size={15} strokeWidth={1.9} />
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              {(service === 'checking' || !loaded) && (
                <div className="acc-assist__skeleton" aria-hidden="true">
                  <span className="acc-assist__bone acc-assist__bone--in" />
                  <span className="acc-assist__bone acc-assist__bone--in acc-assist__bone--short" />
                  <span className="acc-assist__bone acc-assist__bone--out" />
                  <span className="acc-assist__bone acc-assist__bone--composer" />
                </div>
              )}
              {mounted && service === 'online' && (
                <iframe ref={frame} key={attempt} title="محادثة مساعد المحاسبة" src={src} data-ready={loaded} allow="clipboard-write"
                  tabIndex={open ? 0 : -1} onLoad={() => setLoaded(true)} />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
