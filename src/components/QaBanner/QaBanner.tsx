import { FlaskConical } from 'lucide-react';
import './QaBanner.scss';

export const isQaEnvironment = () => process.env.REACT_APP_ENVIRONMENT === 'qa'
  || ['exios-admin-qa.web.app', 'exios-admin-qa.firebaseapp.com'].includes(window.location.hostname);

export default function QaBanner() {
  if (!isQaEnvironment()) return null;
  return <div className="qa-banner" role="note" aria-label="???? ??????? QA" dir="rtl">
    <span className="qa-banner__badge"><FlaskConical size={13} aria-hidden="true" /><b>QA ? ??????? ???</b></span>
    <span className="qa-banner__message">?????? ??????? ? ??? ?????? ?????</span>
  </div>;
}
