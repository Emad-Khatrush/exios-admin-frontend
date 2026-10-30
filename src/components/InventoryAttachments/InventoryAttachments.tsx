import { CircularProgress, Dialog } from '@mui/material';
import { Download, Eye, FileText, LockKeyhole, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { base } from '../../api';
import './InventoryAttachments.scss';

export type FileVisibility = 'staff' | 'management';
export const InventoryVisibilityPicker = ({ value, onChange, disabled, label = 'File visibility' }: {
  value: FileVisibility; onChange: (value: FileVisibility) => void; disabled?: boolean; label?: string;
}) => <label className="inventory-files__permission"><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value as FileVisibility)}><option value="staff">All staff</option><option value="management">Admin &amp; accountant only</option></select></label>;

type Props = {
  files: any[]; inventoryId?: string; pending?: boolean; canManage: boolean; disabled?: boolean;
  onVisibilityChange?: (file: any, visibility: FileVisibility) => void | Promise<void>;
  onDelete?: (file: any) => void | Promise<void>;
};
const idOf = (file: any) => file._id || file.filename;
const nameOf = (file: any) => file.originalName || file.name || file.filename || 'Attachment';
const sizeOf = (file: any) => {
  const bytes = Number(file.bytes || file.size || 0);
  return bytes > 0 ? bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB` : '';
};

const InventoryAttachments = ({ files, inventoryId, pending, canManage, disabled, onVisibilityChange, onDelete }: Props) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview.url); }; }, [preview]);
  const act = async (key: string, action: () => void | Promise<void>) => {
    if (busy || disabled) return;
    setBusy(key); setError('');
    try { await action(); }
    catch (err: any) { setError(err?.response?.data?.message || err?.message || 'Unable to update or open this file. Please try again.'); }
    finally { setBusy(null); }
  };
  const open = async (file: any, showPreview: boolean) => {
    let blob: Blob;
    if (pending && file instanceof File) blob = file;
    else {
      const response = await base.axios.get(`inventory/${inventoryId}/attachments/${encodeURIComponent(idOf(file))}/content`, {
        responseType: 'blob', headers: { authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      blob = new Blob([response.data], { type: file.fileType || 'application/octet-stream' });
    }
    const url = URL.createObjectURL(blob);
    if (showPreview) { setPreview({ url, name: nameOf(file) }); return; }
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = nameOf(file); anchor.rel = 'noopener'; anchor.target = '_blank';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return <div className="inventory-files">
    {error && <p className="inventory-files__error" role="alert">{error}</p>}
    {files.length === 0 ? <p className="inventory-files__empty">No files attached.</p> : <ul>
      {files.map((file, index) => {
        const key = String(idOf(file) || index);
        const restricted = file.visibility === 'management';
        const type = file.fileType || file.type || '';
        return <li key={key}>
          <FileText size={20} className="inventory-files__icon" aria-hidden="true" />
          <div className="inventory-files__details"><strong title={nameOf(file)}>{nameOf(file)}</strong><small>{sizeOf(file)}{sizeOf(file) && ' · '}{restricted ? <LockKeyhole size={12} /> : <Users size={12} />}{restricted ? 'Admin & accountant only' : 'All staff'}{pending && ' · Pending upload'}</small></div>
          {canManage && onVisibilityChange && <InventoryVisibilityPicker value={file.visibility || 'staff'} label={`Visibility: ${nameOf(file)}`} disabled={!!busy || disabled} onChange={visibility => { void act(key, () => onVisibilityChange(file, visibility)); }} />}
          <div className="inventory-files__actions">
            {busy === key && <CircularProgress size={16} />}
            {/^(image\/(jpeg|png|gif|webp|avif|bmp))$/i.test(type) && <button type="button" aria-label={`Preview ${nameOf(file)}`} title="Preview" disabled={!!busy || disabled} onClick={() => { void act(key, () => open(file, true)); }}><Eye size={16} /></button>}
            <button type="button" aria-label={`Download ${nameOf(file)}`} title="Download" disabled={!!busy || disabled} onClick={() => { void act(key, () => open(file, false)); }}><Download size={16} /></button>
            {onDelete && <button type="button" aria-label={`Remove ${nameOf(file)}`} title="Remove" className="is-danger" disabled={!!busy || disabled} onClick={() => { if (pending || window.confirm(`Delete "${nameOf(file)}"?`)) void act(key, () => onDelete(file)); }}><Trash2 size={16} /></button>}
          </div>
        </li>;
      })}
    </ul>}
    <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
      <div className="inventory-files__preview"><header><strong>{preview?.name}</strong><button type="button" aria-label="Close preview" onClick={() => setPreview(null)}><X size={19} /></button></header>{preview && <img src={preview.url} alt={preview.name} />}</div>
    </Dialog>
  </div>;
};
export default InventoryAttachments;
