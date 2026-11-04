import { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Button } from '@mui/material';
import { ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon, X } from 'lucide-react';
import { convertGoogleStorageUrl } from '../../utils/methods';
import './TrackingImages.scss';

export type TrackingImage = { _id?: string; path: string; filename?: string; fileType?: string };
const isDocument = (image: TrackingImage) => /pdf/i.test(image.fileType || '') || /\.pdf(?:[?#]|$)/i.test(image.path);

// `previews`: how many thumbnails load in the strip; the rest are counted and load only when opened.
// `iconOnly`: no thumbnail at all — an icon and the count; nothing downloads until it is opened
// (long lists such as inventory trips, where the photos are full-size originals).
export default function TrackingImages({ images = [], label, previews = 2, iconOnly = false }: { images?: TrackingImage[]; label: string; previews?: number; iconOnly?: boolean }) {
  const files = images.filter(image => image?.path);
  const [selected, setSelected] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!files.length) return null;
  const current = selected === null ? null : files[Math.min(selected, files.length - 1)];
  return <>
    {iconOnly ? <button className="xt-image-chip" type="button" aria-label={`فتح ${label} — ${files.length} ${files.length === 1 ? 'صورة' : 'صور'}`} onClick={() => setSelected(0)}>
      <ImageIcon size={14} aria-hidden="true" /><span dir="ltr">{files.length}</span>
    </button> :
    <div className="xt-image-strip" role="group" aria-label={label}>
      {files.slice(0, previews).map((image, index) => <button className="xt-image-button" type="button" key={image._id || `${image.path}:${index}`}
        aria-label={`فتح ${label} — صورة ${index + 1} من ${files.length}`} onClick={() => setSelected(index)}>
        <span className="xt-image-circle"><ImageIcon size={15} aria-hidden="true" />{!isDocument(image) && <img src={convertGoogleStorageUrl(image.path)} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} />}</span>
      </button>)}
      {files.length > previews && <button className="xt-image-button xt-image-more" type="button" aria-label={`عرض بقية ${label} — ${files.length} صور`} onClick={() => setSelected(previews)}><span className="xt-image-circle" dir="ltr">+{files.length - previews}</span></button>}
    </div>}
    <Dialog open={!!current} onClose={() => setSelected(null)} fullWidth maxWidth="md" aria-label={label}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }} dir="rtl">
        <span>{label}</span><IconButton aria-label="إغلاق الصور" onClick={() => setSelected(null)}><X size={20} /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ textAlign: 'center', minHeight: 180 }}>
        {current && (isDocument(current) || failed === current.path ? <p dir="rtl">{isDocument(current) ? 'يمكنك فتح الملف من الرابط أدناه.' : 'تعذر عرض الصورة. يمكنك فتح الملف الأصلي أو الانتقال إلى الصورة التالية.'}</p> :
          <img key={current.path} src={convertGoogleStorageUrl(current.path)} alt={`${label} — صورة ${(selected || 0) + 1}`} onError={() => setFailed(current.path)} style={{ display: 'block', maxWidth: '100%', maxHeight: '65vh', margin: 'auto', objectFit: 'contain' }} />)}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <div dir="ltr"><IconButton aria-label="الصورة السابقة" disabled={selected === null || selected <= 0} onClick={() => setSelected(value => Math.max(0, (value || 0) - 1))}><ChevronLeft /></IconButton>
          <span aria-live="polite">{(selected || 0) + 1} / {files.length}</span>
          <IconButton aria-label="الصورة التالية" disabled={selected === null || selected >= files.length - 1} onClick={() => setSelected(value => Math.min(files.length - 1, (value || 0) + 1))}><ChevronRight /></IconButton></div>
        {current && <Button component="a" href={convertGoogleStorageUrl(current.path)} target="_blank" rel="noopener noreferrer" endIcon={<ExternalLink size={16} />}>فتح الملف الأصلي</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
