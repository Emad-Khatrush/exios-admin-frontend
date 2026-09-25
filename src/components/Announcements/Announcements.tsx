import React, { useEffect } from 'react'

import { Alert, AlertColor, OutlinedInput, Snackbar } from "@mui/material";
import { ArrowLeft, Loader2, Megaphone, Plus, Trash2 } from 'lucide-react';
import { useState } from "react";
import { Link } from 'react-router-dom';
import api from "../../api";
import '../../containers/Settings/SettingsCommon.scss';
import './Announcements.scss';

const defualtValue: any[] = [];
const MAX_ANNOUNCEMENTS = 2;

const Announcements = () => {

  const [announcements, setAnnouncements] = useState(defualtValue);
  const [newAnnouncement, setNewAnnouncement] = useState<{ description?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [alert, setAlert] = useState({
    tint: 'success',
    message: ''
  });

  useEffect(() => {
    getAnnouncements()
  }, [])

  const getAnnouncements = async () => {
    try {
      setIsFetching(true);
      const response = await api.get('announcements');
      setAnnouncements(response.data);
    } catch (error) {
      console.log(error);
    }
    setIsFetching(false);
  }

  const createAnnouncement = async (event: any) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      await api.post('announcements', newAnnouncement);
      setAlert({
        message: 'Announcement created',
        tint: 'success'
      });
      const response = await api.get('announcements');
      setNewAnnouncement({});
      setAnnouncements(response.data);
    } catch (error) {
      console.log(error);
      setAlert({
        message: 'حدث خطا اثنا انشاء الاشعار',
        tint: 'error'
      });
    }
    setIsLoading(false);
  }

  const deleteInput = async (_id: string) => {
    try {
      setIsLoading(true);
      await api.delete('announcements', { _id });
      setAlert({
        message: 'Announcement deleted',
        tint: 'success'
      });
      const response = await api.get('announcements');
      setNewAnnouncement({});
      setAnnouncements(response.data);
    } catch (error) {
      console.log(error);
      setAlert({
        message: 'حدث خطا اثنا انشاء الاشعار',
        tint: 'error'
      });
    }
    setIsLoading(false);
  }

  const updateAnnouncements = async () => {
    try {
      setIsLoading(true);
      await api.update('announcements', announcements);
      setAlert({
        message: 'Announcements has been updated',
        tint: 'success'
      });
    } catch (error) {
      console.log(error);
      setAlert({
        message: 'حدث خطا اثناء انشاء العملية',
        tint: 'error'
      });
    }
    setIsLoading(false);
  }

  return (
    <div className="settings-page announcements">
      <Link to="/settings" className="settings-page__back"><ArrowLeft size={15} /> Back to Settings</Link>
      <div className="settings-page__header">
        <div className="settings-page__title">
          <span className="settings-page__icon"><Megaphone size={20} strokeWidth={2} /></span>
          <div>
            <h1>Announcements</h1>
            <p>Short notices shown to customers in the app. Up to {MAX_ANNOUNCEMENTS} at a time.</p>
          </div>
        </div>
        {!isFetching && (
          <span className="ann-count">{announcements.length} of {MAX_ANNOUNCEMENTS}</span>
        )}
      </div>

      <section className="settings-panel">
      <div className="settings-panel__body">
        {isFetching ? (
          <div className="ann-list" aria-busy="true">
            <div className="settings-skeleton ann-skeleton" />
            <div className="settings-skeleton ann-skeleton" />
          </div>
        ) : (
          <>
            {announcements.length > 0 ? (
              <div className="ann-list">
                {announcements.map((announcement, i) => (
                  <div key={announcement._id} className="ann-row">
                    <span className="ann-row__index">{i + 1}</span>
                    <OutlinedInput
                      className="ann-row__input"
                      size="small"
                      multiline
                      inputProps={{ 'aria-label': `Announcement ${i + 1}` }}
                      onChange={({ target }) => {
                        const foundAnnouncement = announcements.find(data => data._id === announcement._id);
                        if (foundAnnouncement) {
                          foundAnnouncement.description = target.value;
                        }
                        setAnnouncements([...announcements]);
                      }}
                      value={announcement?.description || ''}
                    />
                    <button
                      type="button"
                      className="settings-btn settings-btn--icon settings-btn--danger"
                      aria-label={`Delete announcement ${i + 1}`}
                      disabled={isLoading}
                      onClick={() => deleteInput(announcement._id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="settings-empty">
                <strong>No announcements</strong>
                <p>Write one below and customers will see it in the app.</p>
              </div>
            )}

            {announcements.length < MAX_ANNOUNCEMENTS && (
              <form className="ann-new" onSubmit={createAnnouncement}>
                <div className="settings-field">
                  <label htmlFor="new-announcement">New announcement</label>
                  <OutlinedInput
                    id="new-announcement"
                    name="announcement"
                    size="small"
                    placeholder="What should customers know?"
                    onChange={({ target }) => setNewAnnouncement({ description: target.value })}
                    value={newAnnouncement?.description || ''}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="settings-btn settings-btn--ghost"
                  disabled={isLoading || !newAnnouncement?.description?.trim()}
                >
                  <Plus size={16} />
                  Add
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {!isFetching && announcements.length > 0 && (
        <div className="settings-panel__foot">
          <p className="settings-panel__hint">Edits above are saved together.</p>
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            disabled={isLoading}
            onClick={updateAnnouncements}
          >
            {isLoading && <Loader2 size={15} className="settings-spin" />}
            Save announcements
          </button>
        </div>
      )}
      </section>

      <Snackbar
        open={!!alert.message}
        autoHideDuration={1500}
        onClose={() => setAlert({ tint: 'success', message: ''})}
      >
        <Alert
          severity={alert.tint as AlertColor}
          onClose={() => setAlert({ tint: 'success', message: ''})}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default Announcements;
