import React, { useEffect } from 'react'

import { Alert, AlertColor, CircularProgress, FormControl, OutlinedInput, Snackbar } from "@mui/material";
import { useState } from "react";
import api from "../../api";
import CustomButton from '../CustomButton/CustomButton';

const defualtValue: any[] = [];

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

  const updateAnnouncements = async (event: MouseEvent) => {
    event.preventDefault();
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

  if (isFetching) {
    return (
      <CircularProgress />
    )
  }

  return (
    <div>
      <div className="mb-8 mt-4">
        <p className="text-base font-bold">
          Notification Client System
        </p>
      </div>

      <div>
        {announcements.length > 0 &&
          <div>
            <div>
              {announcements.map((announcement, i) => (
                <div key={announcement._id}>
                  <label> Announcement {i + 1}</label>
                  <div className="d-flex flex-row-reverse" style={{ width: '100%' }}>
                    {announcements.length !== 0 &&
                      <CustomButton
                        background='rgb(255, 88, 88)' 
                        size="small"
                        style={{ height: '60px' }}
                        onClick={(event: MouseEvent) => {
                          event.preventDefault();
                          deleteInput(announcement._id);
                        }}
                      >
                        Delete
                      </CustomButton>
                    }
                    <div className="m-0 mb-4" style={{ width: '100%' }}>
                      <FormControl fullWidth sx={{ m: 0, width: '100%' }}>
                        <OutlinedInput
                          id="announcement"
                          label="announcement"
                          name='announcement'
                          onChange={({ target }) => {
                            const foundAnnouncement = announcements.find(data => data._id === announcement._id);
                            if (foundAnnouncement) {
                              foundAnnouncement.description = target.value;
                            }
                            setAnnouncements([...announcements]);
                          }} 
                          style={{ width: '100%' }}
                          value={announcement?.description}
                          defaultValue={announcement?.description}
                        />
                      </FormControl>
                    </div>
                  </div>
                </div>
              ))}
            </div>
              <div className="col-md-12 mb-2 text-end">
                <CustomButton 
                  background='rgb(0, 171, 85)' 
                  size="small"
                  disabled={isLoading}
                  onClick={updateAnnouncements}
                >
                  Update Announcements
                </CustomButton>
            </div>
            <hr />
          </div>
        }

        {announcements.length < 2 &&
          <div>
            <form className="m-0 mb-4 mt-2" onSubmit={createAnnouncement} style={{ width: '100%' }}>
              <label htmlFor="announcement"> New Announcement</label>
              <FormControl required fullWidth sx={{ m: 0, width: '100%' }}>
                <OutlinedInput
                  id="announcement"
                  label="announcement"
                  name='announcement'
                  onChange={({ target }) => setNewAnnouncement({ description: target.value })} 
                  style={{ width: '100%' }}
                  defaultValue={newAnnouncement?.description || ''}
                  value={newAnnouncement?.description || ''}
                  required
                />
              </FormControl>

              <CustomButton
                className='mt-2'
                background='rgb(72, 167, 255)' 
                size="small"
              >
                Add Announcement
              </CustomButton>
            </form>
          </div>
        }
      </div>

      <Snackbar 
        open={!!alert.message} 
        autoHideDuration={1500}
        onClose={() => setAlert({ tint: 'success', message: ''})}
      >
        <Alert 
          severity={alert.tint as AlertColor}
          onClose={() => setAlert({ tint: 'success', message: ''})}
          style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default Announcements;
