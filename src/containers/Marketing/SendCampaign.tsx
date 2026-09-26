import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Image as ImageIcon, Send, UserPlus, Users } from 'lucide-react';
import api from '../../api';

type Props = {
  onSent: (campaignId: string | null) => void;
};

type Target = 'allUsers' | 'onlyNewClients';

const TARGETS: { value: Target; label: string; hint: string; icon: typeof Users }[] = [
  { value: 'allUsers', label: 'All clients', hint: 'Every registered, active client', icon: Users },
  { value: 'onlyNewClients', label: 'New clients', hint: 'Clients who never placed an order', icon: UserPlus },
];

// Must match the |word| placeholders replaced by replaceWords() on the API.
const VARIABLES = [
  { key: 'fullName', label: 'Full name' },
  { key: 'customerId', label: 'Customer ID' },
  { key: 'phone', label: 'Phone' },
];

const SendCampaign = (props: Props) => {
  const [imgUrl, setImgUrl] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState<Target>('allUsers');
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = !isLoading && content.trim().length > 0;

  const insertVariable = (key: string) => {
    const token = `|${key}|`;
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const send = async (query?: { testMode?: boolean }) => {
    if (!canSend) return;

    try {
      setIsLoading(true);
      setFeedback(null);
      const response = await api.post('sendMessagesToClients', { imgUrl, content, target, skip, limit, ...query });

      if (query?.testMode) {
        setFeedback({ type: 'success', message: 'Test message sent to your WhatsApp.' });
      } else {
        props.onSent(response.data.campaignId || null);
      }
    } catch (error: any) {
      const code = error?.response?.data?.message;
      setFeedback({
        type: 'error',
        message: code === 'whatsup-auth-not-found' ? 'WhatsApp is not linked. Scan the QR code first.' : (code || 'Something went wrong, please try again.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="marketing">
      <header className="marketing__header">
        <div>
          <h5 className="marketing__title">
            <Send size={18} strokeWidth={2} />
            New campaign
          </h5>
          <p className="marketing__subtitle">
            Broadcast a WhatsApp message to your clients. Messages go out one per minute.
          </p>
        </div>
      </header>

      {feedback &&
        <div className={`marketing__alert marketing__alert--${feedback.type}`} role="alert">
          {feedback.type === 'success' ? <CheckCircle2 size={16} strokeWidth={2} /> : <AlertTriangle size={16} strokeWidth={2} />}
          {feedback.message}
        </div>
      }

      <form className="campaign-form" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <div className="campaign-form__field">
          <span className="marketing__field-label">Send to</span>
          <div className="campaign-form__targets">
            {TARGETS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`campaign-form__target ${target === option.value ? 'is-active' : ''}`}
                onClick={() => setTarget(option.value)}
                disabled={isLoading}
              >
                <option.icon size={18} strokeWidth={2} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="campaign-form__field">
          <span className="marketing__field-label">Message</span>
          <textarea
            ref={textareaRef}
            rows={7}
            placeholder="اكتب الرسالة هنا..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={isLoading}
            dir="rtl"
            required
          />
          <div className="campaign-form__vars">
            <span>Insert:</span>
            {VARIABLES.map((variable) => (
              <button key={variable.key} type="button" onClick={() => insertVariable(variable.key)} disabled={isLoading}>
                {variable.label}
              </button>
            ))}
          </div>
        </div>

        <div className="campaign-form__field">
          <span className="marketing__field-label">Image URL (optional)</span>
          <div className="campaign-form__input-icon">
            <ImageIcon size={15} strokeWidth={2} />
            <input
              type="text"
              placeholder="https://..."
              value={imgUrl}
              onChange={(event) => setImgUrl(event.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <details className="campaign-form__advanced">
          <summary>Send to part of the list</summary>
          <div className="campaign-form__advanced-fields">
            <div className="campaign-form__field">
              <span className="marketing__field-label">Skip first</span>
              <input type="number" min={0} value={skip} onChange={(event) => setSkip(Number(event.target.value) || 0)} disabled={isLoading} />
            </div>
            <div className="campaign-form__field">
              <span className="marketing__field-label">Max clients (0 = all)</span>
              <input type="number" min={0} value={limit} onChange={(event) => setLimit(Number(event.target.value) || 0)} disabled={isLoading} />
            </div>
          </div>
        </details>

        <div className="campaign-form__actions">
          <button type="submit" className="marketing__search" disabled={!canSend}>
            <Send size={15} strokeWidth={2} />
            {isLoading ? 'Creating…' : 'Send campaign'}
          </button>
          <button type="button" className="campaign-form__secondary" disabled={!canSend} onClick={() => send({ testMode: true })}>
            <FlaskConical size={14} strokeWidth={2} />
            Send me a test
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendCampaign;
