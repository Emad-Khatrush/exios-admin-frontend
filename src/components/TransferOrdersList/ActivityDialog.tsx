import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import React, { useMemo, useRef, useState } from 'react'
import { countries, orderActions } from '../../containers/EditInvoice/EditInvoice';
import { acceptingPaymentAlertText, arrivedPackageDetails, arrivingGoodsToPortAlert, reminderToReceiveGoodsText } from './readyTexts';
import { calculateMinTotalPrice, replaceWords } from '../../utils/methods';
import api from '../../api';
import { useSelector } from 'react-redux';
import { Inventory } from '../../models';
import { CheckCircle2, ChevronDown, CircleAlert, History, MessageCircle, X } from 'lucide-react';

import './ActivityDialog.scss';

type Props = {
  // The packages selected in قائمة الجرد (one entry per package)
  checked: any
  setShowDialog: (value: boolean) => void
  inventory: Inventory
}

type Tab = 'activity' | 'whatsapp';

const TEMPLATES = [
  { key: 'arrived', label: 'وصلت ليبيا', text: arrivedPackageDetails },
  { key: 'reminder', label: 'تذكير للاستلام', text: reminderToReceiveGoodsText },
  { key: 'port', label: 'موعد وصول الحاوية', text: arrivingGoodsToPortAlert },
];

// Words the system fills in for each customer
const PLACEHOLDERS = [
  { key: 'fullName', label: 'اسم الزبون' },
  { key: 'ordersDetails', label: 'تفاصيل كل الطلبيات' },
  { key: 'orderId', label: 'أرقام الطلبيات' },
  { key: 'trackingNumber', label: 'أرقام التتبع' },
  { key: 'weight', label: 'اجمالي الوزن' },
  { key: 'exiosPrice', label: 'سعر الشحن' },
  { key: 'totalPrice', label: 'اجمالي قيمة الشحن' },
];
const KNOWN_PLACEHOLDERS = [...PLACEHOLDERS.map(p => p.key), 'noteForHandlingFeesInUSA'];

// Blanks in the templates that staff must fill in by hand before sending
const MANUAL_BLANKS = ['(رقم الحاوية)', '(تاريخ الرحلة)'];

// The API sends one message every 10 seconds
const SECONDS_PER_MESSAGE = 10;

const DEFAULT_PAYMENT_NOTICE = acceptingPaymentAlertText.trim();

type Recipient = { key: string, fullName: string, phone: string, message: string }

// Avoid floating point noise such as 0.30000000000000004, and drop needless ".00"
const cleanNumber = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

// "5 KG + 2 CBM" when a customer's packages use different units
const formatWeights = (weights: Map<string, number>) =>
  Array.from(weights.entries()).map(([unit, total]) => `${cleanNumber(total)} ${unit}`.trim()).join(' + ');

// One line of the message: one order, at one shipping price and unit
type OrderLine = {
  orderId: string
  trackingNumbers: string[]
  weight: number
  measureUnit: string
  exiosPrice: number
  total: number
}

// One message per customer. All their selected orders are listed in it, with one grand total,
// instead of a separate message for every order or price.
const buildRecipients = (packages: any[], template: string, inventory: Inventory) => {
  const customers = new Map<string, any[]>();
  let missingCustomer = 0;

  packages.forEach((order: any) => {
    if (!order?.user) {
      missingCustomer++;
      return;
    }
    const customerKey = String(order.user._id || order.user.customerId);
    if (!customers.has(customerKey)) customers.set(customerKey, []);
    customers.get(customerKey)!.push(order);
  });

  const recipients: Recipient[] = Array.from(customers.entries()).map(([key, customerPackages]) => {
    const first = customerPackages[0];

    // Packages of the same order (and same price and unit) become one line
    const lines = new Map<string, OrderLine>();
    customerPackages.forEach((order: any) => {
      const pkg = order.paymentList?.deliveredPackages || {};
      const measureUnit = pkg.weight?.measureUnit || '';
      const exiosPrice = Number(pkg.exiosPrice) || 0;
      const lineKey = `${order.orderId}_${exiosPrice}_${measureUnit}`;
      if (!lines.has(lineKey)) {
        lines.set(lineKey, { orderId: order.orderId, trackingNumbers: [], weight: 0, measureUnit, exiosPrice, total: 0 });
      }
      const line = lines.get(lineKey)!;
      if (pkg.trackingNumber) line.trackingNumbers.push(pkg.trackingNumber);
      line.weight += Number(pkg.weight?.total) || 0;
    });

    const orderLines = Array.from(lines.values());
    const weightsByUnit = new Map<string, number>();
    let grandTotal = 0;
    orderLines.forEach(line => {
      line.total = Number(calculateMinTotalPrice(line.exiosPrice, line.weight, inventory.shippedCountry, line.measureUnit));
      grandTotal += line.total;
      weightsByUnit.set(line.measureUnit, (weightsByUnit.get(line.measureUnit) || 0) + line.weight);
    });

    // Per order only its number and the tracking numbers that arrived; weight and cost are given
    // once as totals below the list. Lines of the same order (different prices) are merged here.
    const trackingByOrder = new Map<string, string[]>();
    orderLines.forEach(line => {
      trackingByOrder.set(line.orderId, [...(trackingByOrder.get(line.orderId) || []), ...line.trackingNumbers]);
    });
    const ordersDetails = Array.from(trackingByOrder.entries()).map(([orderId, trackingNumbers], index) => [
      `${index + 1}) الطلبية ${orderId}`,
      trackingNumbers.length > 0 ? `أرقام التتبع: ${trackingNumbers.join('، ')}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');

    const prices = Array.from(new Set(orderLines.map(line => cleanNumber(line.exiosPrice, 2))));

    return {
      key,
      fullName: first.customerInfo?.fullName || first.user?.customerId,
      phone: first.user?.phone ? String(first.user.phone) : '',
      message: replaceWords(template, {
        fullName: first.customerInfo?.fullName || '',
        ordersDetails,
        orderId: Array.from(new Set(orderLines.map(line => line.orderId))).join('، '),
        trackingNumber: orderLines.flatMap(line => line.trackingNumbers).join('، '),
        weight: formatWeights(weightsByUnit),
        exiosPrice: prices.join(' / '),
        totalPrice: cleanNumber(grandTotal, 2),
        noteForHandlingFeesInUSA: ['USA', 'UK'].includes(inventory.shippedCountry) ? 'ملاحظة: يوجد رسوم مناولة على كل شحنة لم تضف الى حسبة الاجمالية' : ''
      }),
    };
  });

  return { recipients, missingCustomer };
}

// Same rule as the API: shorter numbers are skipped there
const hasValidPhone = (recipient: Recipient) => recipient.phone.length >= 5;

const ActivityDialog = (props: Props) => {
  const packages: any[] = useMemo(() => props.checked || [], [props.checked]);
  const [tab, setTab] = useState<Tab>('activity');
  // Inserting |placeholders| into the message is for admins only
  const isAdmin = useSelector((state: any) => !!state.session?.account?.roles?.isAdmin);

  // WhatsApp
  const [message, setMessage] = useState('');
  const [templateKey, setTemplateKey] = useState<string>();
  const [includePaymentNotice, setIncludePaymentNotice] = useState(true);
  const [paymentNotice, setPaymentNotice] = useState(DEFAULT_PAYMENT_NOTICE);
  const [editingPaymentNotice, setEditingPaymentNotice] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean, text: string }>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Order activity
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activityResult, setActivityResult] = useState<{ ok: boolean, text: string }>();

  const { recipients, missingCustomer } = useMemo(
    () => buildRecipients(packages, message, props.inventory),
    [packages, message, props.inventory]
  );
  const reachable = recipients.filter(hasValidPhone);
  const withoutPhone = recipients.length - reachable.length;
  const sendPaymentNotice = includePaymentNotice && !!paymentNotice.trim();
  const messagesPerCustomer = sendPaymentNotice ? 2 : 1;
  const totalMessages = reachable.length * messagesPerCustomer;
  const etaMinutes = Math.ceil((Math.max(totalMessages - 1, 0) * SECONDS_PER_MESSAGE) / 60);

  const unfilledBlanks = MANUAL_BLANKS.filter(blank => message.includes(blank));
  const unknownPlaceholders = Array.from(new Set(
    Array.from(message.matchAll(/\|(\w+)\|/g)).map(match => match[1]).filter(word => !KNOWN_PLACEHOLDERS.includes(word))
  ));

  // Distinct orders: several selected packages can belong to the same order
  const uniqueOrders = useMemo(() => {
    const seen = new Map<string, any>();
    packages.forEach((order: any) => { if (order?._id && !seen.has(order._id)) seen.set(order._id, order); });
    return Array.from(seen.values());
  }, [packages]);

  const close = () => props.setShowDialog(false);

  const resetSendState = () => {
    setConfirming(false);
    setSendResult(undefined);
  }

  const pickTemplate = (key: string, text: string) => {
    setTemplateKey(key);
    setMessage(text.trim());
    resetSendState();
  }

  // Put |placeholder| where the cursor is, so it gets filled for each customer
  const insertPlaceholder = (key: string) => {
    const token = `|${key}|`;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? message.length;
    const end = textarea?.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    resetSendState();
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const sendWhatsappMessage = async () => {
    if (!message.trim() || reachable.length === 0) return;

    const contacts: { phoneNumber: string, message: string }[] = [];
    reachable.forEach(recipient => {
      contacts.push({ phoneNumber: recipient.phone, message: recipient.message });
      if (sendPaymentNotice) {
        contacts.push({ phoneNumber: recipient.phone, message: paymentNotice.trim() });
      }
    });

    try {
      setIsSending(true);
      setSendResult(undefined);
      await api.post(`inventorySendWhatsupMessages`, { data: contacts });
      setSendResult({
        ok: true,
        text: `تمت جدولة ${contacts.length} رسالة إلى ${reachable.length} زبون. تُرسل رسالة كل ${SECONDS_PER_MESSAGE} ثوانٍ${etaMinutes > 0 ? `، وتنتهي خلال حوالي ${etaMinutes} دقيقة` : ''}.`
      });
      setConfirming(false);
    } catch (err: any) {
      console.log(err);
      const apiMessage = err?.response?.data?.message;
      setSendResult({
        ok: false,
        text: apiMessage === 'whatsup-auth-not-found'
          ? 'واتساب غير متصل. امسح رمز QR من تطبيق واتساب أولاً ثم حاول مرة أخرى.'
          : (apiMessage || err?.message || 'تعذر إرسال الرسائل. حاول مرة أخرى.')
      });
      setConfirming(false);
    } finally {
      setIsSending(false);
    }
  }

  const submitNewActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    const activity = { country: location.trim(), description: description.trim() };
    if (!activity.country || !activity.description || uniqueOrders.length === 0) return;

    setIsAdding(true);
    setActivityResult(undefined);
    const results = await Promise.allSettled(
      uniqueOrders.map((order: any) => api.post(`order/${order._id}/addActivity`, activity))
    );
    const failed = results.filter(result => result.status === 'rejected').length;
    const added = results.length - failed;
    setIsAdding(false);

    if (failed === 0) {
      setActivityResult({ ok: true, text: `تمت إضافة التحديث إلى ${added} طلبية.` });
      setLocation('');
      setDescription('');
    } else {
      setActivityResult({
        ok: false,
        text: added > 0
          ? `تمت الإضافة إلى ${added} طلبية، وفشلت ${failed}. راجع هذه الطلبيات وحاول مرة أخرى.`
          : 'تعذرت إضافة التحديث. حاول مرة أخرى.'
      });
    }
  }

  const firstRecipient = reachable[0] || recipients[0];

  return (
    <div className="ad" dir="rtl">
      <div className="ad-head">
        <div>
          <h2>التواصل مع الزبائن</h2>
          <p>
            الشحنات المحددة: {packages.length}، الزبائن: {recipients.length}، الطلبيات: {uniqueOrders.length}
          </p>
        </div>
        <button type="button" className="ad-close" onClick={close} aria-label="إغلاق">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="ad-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>
          <History size={16} strokeWidth={2} />
          تحديث الطلبية
        </button>
        <button type="button" role="tab" aria-selected={tab === 'whatsapp'} onClick={() => setTab('whatsapp')}>
          <MessageCircle size={16} strokeWidth={2} />
          رسالة واتساب
        </button>
      </div>

      {tab === 'activity' ? (
        <form onSubmit={submitNewActivity}>
          <div className="ad-body">
            <div className="ad-note is-info">
              <CircleAlert size={16} strokeWidth={2} />
              <span>يُضاف تحديث إلى سجل تتبع كل طلبية محددة، ويظهر للزبون في صفحة تتبع طلبيته.</span>
            </div>

            <div className="ad-field">
              <label className="ad-label" htmlFor="ad-location">الموقع</label>
              <Autocomplete
                freeSolo
                options={countries}
                ListboxProps={{ style: { direction: 'rtl', textAlign: 'right' } }}
                inputValue={location}
                onInputChange={(_event, value) => { setLocation(value); setActivityResult(undefined); }}
                disabled={isAdding}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    id="ad-location"
                    size="small"
                    required
                    placeholder="مثال: الصين، طرابلس"
                  />
                )}
              />
              <span className="ad-hint">أين توجد الشحنة الآن.</span>
            </div>

            <div className="ad-field">
              <label className="ad-label" htmlFor="ad-description">نص التحديث</label>
              <Autocomplete
                freeSolo
                options={orderActions}
                ListboxProps={{ style: { direction: 'rtl', textAlign: 'right' } }}
                inputValue={description}
                onInputChange={(_event, value) => { setDescription(value); setActivityResult(undefined); }}
                disabled={isAdding}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    id="ad-description"
                    size="small"
                    required
                    multiline
                    placeholder="اختر تحديثاً جاهزاً أو اكتب نصاً جديداً"
                  />
                )}
              />
              <span className="ad-hint">اختر من القائمة أو اكتب نصك الخاص.</span>
            </div>

            {activityResult &&
              <div className={`ad-note ${activityResult.ok ? 'is-ok' : 'is-error'}`} role="status">
                {activityResult.ok ? <CheckCircle2 size={16} strokeWidth={2} /> : <CircleAlert size={16} strokeWidth={2} />}
                <span>{activityResult.text}</span>
              </div>
            }
          </div>

          <div className="ad-foot">
            <span>سيُضاف التحديث إلى {uniqueOrders.length} طلبية</span>
            <div>
              <button type="button" className="ad-btn is-ghost" onClick={close} disabled={isAdding}>
                {activityResult?.ok ? 'تم' : 'إلغاء'}
              </button>
              <button
                type="submit"
                className="ad-btn is-primary"
                disabled={isAdding || !location.trim() || !description.trim() || uniqueOrders.length === 0}
              >
                {isAdding ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'إضافة التحديث'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="ad-body">
            <div className="ad-field">
              <span className="ad-label">ابدأ من قالب جاهز</span>
              <div className="ad-chips">
                {TEMPLATES.map(template => (
                  <button
                    key={template.key}
                    type="button"
                    className={templateKey === template.key ? 'is-active' : undefined}
                    onClick={() => pickTemplate(template.key, template.text)}
                  >
                    {template.label}
                  </button>
                ))}
                <button type="button" onClick={() => pickTemplate('', '')}>رسالة فارغة</button>
              </div>
            </div>

            <div className="ad-field">
              <label className="ad-label" htmlFor="ad-message">نص الرسالة</label>
              <textarea
                id="ad-message"
                ref={textareaRef}
                className="ad-textarea"
                dir="rtl"
                placeholder="اكتب الرسالة هنا أو اختر قالباً من الأعلى"
                value={message}
                onChange={(e) => { setMessage(e.target.value); resetSendState(); }}
              />
              {isAdmin && (
                <>
                  <span className="ad-hint">اضغط لإدراج معلومة في مكان المؤشر، وتُملأ تلقائياً لكل زبون:</span>
                  <div className="ad-chips is-small">
                    {PLACEHOLDERS.map(placeholder => (
                      <button key={placeholder.key} type="button" onClick={() => insertPlaceholder(placeholder.key)}>
                        {placeholder.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {unfilledBlanks.length > 0 &&
              <div className="ad-note is-warn">
                <CircleAlert size={16} strokeWidth={2} />
                <span>اكتب {unfilledBlanks.join(' و ')} داخل الرسالة قبل الإرسال، فهذه لا تُملأ تلقائياً.</span>
              </div>
            }

            {unknownPlaceholders.length > 0 &&
              <div className="ad-note is-warn">
                <CircleAlert size={16} strokeWidth={2} />
                <span>
                  <bdi>{unknownPlaceholders.map(word => `|${word}|`).join('، ')}</bdi> ليست معلومة معروفة، وستُرسل كما هي.
                </span>
              </div>
            }

            <div className="ad-field">
              <label className="ad-check">
                <input
                  type="checkbox"
                  checked={includePaymentNotice}
                  onChange={(e) => { setIncludePaymentNotice(e.target.checked); resetSendState(); }}
                />
                <div>
                  <strong>إرسال رسالة تنبيه الدفع أيضاً</strong>
                  <span>رسالة ثانية لكل زبون عن فئات الدولار المقبولة والدفع بالدولار.</span>
                </div>
              </label>

              {includePaymentNotice && (
                editingPaymentNotice ? (
                  <>
                    <div className="ad-row">
                      <label className="ad-label" htmlFor="ad-payment-notice">نص رسالة تنبيه الدفع</label>
                      <button
                        type="button"
                        className="ad-link-btn"
                        onClick={() => { setPaymentNotice(DEFAULT_PAYMENT_NOTICE); resetSendState(); }}
                        disabled={paymentNotice === DEFAULT_PAYMENT_NOTICE}
                      >
                        استعادة النص الأصلي
                      </button>
                    </div>
                    <textarea
                      id="ad-payment-notice"
                      className="ad-textarea is-short"
                      dir="rtl"
                      value={paymentNotice}
                      onChange={(e) => { setPaymentNotice(e.target.value); resetSendState(); }}
                    />
                    <span className="ad-hint">التعديل لهذه الإرسالية فقط، ولا يغيّر النص الأصلي.</span>
                    <button type="button" className="ad-link-btn" style={{ justifySelf: 'start' }} onClick={() => setEditingPaymentNotice(false)}>
                      إخفاء
                    </button>
                  </>
                ) : (
                  <button type="button" className="ad-link-btn" style={{ justifySelf: 'start' }} onClick={() => setEditingPaymentNotice(true)}>
                    عرض وتعديل رسالة الدفع{paymentNotice !== DEFAULT_PAYMENT_NOTICE ? ' (معدّلة)' : ''}
                  </button>
                )
              )}
            </div>

            {message.trim() && firstRecipient &&
              <details className="ad-preview">
                <summary>
                  معاينة الرسالة كما تصل إلى {firstRecipient.fullName}
                  <ChevronDown size={16} strokeWidth={2} />
                </summary>
                <span className="ad-preview-label">الرسالة الأولى</span>
                <div className="ad-preview-text" dir="rtl">{firstRecipient.message.trim()}</div>
                {sendPaymentNotice &&
                  <>
                    <span className="ad-preview-label">الرسالة الثانية: تنبيه الدفع</span>
                    <div className="ad-preview-text" dir="rtl">{paymentNotice.trim()}</div>
                  </>
                }
              </details>
            }

            {(withoutPhone > 0 || missingCustomer > 0) &&
              <div className="ad-note is-warn">
                <CircleAlert size={16} strokeWidth={2} />
                <span>
                  {withoutPhone > 0 && `عدد الزبائن بدون رقم هاتف: ${withoutPhone}، ولن تُرسل لهم رسائل. `}
                  {missingCustomer > 0 && `عدد الشحنات غير المرتبطة بزبون: ${missingCustomer}، وسيتم تجاوزها.`}
                </span>
              </div>
            }

            {sendResult &&
              <div className={`ad-note ${sendResult.ok ? 'is-ok' : 'is-error'}`} role="status">
                {sendResult.ok ? <CheckCircle2 size={16} strokeWidth={2} /> : <CircleAlert size={16} strokeWidth={2} />}
                <span>{sendResult.text}</span>
              </div>
            }
          </div>

          <div className="ad-foot">
            <span>
              {confirming
                ? `إرسال ${totalMessages} رسالة إلى ${reachable.length} زبون؟`
                : `عدد الزبائن: ${reachable.length}، ${messagesPerCustomer === 2 ? 'رسالتان لكل زبون' : 'رسالة واحدة لكل زبون'}`}
            </span>
            <div>
              {confirming ? (
                <>
                  <button type="button" className="ad-btn is-ghost" onClick={() => setConfirming(false)} disabled={isSending}>رجوع</button>
                  <button type="button" className="ad-btn is-primary" onClick={sendWhatsappMessage} disabled={isSending}>
                    {isSending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'نعم، أرسل الآن'}
                  </button>
                </>
              ) : sendResult?.ok ? (
                <button type="button" className="ad-btn is-primary" onClick={close}>تم</button>
              ) : (
                <>
                  <button type="button" className="ad-btn is-ghost" onClick={close}>إلغاء</button>
                  <button
                    type="button"
                    className="ad-btn is-primary"
                    onClick={() => setConfirming(true)}
                    disabled={!message.trim() || reachable.length === 0}
                  >
                    <MessageCircle size={16} strokeWidth={2} />
                    إرسال الرسالة
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ActivityDialog;
