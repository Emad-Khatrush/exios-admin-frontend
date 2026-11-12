import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import MovieOutlined from '@mui/icons-material/MovieOutlined';
import AudioFileOutlined from '@mui/icons-material/AudioFileOutlined';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import { convertGoogleStorageUrl } from '../../utils/methods';
import api from '../../api';
import './FileViewer.scss';

// One viewer for every uploaded file in the panel: it reads the file's type (from what was saved
// at upload, or the name's extension) and shows images, PDFs, video and audio in place; anything
// else gets a file card to open or download, never a broken image.
type Kind = 'image' | 'pdf' | 'video' | 'audio' | 'sheet' | 'doc' | 'other';

const EXT: Record<string, Kind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', avif: 'image', heic: 'image',
  pdf: 'pdf', mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', doc: 'doc', docx: 'doc', txt: 'doc',
};
const ICONS: Record<Kind, any> = {
  image: ImageOutlined, pdf: PictureAsPdfOutlined, video: MovieOutlined, audio: AudioFileOutlined,
  sheet: TableChartOutlined, doc: DescriptionOutlined, other: InsertDriveFileOutlined,
};
const KIND_LABEL: Record<Kind, string> = {
  image: 'صورة', pdf: 'ملف PDF', video: 'فيديو', audio: 'ملف صوتي', sheet: 'جدول بيانات', doc: 'مستند', other: 'ملف',
};

type ViewerFile = { url: string; name: string; kind: Kind; ext: string; size: string };

const extOf = (value = '') => (value.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();

function kindOf(type = '', ext = ''): Kind {
  const t = type.toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (/sheet|excel|csv/.test(t)) return 'sheet';
  if (/word|text\/plain/.test(t)) return 'doc';
  return EXT[ext] || 'other';
}

function sizeOf(bytes: any) {
  const n = Number(bytes);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function toViewerFile(file: any): ViewerFile {
  const raw = typeof file === 'string' ? { path: file } : file || {};
  const url = convertGoogleStorageUrl(raw.path || raw.url || '');
  const name = raw.filename || raw.name || decodeURIComponent(url.split('?')[0].split('/').pop() || 'ملف');
  const ext = extOf(name) || extOf(url);
  return { url, name, ext, kind: kindOf(raw.fileType || raw.mimetype || raw.type, ext), size: sizeOf(raw.bytes || raw.size) };
}

const save = (href: string, name?: string) => {
  const a = Object.assign(document.createElement('a'), { href, rel: 'noopener', ...(name && { download: name }) });
  document.body.appendChild(a); a.click(); a.remove();
};

// The storage does not let the page read its files (no CORS), so the server gives a short link that
// says "attachment": the browser saves the file and stays on the page. A file from elsewhere is
// read directly when it allows it; only if both fail does it open in a new tab.
async function download(file: ViewerFile) {
  try {
    const res = await api.get('files/download-url', { url: file.url, name: file.name });
    if (res?.data?.url) return save(res.data.url);
  } catch { /* not one of our files: try reading it directly */ }
  try {
    const blob = await (await fetch(file.url)).blob();
    const href = URL.createObjectURL(blob);
    save(href, file.name);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(file.url, '_blank', 'noopener');
  }
}

function FileCard({ file, note }: { file: ViewerFile; note?: string }) {
  const Icon = ICONS[file.kind];
  return (
    <div className="fv-card">
      <span className={`fv-card__icon is-${file.kind}`}><Icon /></span>
      <div className="fv-card__name" dir="auto">{file.name}</div>
      <div className="fv-card__meta">{[file.ext.toUpperCase() || KIND_LABEL[file.kind], file.size].filter(Boolean).join(' · ')}</div>
      {note && <div className="fv-card__note">{note}</div>}
      <div className="fv-card__actions">
        <button type="button" className="fv-btn fv-btn--primary" onClick={() => download(file)}><FileDownloadOutlined fontSize="small" /> تحميل</button>
        <a className="fv-btn" href={file.url} target="_blank" rel="noopener noreferrer"><OpenInNewRounded fontSize="small" /> فتح في نافذة</a>
      </div>
    </div>
  );
}

function Stage({ file }: { file: ViewerFile }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => { setState('loading'); setZoomed(false); }, [file.url]);

  if (!file.url) return <FileCard file={file} note="لا يوجد رابط لهذا الملف." />;
  if (file.kind === 'image') {
    if (state === 'error') return <FileCard file={file} note="تعذّر عرض الصورة هنا. افتحها في نافذة أو حمّلها." />;
    return (
      <div className={`fv-image ${zoomed ? 'is-zoomed' : ''}`} onClick={() => state === 'ready' && setZoomed(z => !z)}>
        {state === 'loading' && <div className="fv-skeleton" />}
        <img src={file.url} alt={file.name} className={state === 'ready' ? 'is-ready' : ''}
          onLoad={() => setState('ready')} onError={() => setState('error')} />
      </div>
    );
  }
  if (file.kind === 'pdf') {
    return (
      <div className="fv-frame">
        {state === 'loading' && <div className="fv-skeleton fv-skeleton--page" />}
        <iframe title={file.name} src={`${file.url}#view=FitH`} onLoad={() => setState('ready')} className={state === 'ready' ? 'is-ready' : ''} />
      </div>
    );
  }
  if (file.kind === 'video') {
    if (state === 'error') return <FileCard file={file} note="المتصفح لا يعرض هذا الفيديو. حمّله لمشاهدته." />;
    return <video className="fv-media" src={file.url} controls playsInline onError={() => setState('error')} />;
  }
  if (file.kind === 'audio') {
    return <div className="fv-audio"><FileCard file={file} /><audio src={file.url} controls /></div>;
  }
  return <FileCard file={file} note="لا يمكن معاينة هذا النوع داخل النظام." />;
}

type Props = { open: boolean; files?: any[]; onClose: () => void; startIndex?: number };

export default function FileViewer({ open, files, onClose, startIndex = 0 }: Props) {
  const items = useMemo(() => (files || []).filter(Boolean).map(toViewerFile), [files]);
  const [index, setIndex] = useState(startIndex);
  useEffect(() => { if (open) setIndex(Math.min(startIndex, Math.max(items.length - 1, 0))); }, [open, startIndex, items.length]);

  const count = items.length;
  const go = useCallback((step: number) => setIndex(i => (count ? (i + step + count) % count : 0)), [count]);

  // Arrows follow the reading direction: in Arabic the next file is to the left
  useEffect(() => {
    if (!open || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(1);
      if (e.key === 'ArrowRight') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, count, go]);

  const file = items[index];
  return (
    <Dialog open={open && !!count} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ className: 'fv' }}>
      {file && (
        <div className="fv__shell" dir="rtl">
          <header className="fv__bar">
            <div className="fv__title">
              <span className={`fv__badge is-${file.kind}`}>{React.createElement(ICONS[file.kind], { fontSize: 'small' })}</span>
              <div className="fv__names">
                <div className="fv__name" dir="auto" title={file.name}>{file.name}</div>
                <div className="fv__sub">{KIND_LABEL[file.kind]}{file.size && <> · <bdi>{file.size}</bdi></>}</div>
              </div>
            </div>
            <div className="fv__tools">
              {count > 1 && <bdi className="fv__count">{index + 1} / {count}</bdi>}
              <Tooltip title="تحميل"><IconButton className="fv__icon" onClick={() => download(file)}><FileDownloadOutlined /></IconButton></Tooltip>
              <Tooltip title="فتح في نافذة جديدة"><IconButton className="fv__icon" component="a" href={file.url} target="_blank" rel="noopener noreferrer"><OpenInNewRounded /></IconButton></Tooltip>
              <Tooltip title="إغلاق"><IconButton className="fv__icon" onClick={onClose}><CloseRounded /></IconButton></Tooltip>
            </div>
          </header>

          <main className="fv__stage">
            <div className="fv__slide" key={`${index}:${file.url}`}><Stage file={file} /></div>
            {count > 1 && <>
              <button type="button" className="fv__nav fv__nav--prev" aria-label="السابق" onClick={() => go(-1)}><ChevronRightRounded /></button>
              <button type="button" className="fv__nav fv__nav--next" aria-label="التالي" onClick={() => go(1)}><ChevronLeftRounded /></button>
            </>}
          </main>

          {count > 1 && (
            <nav className="fv__strip" aria-label="الملفات">
              {items.map((item, i) => (
                <button type="button" key={`${i}:${item.url}`} className={`fv__thumb ${i === index ? 'is-active' : ''}`} onClick={() => setIndex(i)} title={item.name}>
                  {item.kind === 'image'
                    ? <img src={item.url} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                    : <span className={`fv__thumb-icon is-${item.kind}`}>{React.createElement(ICONS[item.kind])}<em>{item.ext || 'file'}</em></span>}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}
    </Dialog>
  );
}
