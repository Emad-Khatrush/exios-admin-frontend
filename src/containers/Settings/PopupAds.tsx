import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, OutlinedInput, Snackbar } from '@mui/material';
import { ArrowLeft, Eye, Loader2, Megaphone, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { POPUP_AD_ICON_COMPONENTS, POPUP_AD_ICONS, PopupAdIcon } from '../../constants/popupAdIcons';
import { PopupAd, PopupAdViewer } from '../../models';
import './SettingsCommon.scss';
import './PopupAds.scss';

type FormState = {
  description: string
  imageUrl: string
  icon: PopupAdIcon
  startDate: string
  endDate: string
}

const emptyForm: FormState = {
  description: '',
  imageUrl: '',
  icon: 'megaphone',
  startDate: '',
  endDate: '',
};

const STATUS_LABEL: Record<PopupAd['status'], string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  expired: 'Expired',
};

const toDateInput = (value?: string) => value ? value.substring(0, 10) : '';

const PopupAds = () => {
  const [ads, setAds] = useState<PopupAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<PopupAd | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [alert, setAlert] = useState<{ open: boolean, message: string, type: 'success' | 'error' }>({ open: false, message: '', type: 'success' });

  const [viewersAd, setViewersAd] = useState<PopupAd | null>(null);
  const [viewers, setViewers] = useState<PopupAdViewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const res = await api.get('popupAds');
      setAds(res.data);
    } catch (err) {
      setAlert({ open: true, message: 'Failed to fetch popup ads', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (ad?: PopupAd) => {
    setFormError('');
    if (ad) {
      setEditingAd(ad);
      setForm({
        description: ad.description,
        imageUrl: ad.imageUrl || '',
        icon: (ad.icon as PopupAdIcon) || 'megaphone',
        startDate: toDateInput(ad.startDate),
        endDate: toDateInput(ad.endDate),
      });
    } else {
      setEditingAd(null);
      setForm(emptyForm);
    }
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      setFormError('Write what the popup should say.');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setFormError('Choose a start and end date.');
      return;
    }
    if (form.endDate < form.startDate) {
      setFormError('The end date must be after the start date.');
      return;
    }

    const payload = {
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
      icon: form.icon,
      startDate: form.startDate,
      endDate: form.endDate,
    };

    try {
      setIsSaving(true);
      setFormError('');
      if (editingAd) {
        await api.update(`popupAds/${editingAd._id}`, payload);
        setAlert({ open: true, message: 'Popup ad updated', type: 'success' });
      } else {
        await api.post('popupAds', payload);
        setAlert({ open: true, message: 'Popup ad created', type: 'success' });
      }
      fetchAds();
      handleClose();
    } catch (err: any) {
      setFormError(err?.data?.message || 'Could not save this popup ad');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`popupAds/${id}`, {});
      setAlert({ open: true, message: 'Popup ad deleted', type: 'success' });
      fetchAds();
    } catch (err) {
      setAlert({ open: true, message: 'Error deleting popup ad', type: 'error' });
    }
  };

  const openViewers = async (ad: PopupAd) => {
    setViewersAd(ad);
    setViewers([]);
    try {
      setViewersLoading(true);
      const res = await api.get(`popupAds/${ad._id}/viewers`);
      setViewers(res.data);
    } catch (err) {
      setAlert({ open: true, message: 'Failed to fetch who viewed this ad', type: 'error' });
    } finally {
      setViewersLoading(false);
    }
  };

  const closeViewers = () => setViewersAd(null);

  const SelectedIcon = POPUP_AD_ICON_COMPONENTS[form.icon];

  return (
    <div className="settings-page popup-ads">
      <Link to="/settings" className="settings-page__back"><ArrowLeft size={15} /> Back to Settings</Link>
      <div className="settings-page__header">
        <div className="settings-page__title">
          <span className="settings-page__icon"><Megaphone size={20} strokeWidth={2} /></span>
          <div>
            <h1>Popup ads</h1>
            <p>Full-screen announcements customers must acknowledge before they can keep using the app.</p>
          </div>
        </div>
        <button type="button" className="settings-btn settings-btn--primary" onClick={() => handleOpen()}>
          <Plus size={16} />
          New popup ad
        </button>
      </div>

      <section className="settings-panel">
        <div className="settings-panel__body">
          {loading ? (
            <div className="pa-list" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="settings-skeleton pa-skeleton" />)}
            </div>
          ) : ads.length === 0 ? (
            <div className="settings-empty">
              <strong>No popup ads yet</strong>
              <p>Use New popup ad to show your first announcement to customers.</p>
            </div>
          ) : (
            <ul className="pa-list">
              {ads.map((ad) => {
                const Icon = POPUP_AD_ICON_COMPONENTS[(ad.icon as PopupAdIcon) || 'megaphone'];
                return (
                  <li key={ad._id} className="pa-ad">
                    <div className="pa-ad__media">
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt="" />
                      ) : (
                        <span className="pa-ad__icon"><Icon size={22} strokeWidth={2} /></span>
                      )}
                    </div>
                    <div className="pa-ad__main">
                      <div className="pa-ad__title-row">
                        <span className={`pa-chip pa-chip--${ad.status}`}>{STATUS_LABEL[ad.status]}</span>
                        <button type="button" className="pa-views" onClick={() => openViewers(ad)}>
                          <Eye size={13} strokeWidth={2} />
                          {ad.viewCount} {ad.viewCount === 1 ? 'view' : 'views'}
                        </button>
                      </div>
                      <p className="pa-ad__description">{ad.description}</p>
                      <p className="pa-ad__dates">
                        {new Date(ad.startDate).toLocaleDateString()} to {new Date(ad.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="pa-ad__actions">
                      <button
                        type="button"
                        className="settings-btn settings-btn--icon"
                        aria-label="Edit popup ad"
                        onClick={() => handleOpen(ad)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--icon settings-btn--danger"
                        aria-label="Delete popup ad"
                        onClick={() => handleDelete(ad._id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ className: 'pa-dialog' }}>
        <DialogTitle className="pa-dialog__title">{editingAd ? 'Edit popup ad' : 'New popup ad'}</DialogTitle>
        <DialogContent className="pa-dialog__form">
          <div className="settings-field">
            <label htmlFor="pa-description">Description</label>
            <OutlinedInput
              id="pa-description"
              multiline
              minRows={3}
              placeholder="What should customers see?"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="pa-visual">
            <p className="pa-visual__label">Photo or icon</p>
            <div className="settings-field">
              <label htmlFor="pa-image">Photo link</label>
              <OutlinedInput
                id="pa-image"
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
              />
            </div>

            {form.imageUrl.trim() ? (
              <div className="pa-preview">
                <img src={form.imageUrl} alt="Preview" />
              </div>
            ) : (
              <>
                <p className="pa-visual__hint">No photo? Pick an icon to show instead.</p>
                <div className="pa-icon-grid">
                  {POPUP_AD_ICONS.map((key) => {
                    const IconOption = POPUP_AD_ICON_COMPONENTS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`pa-icon-swatch ${form.icon === key ? 'pa-icon-swatch--active' : ''}`}
                        aria-label={key}
                        aria-pressed={form.icon === key}
                        onClick={() => setForm((prev) => ({ ...prev, icon: key }))}
                      >
                        <IconOption size={18} strokeWidth={2} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="pa-dialog__row">
            <div className="settings-field">
              <label htmlFor="pa-start">Start date</label>
              <OutlinedInput
                id="pa-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="pa-end">End date</label>
              <OutlinedInput
                id="pa-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="pa-live-preview">
            <p className="pa-visual__label">Preview</p>
            <div className="pa-live-preview__card">
              <div className="pa-live-preview__media">
                {form.imageUrl.trim() ? (
                  <img src={form.imageUrl} alt="" />
                ) : (
                  <SelectedIcon size={30} strokeWidth={1.75} />
                )}
              </div>
              <p>{form.description.trim() || 'Your announcement text will appear here.'}</p>
            </div>
          </div>

          {formError && <Alert severity="error">{formError}</Alert>}
        </DialogContent>
        <DialogActions className="pa-dialog__actions">
          <button type="button" className="settings-btn settings-btn--ghost" onClick={handleClose}>Cancel</button>
          <button type="button" className="settings-btn settings-btn--primary" disabled={isSaving} onClick={handleSubmit}>
            {isSaving && <Loader2 size={15} className="settings-spin" />}
            {editingAd ? 'Save changes' : 'Publish'}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!viewersAd} onClose={closeViewers} maxWidth="xs" fullWidth PaperProps={{ className: 'pa-dialog' }}>
        <DialogTitle className="pa-dialog__title">Who viewed this ad</DialogTitle>
        <DialogContent className="pa-viewers">
          {viewersAd && <p className="pa-viewers__description">{viewersAd.description}</p>}

          {viewersLoading ? (
            <div className="pa-viewers__list" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="settings-skeleton pa-viewers__skeleton" />)}
            </div>
          ) : viewers.length === 0 ? (
            <div className="settings-empty">
              <strong>No one has viewed this yet</strong>
              <p>The list fills in as customers acknowledge the popup.</p>
            </div>
          ) : (
            <ul className="pa-viewers__list">
              {viewers.map((viewer, i) => (
                <li key={viewer.user?._id || i} className="pa-viewers__row">
                  <span className="pa-viewers__avatar"><UserRound size={15} strokeWidth={2} /></span>
                  <div className="pa-viewers__info">
                    <span className="pa-viewers__name">
                      {viewer.user ? `${viewer.user.firstName} ${viewer.user.lastName}` : 'Deleted account'}
                    </span>
                    <span className="pa-viewers__meta">
                      {viewer.user?.customerId ? `#${viewer.user.customerId}` : ''}
                      {viewer.user?.customerId && viewer.user?.phone ? ' · ' : ''}
                      {viewer.user?.phone || ''}
                    </span>
                  </div>
                  <span className="pa-viewers__date">
                    {new Date(viewer.viewedAt).toLocaleDateString()} {new Date(viewer.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
        <DialogActions className="pa-dialog__actions">
          <button type="button" className="settings-btn settings-btn--ghost" onClick={closeViewers}>Close</button>
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

export default PopupAds;
