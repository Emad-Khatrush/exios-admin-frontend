import { useEffect, useRef, useState } from 'react';
import { Alert, CircularProgress, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { Check, Copy, Download, Image as ImageIcon, Plane, QrCode, Send, Share2, Ship, X } from 'lucide-react';
import QRCode from 'qrcode.react';
import api from '../../api';
import { guideForShippingInChina } from '../../components/TransferOrdersList/readyTexts';
import { copyText } from '../../utils/copyText';
import { createShippingMarkImage, shareableMarkFile, ShippingMarkImage, ShippingMethod } from './shippingMarkImage';
import './ShippingMark.scss';

const WAREHOUSE_ADDRESS = `广东省佛山市南区里水镇洲村工业区一横路15号之三A
联系人/Contact person:
杨生:19700263771
备注(请认真阅读):（导航搜索：明都LOFT青年社区）`;
const DELIVERY_INSTRUCTIONS = `送货时间:周一至周六早上9点至下午6点，周日休息，(送货之前一定要提前电话联系)
空运货外箱需要套编织袋并注明“空运/BYAIR”及客户唛头，海运货(重货需套编织袋)并标注“海运/BYSEA”及客户唛头，仓库不提供卸货。
所有货物品牌货不收(如果不如实告知目送至此仓库地址，本公司不承担任何责任后果需供货商自负)，货物如带电需贴电池防火标，随货需装箱单一份(并且需
要发电子版给公司)。`;

export function ShippingMarkCard({ customerCode, onOpen }: { customerCode: string; onOpen: () => void }) {
  return <section className="sm-card" dir="rtl" aria-label="علامة الشحن وعنوان المستودع"><span className="sm-card-icon"><QrCode size={24} aria-hidden="true" /></span><div className="sm-card-copy"><h2>علامة الشحن وعنوان المستودع</h2><p>جهّز علامة العميل للشحن الجوي أو البحري، واحفظها أو شاركها مع البائع.</p></div><bdi className="sm-card-code" dir="ltr">{customerCode}</bdi><button className="sm-button sm-button--primary" type="button" onClick={onOpen}><Download size={16} aria-hidden="true" />تجهيز علامة الشحن</button></section>;
}

type Props = { user: any; onClose?: () => void; onBusyChange?: (busy: boolean) => void; initialMethod?: ShippingMethod; qrTargetId?: string; allowSendGuide?: boolean };
type Asset = ShippingMarkImage & { downloadUrl: string };

export default function ShippingMarkDialog({ user, onClose, onBusyChange, initialMethod = 'air', qrTargetId, allowSendGuide = true }: Props) {
  const [method, setMethod] = useState<ShippingMethod>(initialMethod);
  const [inspection, setInspection] = useState(false);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [generating, setGenerating] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const qrSource = useRef<HTMLDivElement>(null);
  const sendLock = useRef(false);
  const code = String(user?.customerId || '');
  const qrId = qrTargetId || user?._id;
  const address = `(Exios仓）(${code})${method}\n${WAREHOUSE_ADDRESS}`;
  const guide = guideForShippingInChina.replace(/\|fullName\|/g, () => String(user?.firstName || '')).replace(/\|customerId\|/g, () => code);
  const shareFile = asset ? shareableMarkFile(asset) : null;

  useEffect(() => { onBusyChange?.(sending || sharing); return () => onBusyChange?.(false); }, [sending, sharing, onBusyChange]);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setAsset(null); setGenerating(true); setError(''); setConfirmSend(false); setNotice('');
    const qr = qrSource.current?.querySelector('canvas');
    if (!qr || !qrId) { setError('بيانات العميل غير مكتملة. أعد فتح الملف وحاول مجددًا.'); setGenerating(false); return; }
    createShippingMarkImage({ customerCode: code, method, inspection, qr }).then(image => {
      if (!active) return;
      objectUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(image.blob) : null;
      setAsset({ ...image, downloadUrl: objectUrl || image.dataUrl });
      setGenerating(false);
    }).catch(() => { if (active) { setError('تعذر تجهيز صورة العلامة. تحقق من الاتصال وأعد المحاولة.'); setGenerating(false); } });
    return () => { active = false; if (objectUrl) { const url = objectUrl; setTimeout(() => URL.revokeObjectURL(url), 60_000); } };
  }, [code, qrId, method, inspection, revision]);

  const copy = async (text: string, key: string) => {
    try { await copyText(text); setCopied(key); setError(''); setNotice(key === 'address' ? 'تم نسخ عنوان المستودع' : 'تم نسخ دليل الشحن'); }
    catch { setError('تعذر النسخ التلقائي. يمكنك تحديد النص ونسخه يدويًا.'); }
  };
  const share = async () => {
    if (!shareFile || sharing) return;
    setSharing(true); setError('');
    try { await navigator.share({ files: [shareFile], title: `Exios ${code} · ${method}` }); }
    catch (failure: any) { if (failure?.name !== 'AbortError') setError('لم تكتمل المشاركة. استخدم تنزيل الصورة أو احفظها بالضغط المطوّل على المعاينة.'); }
    finally { setSharing(false); }
  };
  const sendGuide = async () => {
    if (sendLock.current || !user?.phone) return;
    sendLock.current = true; setSending(true); setError(''); setNotice('');
    try {
      const qr = qrSource.current?.querySelector('canvas');
      if (!qr) throw new Error('QR is unavailable');
      const images = await Promise.all((['air', 'sea'] as ShippingMethod[]).map(value => createShippingMarkImage({ customerCode: code, method: value, inspection, qr })));
      const phoneNumber = `${user.phone}@s.whatsapp.net`;
      const messageResult = await api.post('sendWhatsupMessage', { phoneNumber, message: guide });
      if (messageResult.data?.success === false) throw new Error(messageResult.data.message);
      const imageResult = await api.post('sendWhatsupImages', { phoneNumber, imgUrls: images.map(image => image.dataUrl) });
      if (imageResult.data?.success === false) throw new Error(imageResult.data.message);
      setNotice('تم إرسال الدليل وعلامتي الشحن الجوي والبحري للعميل.'); setConfirmSend(false);
    } catch (failure: any) {
      const message = failure?.response?.data?.message || failure?.message;
      setError(message === 'whatsup-auth-not-found' ? 'اربط واتساب بمسح رمز QR أولًا، ثم أعد الإرسال.' : 'تعذّر إكمال الإرسال. تحقّق من واتساب قبل إعادة المحاولة، فقد يكون جزء من الرسالة قد وصل.');
    } finally { sendLock.current = false; setSending(false); }
  };

  return <div className="sm-dialog" dir="rtl" aria-busy={sending}>
    <DialogTitle className="sm-title"><div><h2>علامة الشحن</h2><p>علامة جاهزة للطباعة · <bdi dir="ltr">{code}</bdi></p></div>{onClose && <IconButton aria-label="إغلاق علامة الشحن" onClick={onClose} disabled={sending || sharing}><X size={20} /></IconButton>}</DialogTitle>
    <DialogContent className="sm-content">
      <div className="sm-qr-source" aria-hidden="true" ref={qrSource}><QRCode value={`${window.location.origin}/shouldAllowToAccessApp?id=${qrId}`} size={256} includeMargin level="M" /></div>
      {error && <Alert severity="error" className="sm-alert">{error}{!asset && !generating && <button className="sm-text-button" type="button" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button>}</Alert>}
      {notice && <Alert severity="success" className="sm-alert" onClose={() => setNotice('')}>{notice}</Alert>}
      <div className="sm-workspace"><div className="sm-settings">
        <h3>طريقة الشحن</h3><div className="sm-methods" role="radiogroup" aria-label="طريقة الشحن">{(['air', 'sea'] as ShippingMethod[]).map(value => <button key={value} type="button" role="radio" aria-checked={method === value} disabled={sending || sharing} onClick={() => setMethod(value)} className={method === value ? 'is-active' : ''}>{value === 'air' ? <Plane size={18} aria-hidden="true" /> : <Ship size={18} aria-hidden="true" />}{value === 'air' ? 'شحن جوي' : 'شحن بحري'}{method === value && <Check size={14} aria-hidden="true" />}</button>)}</div>
        <label className="sm-inspection"><input type="checkbox" checked={inspection} disabled={sending || sharing} onChange={event => setInspection(event.target.checked)} /><span>إضافة «الفحص مطلوب» على العلامة</span></label>
        <div className="sm-address"><header><h3>عنوان المستودع</h3><button className="sm-text-button" type="button" onClick={() => void copy(address, 'address')}>{copied === 'address' ? <Check size={14} /> : <Copy size={14} />}نسخ العنوان</button></header><p className="sm-address-main" dir="ltr">{address}</p><details><summary>تعليمات ومواعيد التسليم</summary><p dir="ltr" className="sm-address-full">{DELIVERY_INSTRUCTIONS}</p></details></div>
        <details className="sm-guide"><summary>دليل الشحن للعميل</summary><textarea aria-label="دليل الشحن للعميل" rows={8} readOnly value={guide} /><button className="sm-text-button" type="button" onClick={() => void copy(guide, 'guide')}><Copy size={14} />نسخ الدليل</button></details>
      </div><div className="sm-preview"><header><span><ImageIcon size={15} aria-hidden="true" />معاينة الصورة</span><small>PNG · 900 × 1100</small></header>{generating ? <div className="sm-preview-loading" role="status"><CircularProgress size={24} /><p>جاري تجهيز العلامة…</p></div> : asset ? <><img src={asset.dataUrl} alt={`علامة شحن ${method === 'air' ? 'جوي' : 'بحري'} للعميل ${code}${inspection ? '، الفحص مطلوب' : ''}`} className="sm-label-image" /><p className="sm-save-hint">على الهاتف: يمكنك الضغط مطولًا على الصورة واختيار حفظ الصورة.</p></> : <div className="sm-preview-loading"><ImageIcon size={30} /><p>المعاينة غير متاحة</p></div>}</div></div>
      {confirmSend && <div className="sm-send-confirm" role="group" aria-label="تأكيد إرسال الدليل"><p>إرسال دليل الشحن وصورتي الجوي والبحري إلى واتساب العميل <bdi dir="ltr">{user?.phone}</bdi>؟</p><div><button className="sm-button sm-button--primary" type="button" onClick={() => void sendGuide()} disabled={sending}>{sending ? <CircularProgress size={16} color="inherit" /> : <Send size={15} />}تأكيد الإرسال</button><button className="sm-button" type="button" onClick={() => setConfirmSend(false)} disabled={sending}>إلغاء</button></div></div>}
    </DialogContent>
    <DialogActions className="sm-actions">{allowSendGuide && <button className="sm-button" type="button" onClick={() => { setError(''); setNotice(''); setConfirmSend(true); }} disabled={sending || generating || !asset || !user?.phone || sharing}><Send size={15} aria-hidden="true" />إرسال الدليل للعميل</button>}<div>{shareFile && <button className="sm-button" type="button" onClick={() => void share()} disabled={sending || sharing || generating}><Share2 size={15} aria-hidden="true" />{sharing ? 'جاري المشاركة…' : 'مشاركة الصورة'}</button>}{asset && !generating && !sending && !sharing ? <a className="sm-button sm-button--primary" href={asset.downloadUrl} download={asset.filename} target="_blank" rel="noopener noreferrer"><Download size={16} aria-hidden="true" />تنزيل العلامة</a> : <button className="sm-button sm-button--primary" type="button" disabled><Download size={16} aria-hidden="true" />تنزيل العلامة</button>}</div></DialogActions>
  </div>;
}
