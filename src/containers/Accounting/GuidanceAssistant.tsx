import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUp, BookOpen, ChevronLeft, MessageCircle, Minus, RotateCcw, Search } from 'lucide-react';
import { AccountingTheme } from './ui/AccountingTheme';
import { useAccountingAccess } from './useAccountingAccess';
import { findGuidance, guidanceTopics, GuidanceTopic } from './guidanceTopics';
import './GuidanceAssistant.scss';

type Message = { question: string; results: GuidanceTopic[] };
export default function GuidanceAssistant() {
  const access = useAccountingAccess();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [article, setArticle] = useState<GuidanceTopic | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const topics = guidanceTopics.filter(topic => !topic.permissions || access.can(...topic.permissions));
  const visible = !access.loading && access.permissions.length > 0 && !['/login', '/shouldAllowToAccessApp'].includes(location.pathname);
  const contextual = topics.filter(topic => location.pathname === topic.path.split('#')[0] || location.pathname.startsWith(`${topic.path}/`));
  const suggestions = Array.from(new Map([...contextual, ...topics.filter(t => ['bank', 'bill', 'refund', 'review', 'wallet', 'reports'].includes(t.id))].map(t => [t.id, t])).values()).slice(0, 4);
  const close = () => { setOpen(false); window.setTimeout(() => launcher.current?.focus(), 0); };
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => { if (open && !article) end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, open, article]);
  useEffect(() => {
    if (!visible) { setOpen(false); setMessages([]); setArticle(null); setQuery(''); }
  }, [visible]);
  const ask = (question: string) => {
    if (!question.trim()) return;
    setMessages(previous => [...previous.slice(-19), { question: question.trim().slice(0, 500), results: findGuidance(question, topics) }]);
    setQuery(''); setArticle(null);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); ask(query); };
  if (!visible) return null;
  return <AccountingTheme>
    <div className="exios-guidance">
      {!open && <button ref={launcher} type="button" className="exios-guidance__launcher" onClick={() => setOpen(true)} aria-label="فتح مساعد Exios الإرشادي" aria-expanded={false} aria-controls="exios-guidance-panel"><MessageCircle size={21} /><span>مساعد Exios</span></button>}
      {open && <section id="exios-guidance-panel" className="exios-guidance__panel" role="dialog" aria-modal="false" aria-labelledby="exios-guidance-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
        <header className="exios-guidance__header">
          <MessageCircle size={23} /><div><h2 id="exios-guidance-title">مساعد Exios الإرشادي</h2><span>خطوات واضحة من دليل منظومتك</span></div>
          <button type="button" onClick={close} aria-label="إخفاء المساعد" title="إخفاء المساعد"><Minus size={21} /></button>
        </header>
        <div className="exios-guidance__notice">إرشادات فقط؛ لا يقرأ بياناتك ولا ينفّذ عمليات.</div>
        <div className="exios-guidance__body">
          {article ? <article>
            <button type="button" className="exios-guidance__back" onClick={() => setArticle(null)}>العودة للأسئلة <ChevronLeft size={15} /></button>
            <span className="exios-guidance__eyebrow">شرح الإجراء</span><h3>{article.title}</h3><p>{article.summary}</p>
            <ol className="exios-guidance__steps">{article.steps.map(step => <li key={step}>{step}</li>)}</ol>
            {article.note && <p className="exios-guidance__note">{article.note}</p>}
            <Link className="exios-guidance__go" to={article.path} onClick={close}>فتح {article.screen}<ChevronLeft size={17} /></Link>
            <Link className="exios-guidance__source" to={`/accounting/guide#guide-${article.source}`} onClick={close}><BookOpen size={15} />المرجع: دليل النظام والشاشة المذكورة</Link>
          </article> : <>
            {!messages.length && <div className="exios-guidance__welcome"><span className="exios-guidance__eyebrow">ابدأ من هنا</span><h3>ما الذي تريد عمله؟</h3><p>ابحث عن الإجراء أو اختر سؤالًا، وسأعرض الخطوات ومكان تنفيذها.</p></div>}
            {!!suggestions.length && <div className="exios-guidance__suggestions" aria-label="أسئلة مقترحة للصفحة الحالية">{suggestions.map(topic => <button key={topic.id} type="button" onClick={() => { ask(topic.question); setArticle(topic); }}>{topic.question}<ChevronLeft size={15} /></button>)}</div>}
            <div aria-live="polite" aria-relevant="additions">
              {messages.map((message, index) => <div className="exios-guidance__exchange" key={index}>
                <p className="exios-guidance__question"><span>سؤالك</span>{message.question}</p>
                {message.results.length ? <div className="exios-guidance__answer"><p>هذه إرشادات مرتبطة ببحثك. اختر الموضوع المناسب:</p>{message.results.map(topic => <button type="button" key={topic.id} className="exios-guidance__result" onClick={() => setArticle(topic)}><strong>{topic.title}</strong><span>{topic.screen}</span><ChevronLeft size={16} /></button>)}</div>
                  : <div className="exios-guidance__answer"><p>لم أجد إرشادًا مناسبًا في الدليل. جرّب اسم الإجراء مثل «ريفاند» أو «كشف البنك» أو «فاتورة مورد».</p><Link to="/accounting/guide" onClick={close}>فتح دليل النظام</Link></div>}
              </div>)}
            </div><div ref={end} />
          </>}
        </div>
        <footer className="exios-guidance__footer">
          <form onSubmit={submit}><Search size={17} /><input ref={input} aria-label="ابحث عن إجراء في المنظومة" placeholder="مثل: كيف أسجل ريفاوند؟" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} /><button type="submit" disabled={!query.trim()} aria-label="البحث عن الإرشادات"><ArrowUp size={19} /></button></form>
          <div><span>بحث في إرشادات المنظومة</span>{(messages.length > 0 || article) && <button type="button" onClick={() => { setMessages([]); setArticle(null); setQuery(''); input.current?.focus(); }}><RotateCcw size={13} />بدء جديد</button>}</div>
        </footer>
      </section>}
    </div>
  </AccountingTheme>;
}
