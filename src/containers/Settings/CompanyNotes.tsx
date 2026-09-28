import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, OutlinedInput, Snackbar } from '@mui/material';
import { ArrowLeft, ExternalLink, File, FileImage, FileSpreadsheet, FileText, FolderLock, Loader2, Paperclip, Pencil, Pin, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { CompanyNote, CompanyNoteFile } from '../../models';
import './SettingsCommon.scss';
import './CompanyNotes.scss';

type FormState = {
  title: string
  content: string
  isPinned: boolean
}

const emptyForm: FormState = { title: '', content: '', isPinned: false };

const isImage = (file: CompanyNoteFile) => !!file.fileType?.startsWith('image/');
const isPdf = (file: CompanyNoteFile) => file.fileType === 'application/pdf';

const getFileIcon = (file: CompanyNoteFile) => {
  if (isImage(file)) return FileImage;
  if (isPdf(file) || file.fileType?.includes('word') || file.fileType?.startsWith('text/')) return FileText;
  if (file.fileType?.includes('sheet') || file.fileType?.includes('excel') || file.fileType === 'text/csv') return FileSpreadsheet;
  return File;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const CompanyNotes = () => {
  const [notes, setNotes] = useState<CompanyNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [alert, setAlert] = useState<{ open: boolean, message: string, type: 'success' | 'error' }>({ open: false, message: '', type: 'success' });

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<CompanyNoteFile | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CompanyNote | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const showAlert = (message: string, type: 'success' | 'error' = 'success') => setAlert({ open: true, message, type });

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await api.get('companyNotes');
      setNotes(res.data);
    } catch (err) {
      showAlert('Failed to fetch company notes', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Keep pinned first, then most recently updated, like the API does.
  const upsertNote = (note: CompanyNote) => {
    setNotes((prev) => {
      const next = [note, ...prev.filter((n) => n._id !== note._id)];
      return next.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt));
    });
  };

  const viewingNote = notes.find((n) => n._id === viewingId) || null;

  const query = search.trim().toLowerCase();
  const filteredNotes = query
    ? notes.filter((note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.files.some((file) => file.name?.toLowerCase().includes(query)))
    : notes;

  const openEditor = (note?: CompanyNote) => {
    setFormError('');
    setNewFiles([]);
    setEditingNote(note || null);
    setForm(note ? { title: note.title, content: note.content, isPinned: note.isPinned } : emptyForm);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!isSaving) setEditorOpen(false);
  };

  const handlePickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    setNewFiles((prev) => [...prev, ...picked]);
    event.target.value = '';
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setFormError('Give the note a title.');
      return;
    }

    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('content', form.content);
    formData.append('isPinned', String(form.isPinned));
    newFiles.forEach((file) => formData.append('files', file));

    setIsSaving(true);
    setFormError('');
    const res = editingNote
      ? await api.fetchFormData(`companyNotes/${editingNote._id}`, 'PUT', formData)
      : await api.fetchFormData('companyNotes', 'POST', formData);
    setIsSaving(false);

    if (!res?._id) {
      setFormError(res?.message || 'Could not save this note');
      return;
    }

    upsertNote(res);
    setEditorOpen(false);
    showAlert(editingNote ? 'Note updated' : 'Note added');
  };

  const handleTogglePin = async (note: CompanyNote) => {
    const formData = new FormData();
    formData.append('isPinned', String(!note.isPinned));
    const res = await api.fetchFormData(`companyNotes/${note._id}`, 'PUT', formData);
    if (res?._id) {
      upsertNote(res);
    } else {
      showAlert('Could not update this note', 'error');
    }
  };

  const handleDeleteNote = async (note: CompanyNote) => {
    if (!window.confirm(`Delete "${note.title}" and all its files? This cannot be undone.`)) return;
    try {
      await api.delete(`companyNotes/${note._id}`, {});
      setNotes((prev) => prev.filter((n) => n._id !== note._id));
      setViewingId(null);
      showAlert('Note deleted');
    } catch (err) {
      showAlert('Error deleting note', 'error');
    }
  };

  const handleDeleteFile = async (note: CompanyNote, file: CompanyNoteFile) => {
    if (!window.confirm(`Delete the file "${file.name}"?`)) return;
    try {
      const res = await api.delete(`companyNotes/${note._id}/files/${file._id}`, {});
      upsertNote(res.data);
      if (editingNote?._id === note._id) setEditingNote(res.data);
      showAlert('File deleted');
    } catch (err) {
      showAlert('Error deleting file', 'error');
    }
  };

  const renderFileRow = (note: CompanyNote, file: CompanyNoteFile, onOpen?: () => void) => {
    const Icon = getFileIcon(file);
    return (
      <li key={file._id} className="cn-file">
        <button type="button" className="cn-file__open" onClick={onOpen} disabled={!onOpen}>
          {isImage(file) ? (
            <img className="cn-file__thumb" src={file.path} alt="" />
          ) : (
            <span className="cn-file__icon"><Icon size={18} strokeWidth={2} /></span>
          )}
          <span className="cn-file__text">
            <span className="cn-file__name">{file.name}</span>
            <span className="cn-file__meta">
              {[formatSize(file.size), formatDate(file.uploadedAt)].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
        <a
          className="settings-btn settings-btn--icon"
          href={file.path}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${file.name} in a new tab`}
        >
          <ExternalLink size={16} />
        </a>
        <button
          type="button"
          className="settings-btn settings-btn--icon settings-btn--danger"
          aria-label={`Delete ${file.name}`}
          onClick={() => handleDeleteFile(note, file)}
        >
          <Trash2 size={16} />
        </button>
      </li>
    );
  };

  return (
    <div className="settings-page company-notes">
      <Link to="/settings" className="settings-page__back"><ArrowLeft size={15} /> Back to Settings</Link>
      <div className="settings-page__header">
        <div className="settings-page__title">
          <span className="settings-page__icon"><FolderLock size={20} strokeWidth={2} /></span>
          <div>
            <h1>Company notes</h1>
            <p>Important notes and company files, visible to admins only.</p>
          </div>
        </div>
        <button type="button" className="settings-btn settings-btn--primary" onClick={() => openEditor()}>
          <Plus size={16} />
          New note
        </button>
      </div>

      <section className="settings-panel">
        <div className="settings-panel__head">
          <div className="cn-search">
            <Search size={16} className="cn-search__icon" />
            <input
              type="search"
              placeholder="Search notes and file names"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search notes"
            />
          </div>
          <p className="settings-panel__hint">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</p>
        </div>
        <div className="settings-panel__body">
          {loading ? (
            <div className="cn-grid" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="settings-skeleton cn-skeleton" />)}
            </div>
          ) : notes.length === 0 ? (
            <div className="settings-empty">
              <strong>No notes yet</strong>
              <p>Use New note to save an important note or upload company files.</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="settings-empty">
              <strong>Nothing matches "{search}"</strong>
              <p>Try a different word, or clear the search.</p>
            </div>
          ) : (
            <ul className="cn-grid">
              {filteredNotes.map((note) => (
                <li key={note._id}>
                  <button type="button" className={`cn-card ${note.isPinned ? 'cn-card--pinned' : ''}`} onClick={() => setViewingId(note._id)}>
                    <span className="cn-card__title-row">
                      {note.isPinned && <Pin size={14} className="cn-card__pin" aria-label="Pinned" />}
                      <span className="cn-card__title">{note.title}</span>
                    </span>
                    {note.content && <span className="cn-card__content">{note.content}</span>}
                    <span className="cn-card__meta">
                      {note.files.length > 0 && (
                        <span className="cn-card__files"><Paperclip size={13} /> {note.files.length}</span>
                      )}
                      <span>Updated {formatDate(note.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* View a note */}
      <Dialog open={!!viewingNote} onClose={() => setViewingId(null)} maxWidth="md" fullWidth PaperProps={{ className: 'cn-dialog' }}>
        {viewingNote && (
          <>
            <DialogTitle className="cn-dialog__title">
              <span>{viewingNote.title}</span>
              <span className="cn-dialog__title-actions">
                <button
                  type="button"
                  className={`settings-btn settings-btn--icon ${viewingNote.isPinned ? 'cn-pin--active' : ''}`}
                  aria-label={viewingNote.isPinned ? 'Unpin note' : 'Pin note'}
                  aria-pressed={viewingNote.isPinned}
                  onClick={() => handleTogglePin(viewingNote)}
                >
                  <Pin size={16} />
                </button>
                <button type="button" className="settings-btn settings-btn--icon" aria-label="Edit note" onClick={() => openEditor(viewingNote)}>
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="settings-btn settings-btn--icon settings-btn--danger"
                  aria-label="Delete note"
                  onClick={() => handleDeleteNote(viewingNote)}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </DialogTitle>
            <DialogContent className="cn-view">
              <p className="cn-view__meta">
                Updated {formatDate(viewingNote.updatedAt)}
                {viewingNote.createdBy ? ` · Added by ${viewingNote.createdBy.firstName} ${viewingNote.createdBy.lastName}` : ''}
              </p>
              {viewingNote.content
                ? <div className="cn-view__content">{viewingNote.content}</div>
                : <p className="cn-view__empty">No text in this note.</p>}

              {viewingNote.files.length > 0 && (
                <div className="cn-view__files">
                  <p className="cn-label">Files ({viewingNote.files.length})</p>
                  <ul className="cn-files">
                    {viewingNote.files.map((file) => renderFileRow(viewingNote, file, () => setPreviewFile(file)))}
                  </ul>
                </div>
              )}
            </DialogContent>
            <DialogActions className="cn-dialog__actions">
              <button type="button" className="settings-btn settings-btn--ghost" onClick={() => setViewingId(null)}>Close</button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Preview a file */}
      <Dialog open={!!previewFile} onClose={() => setPreviewFile(null)} maxWidth="lg" fullWidth PaperProps={{ className: 'cn-dialog cn-preview-dialog' }}>
        {previewFile && (
          <>
            <DialogTitle className="cn-dialog__title">
              <span className="cn-preview-dialog__name">{previewFile.name}</span>
              <span className="cn-dialog__title-actions">
                <a className="settings-btn settings-btn--icon" href={previewFile.path} target="_blank" rel="noreferrer" aria-label="Open in a new tab">
                  <ExternalLink size={16} />
                </a>
                <button type="button" className="settings-btn settings-btn--icon" aria-label="Close preview" onClick={() => setPreviewFile(null)}>
                  <X size={16} />
                </button>
              </span>
            </DialogTitle>
            <DialogContent className="cn-preview">
              {isImage(previewFile) ? (
                <img src={previewFile.path} alt={previewFile.name} />
              ) : isPdf(previewFile) ? (
                <iframe src={previewFile.path} title={previewFile.name} />
              ) : (
                <div className="settings-empty">
                  <strong>No preview for this file type</strong>
                  <p>Open it in a new tab to view or download it.</p>
                  <a className="settings-btn settings-btn--primary" href={previewFile.path} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} /> Open file
                  </a>
                </div>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Create / edit a note */}
      <Dialog open={editorOpen} onClose={closeEditor} maxWidth="sm" fullWidth PaperProps={{ className: 'cn-dialog' }}>
        <DialogTitle className="cn-dialog__title">{editingNote ? 'Edit note' : 'New note'}</DialogTitle>
        <DialogContent className="cn-form">
          <div className="settings-field">
            <label htmlFor="cn-title">Title</label>
            <OutlinedInput
              id="cn-title"
              placeholder="e.g. Company license, Bank accounts"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="cn-content">Note</label>
            <OutlinedInput
              id="cn-content"
              multiline
              minRows={5}
              placeholder="Write the details you want to keep"
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            />
          </div>

          <label className="cn-checkbox">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm((prev) => ({ ...prev, isPinned: e.target.checked }))}
            />
            Pin to the top
          </label>

          <div className="cn-upload">
            <p className="cn-label">Files</p>

            {editingNote && editingNote.files.length > 0 && (
              <ul className="cn-files">
                {editingNote.files.map((file) => renderFileRow(editingNote, file))}
              </ul>
            )}

            {newFiles.length > 0 && (
              <ul className="cn-files">
                {newFiles.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="cn-file cn-file--new">
                    <span className="cn-file__open">
                      <span className="cn-file__icon"><Upload size={16} strokeWidth={2} /></span>
                      <span className="cn-file__text">
                        <span className="cn-file__name">{file.name}</span>
                        <span className="cn-file__meta">{formatSize(file.size)} · uploads on save</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      className="settings-btn settings-btn--icon settings-btn--danger"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input ref={fileInputRef} type="file" multiple hidden onChange={handlePickFiles} />
            <button type="button" className="cn-dropzone" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={16} />
              Attach files (PDF, images, documents · up to 25 MB each)
            </button>
          </div>

          {formError && <Alert severity="error">{formError}</Alert>}
        </DialogContent>
        <DialogActions className="cn-dialog__actions">
          <button type="button" className="settings-btn settings-btn--ghost" onClick={closeEditor} disabled={isSaving}>Cancel</button>
          <button type="button" className="settings-btn settings-btn--primary" disabled={isSaving} onClick={handleSubmit}>
            {isSaving && <Loader2 size={15} className="settings-spin" />}
            {editingNote ? 'Save changes' : 'Save note'}
          </button>
        </DialogActions>
      </Dialog>

      <Snackbar open={alert.open} autoHideDuration={3000} onClose={() => setAlert({ ...alert, open: false })}>
        <Alert severity={alert.type} sx={{ width: '100%' }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default CompanyNotes;
