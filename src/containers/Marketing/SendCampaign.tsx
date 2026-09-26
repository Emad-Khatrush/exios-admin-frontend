import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Image as ImageIcon, Send, Users } from 'lucide-react';
import api from '../../api';

type Props = {
  onSent: (campaignId: string | null) => void;
};

type Target = 'allUsers' | 'onlyNewClients';

const TARGETS: { value: Target; label: string; hint: string }[] = [
  { value: 'allUsers', label: 'All clients', hint: 'Every registered, active client' },
  { value: 'onlyNewClients', label: 'New clients only', hint: 'Clients who never placed an order' },
];

const SendCampaign = (props: Props) => {
  const [imgUrl, setImgUrl] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState<Target>('allUsers');
  const [skip, setSkip] = useState('');
  const [limit, setLimit] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canSend = !isLoading && content.trim().length > 0;

  const send = async (event: React.FormEvent, query?: any) => {
    event.preventDefault();
    if (!canSend && !query?.testMode && !query?.testBigData) return;

    try {
      setIsLoading(true);
      setFeedback(null);
      const response = await api.post('sendMessagesToClients', {
        imgUrl: imgUrl || undefined,
        content,
        target,
        skip: skip ? Number(skip) : 0,
        limit: limit ? Number(limit) : undefined,
        ...query,
      });

      setFeedback({ type: 'success', message: response.data.message || 'Campaign queued successfully' });

      if (!query?.testMode && !query?.testBigData) {
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
            Send a campaign
          </h5>
          <p className="marketing__subtitle">
            Broadcast a WhatsApp message to your clients. One message goes out per minute, so nobody feels spammed.
          </p>
        </div>
      </header>

      {feedback &&
        <div className={`marketing__alert marketing__alert--${feedback.type}`} role="alert">
          {feedback.type === 'success' ? <CheckCircle2 size={16} strokeWidth={2} /> : <AlertTriangle size={16} strokeWidth={2} />}
          {feedback.message}
        </div>
      }

      <form className="campaign-form" onSubmit={send}>
        <div className="campaign-form__field">
          <span className="marketing__field-label">Message</span>
          <textarea
            rows={6}
            placeholder="Write the message your clients will receive. Use {{fullName}}, {{customerId}} or {{phone}} to personalize it."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={isLoading}
            dir="auto"
            required
          />
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

        <div className="campaign-form__field">
          <span className="marketing__field-label">Send to</span>
          <div className="marketing__segmented" role="tablist" aria-label="Target audience">
            {TARGETS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={target === option.value}
                className={target === option.value ? 'is-active' : ''}
                onClick={() => setTarget(option.value)}
                disabled={isLoading}
              >
                <Users size={14} strokeWidth={2} />
                {option.label}
              </button>
            ))}
          </div>
          <span className="campaign-form__hint">{TARGETS.find((t) => t.value === target)?.hint}</span>
        </div>

        <details className="campaign-form__advanced">
          <summary>Advanced: limit the batch</summary>
          <div className="campaign-form__advanced-fields">
            <div className="campaign-form__field">
              <span className="marketing__field-label">Skip</span>
              <input type="number" min={0} placeholder="0" value={skip} onChange={(event) => setSkip(event.target.value)} disabled={isLoading} />
            </div>
            <div className="campaign-form__field">
              <span className="marketing__field-label">Limit</span>
              <input type="number" min={0} placeholder="No limit" value={limit} onChange={(event) => setLimit(event.target.value)} disabled={isLoading} />
            </div>
          </div>
        </details>

        <div className="campaign-form__actions">
          <button type="submit" className="marketing__search" disabled={!canSend}>
            <Send size={15} strokeWidth={2} />
            {isLoading ? 'Sending…' : 'Send campaign'}
          </button>
          <button
            type="button"
            className="campaign-form__secondary"
            disabled={!canSend}
            onClick={(event: any) => send(event, { testMode: true })}
          >
            <FlaskConical size={14} strokeWidth={2} />
            Send test to myself
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendCampaign;
