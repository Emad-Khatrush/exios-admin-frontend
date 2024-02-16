import React, { useState } from 'react'
import CustomButton from '../CustomButton/CustomButton';
import { AiOutlinePlus } from 'react-icons/ai';
import DebtsTable from './DebtsTable';
import { Dialog } from '@mui/material';
import CreateDebtDialog from './CreateDebtDialog'

type Props = {}

const DebtsPage = (props: Props) => {
  const [dialog, setDialog] = useState<any>({
    customComponentTag: undefined,
    isOpen: false,
    item: undefined
  })

  const Tag = dialog.customComponentTag;

  return (
    <>
      <div className="col-12 mb-4 text-end">
        <CustomButton
          background='rgb(0, 171, 85)' 
          size="small" 
          icon={<AiOutlinePlus />}
          onClick={() => setDialog({ customComponentTag: CreateDebtDialog, isOpen: true })}
        >
          Add New Debt
        </CustomButton>
      </div>

      <DebtsTable 
        setDialog={(state: any) => setDialog({ ...state })}
      />

      <Dialog fullWidth open={dialog.isOpen}>
        {dialog.customComponentTag &&
          <Tag
            setDialog={(state: any) => setDialog({ ...state })}
            item={dialog.item}
          />
        }
      </Dialog>
    </>
  )
}

export default DebtsPage;
