import React, { useState } from 'react'
import DebtsTable from './DebtsTable';
import { Alert, Dialog, Snackbar } from '@mui/material';
import CreateDebtDialog from './CreateDebtDialog'

import './Debts.scss';

type Props = {}

const DebtsPage = (props: Props) => {
  const [dialog, setDialog] = useState<any>({
    customComponentTag: undefined,
    isOpen: false,
    item: undefined,
    onSaved: undefined
  })
  const [toast, setToast] = useState<string>();

  const Tag = dialog.customComponentTag;

  // Close the dialog, refresh the list in place and confirm, instead of reloading the page
  const onDialogSaved = (message: string) => {
    const refresh = dialog.onSaved;
    setDialog({ customComponentTag: undefined, isOpen: false });
    setToast(message);
    refresh?.();
  }

  return (
    <div className="col-12 debts-page">
      <DebtsTable
        setDialog={(state: any) => setDialog({ ...state })}
        onCreateDebt={() => setDialog({ customComponentTag: CreateDebtDialog, isOpen: true })}
      />

      <Dialog
        fullWidth
        maxWidth="sm"
        open={dialog.isOpen}
        onClose={() => setDialog({ customComponentTag: undefined, isOpen: false })}
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        {dialog.customComponentTag &&
          <Tag
            setDialog={(state: any) => setDialog({ ...state })}
            item={dialog.item}
            onSaved={dialog.onSaved ? onDialogSaved : undefined}
          />
        }
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setToast(undefined)}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(undefined)} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default DebtsPage;
