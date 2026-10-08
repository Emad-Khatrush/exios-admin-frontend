import { useLayoutEffect, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import './QaBanner.scss';

export const isQaEnvironment = () => process.env.REACT_APP_ENVIRONMENT === 'qa'
  || ['exios-admin-qa.web.app', 'exios-admin-qa.firebaseapp.com'].includes(window.location.hostname);

export default function QaBanner() {
  const banner = useRef<HTMLDivElement>(null);
  const qa = isQaEnvironment();
  useLayoutEffect(() => {
    if (!qa || !banner.current) return undefined;
    const measure = () => document.documentElement.style.setProperty('--qa-banner-height', `${banner.current?.getBoundingClientRect().height || 64}px`);
    document.body.classList.add('exios-qa');
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(banner.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      document.body.classList.remove('exios-qa');
      document.documentElement.style.removeProperty('--qa-banner-height');
    };
  }, [qa]);
  if (!qa) return null;
  return <div ref={banner} className="qa-banner" role="note" aria-label="نسخة تجريبية QA" dir="rtl">
    <span className="qa-banner__badge"><FlaskConical size={18} aria-hidden="true" /><b>QA · للتجربة فقط</b></span>
    <span className="qa-banner__message">هذه نسخة اختبار منفصلة عن النظام الحقيقي. البيانات والعمليات هنا للتجربة ولا تُعتمد للعمل.</span>
  </div>;
}
