import { Dialog } from '@mui/material';
import { ChevronLeft, ChevronRight, Download, ExternalLink, File, FileImage, FileSpreadsheet, FileText, Plane, Ship, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { convertGoogleStorageUrl } from '../../utils/methods';

// Shared by the shipments list and the flight board.

export const TYPE_META = {
  air: { label: 'Air', icon: Plane },
  sea: { label: 'Sea', icon: Ship },
  domestic: { label: 'Domestic', icon: Truck },
};

export const formatWeight = (kg: number, cbm: number) => {
  const parts = [];
  if (kg) parts.push(`${kg.toLocaleString('en-US', { maximumFractionDigits: 1 })} KG`);
  if (cbm) parts.push(`${cbm.toLocaleString('en-US', { maximumFractionDigits: 2 })} CBM`);
  return parts.join(' · ') || 'No weight yet';
};

export const Progress = ({ done, total }: { done: number, total: number }) => {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="ivl-progress" title={`${done} of ${total} delivered to customers`}>
      <div className="ivl-progress__track">
        <div className={`ivl-progress__bar ${percent === 100 ? 'is-done' : ''}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="ivl-progress__text"><strong>{done}</strong>/{total} delivered</span>
    </div>
  );
};

// ---------- Attachments ----------

export type Attachment = {
  _id?: string
  path: string
  fileType?: string
  description?: string
};

type FileKind = 'image' | 'pdf' | 'sheet' | 'doc' | 'other';

const extensionOf = (path: string) => (path.split('?')[0].split('.').pop() || '').toLowerCase();

// Older uploads have no fileType, so fall back to the file extension.
export const fileKind = (file: Attachment): FileKind => {
  const type = (file.fileType || '').toLowerCase();
  const ext = extensionOf(file.path || '');
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'avif'].includes(ext)) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.includes('sheet') || type.includes('excel') || type === 'text/csv' || ['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (type.includes('word') || type.startsWith('text/') || ['doc', 'docx', 'txt'].includes(ext)) return 'doc';
  return 'other';
};

const KIND_ICON: Record<FileKind, typeof File> = {
  image: FileImage,
  pdf: FileText,
  sheet: FileSpreadsheet,
  doc: FileText,
  other: File,
};

const KIND_LABEL: Record<FileKind, string> = {
  image: 'Photo',
  pdf: 'PDF',
  sheet: 'Spreadsheet',
  doc: 'Document',
  other: 'File',
};

// Uploaded names are "<10 random chars><original name>"; show something readable.
export const fileName = (file: Attachment) => {
  if (file.description) return file.description;
  const raw = decodeURIComponent((file.path || '').split('?')[0].split('/').pop() || '');
  return raw.length > 14 ? raw.slice(10) : raw || 'File';
};

export const fileUrl = (file: Attachment) => convertGoogleStorageUrl(file.path);

// Small square: the photo itself, or an icon for any other file
export const AttachmentThumb = ({ file, className = '' }: { file: Attachment, className?: string }) => {
  const kind = fileKind(file);
  if (kind === 'image') return <img className={className} src={fileUrl(file)} alt="" loading="lazy" />;
  const Icon = KIND_ICON[kind];
  return (
    <span className={`ivl-file-icon ivl-file-icon--${kind} ${className}`}>
      <Icon size={18} strokeWidth={1.8} />
    </span>
  );
};

// Full viewer: photos shown large, PDFs inline, anything else as a file card with Open/Download.
export const AttachmentViewer = ({ files, onClose }: { files: Attachment[] | null, onClose: () => void }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [files]);

  const list = files || [];
  const current = list[index];
  const count = list.length;
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  useEffect(() => {
    if (!files || count < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (event.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files, count]);

  const kind = current ? fileKind(current) : 'other';
  const Icon = KIND_ICON[kind];

  return (
    <Dialog open={!!files && count > 0} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ className: 'ivl-viewer' }}>
      {current && (
        <>
          <header className="ivl-viewer__head">
            <div className="ivl-viewer__title">
              <strong title={fileName(current)}>{fileName(current)}</strong>
              <span>{KIND_LABEL[kind]}{count > 1 ? ` · ${index + 1} of ${count}` : ''}</span>
            </div>
            <a className="inv-icon-btn" href={fileUrl(current)} target="_blank" rel="noreferrer" aria-label="Open in a new tab" title="Open in a new tab">
              <ExternalLink size={16} />
            </a>
            <a className="inv-icon-btn" href={fileUrl(current)} download aria-label="Download" title="Download">
              <Download size={16} />
            </a>
            <button type="button" className="inv-icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>

          <div className="ivl-viewer__stage">
            {kind === 'image' ? (
              <img src={fileUrl(current)} alt={fileName(current)} />
            ) : kind === 'pdf' ? (
              <iframe src={fileUrl(current)} title={fileName(current)} />
            ) : (
              <div className="ivl-viewer__file">
                <span className={`ivl-file-icon ivl-file-icon--${kind} ivl-file-icon--large`}>
                  <Icon size={40} strokeWidth={1.5} />
                </span>
                <strong>{fileName(current)}</strong>
                <p>This file type can't be previewed here.</p>
                <a className="inv-btn is-primary" href={fileUrl(current)} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} /> Open file
                </a>
              </div>
            )}

            {count > 1 && (
              <>
                <button type="button" className="ivl-viewer__nav is-prev" onClick={() => go(-1)} aria-label="Previous file">
                  <ChevronLeft size={20} />
                </button>
                <button type="button" className="ivl-viewer__nav is-next" onClick={() => go(1)} aria-label="Next file">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {count > 1 && (
            <div className="ivl-viewer__strip">
              {list.map((file, i) => (
                <button
                  key={file._id || i}
                  type="button"
                  className={`ivl-viewer__thumb ${i === index ? 'is-active' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${fileName(file)}`}
                  aria-current={i === index}
                >
                  <AttachmentThumb file={file} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
};
