import { Avatar, AvatarGroup, Button, ClickAwayListener, Dialog, DialogActions, DialogContent, Grid, Stack, TextField, Tooltip } from "@mui/material"
import { useState } from "react"
import { FaRegQuestionCircle } from "react-icons/fa"
import CustomButton from "../../components/CustomButton/CustomButton"
import LocalizationProvider from "@mui/lab/LocalizationProvider"
import AdapterDateFns from "@mui/lab/AdapterDateFns"
import DatePicker from "@mui/lab/DatePicker"
import api from "../../api"
import { useParams } from "react-router-dom"
import moment from "moment"
import SwipeableTextMobileStepper from "../../components/SwipeableTextMobileStepper/SwipeableTextMobileStepper"

type Props = {
  title: string
  description: any
  footer: string
  total: string
  color?: 'danger' | 'success'
  tootipInfo?: string
  showVerifyButton?: boolean
  statement: any
}

const PaymentDetails = (props: Props) => {
  const { description, title, footer, color, total, tootipInfo, showVerifyButton, statement } = props;

  const { id } = useParams();

  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [receivedDate, setReceivedDate] = useState(new Date());
  const [previewImages, setPreviewImages] = useState<any>(undefined);

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  const verifyPayment = async () => {
    try {
      setIsLoading(true);
      await api.post(`user/${id}/statement/${statement._id}`, { receivedDate });
      window.location.reload();
      setDialog(false);
      setIsLoading(false);
    } catch (error) {
      console.log(error);
    }
  };


  return (
    <div>
      <CustomButton 
        background='rgb(0, 171, 85)' 
        size="small"
        disabled={!showVerifyButton}
        onClick={() => setDialog(true)}
      >
        {showVerifyButton ? 'Verify Payment' : `Verified at ${moment(statement?.review?.receivedDate).format('DD/MM/YYYY')}`}
      </CustomButton>
      
      <div className="d-flex justify-content-between" style={{ direction: 'rtl' }}>
        <div className="d-flex gap-3 align-items-center">
          <h5 style={{ fontSize: '16px', color: color === 'danger' ? '#c72205' : '#069612' }} className="m-0">{title}</h5>
          <p style={{ fontSize: '16px', color: color === 'danger' ? '#c72205' : '#069612' }} className="m-0" dangerouslySetInnerHTML={{ __html: description }} />
          {tootipInfo &&
            <span>
              <Grid item>
                <ClickAwayListener onClickAway={handleTooltipClose}>
                  <div>
                    <Tooltip
                      PopperProps={{
                        disablePortal: true,
                      }}
                      onClose={handleTooltipClose}
                      open={open}
                      disableFocusListener
                      disableHoverListener
                      disableTouchListener
                      title={tootipInfo}
                    >
                      <Button onClick={handleTooltipOpen}><FaRegQuestionCircle /></Button>
                    </Tooltip>
                  </div>
                </ClickAwayListener>
              </Grid>
            </span>
          }
          {statement?.attachments?.length > 0 && 
            <AvatarGroup style={{ borderColor: 'black' }} max={3}>
              {statement?.attachments.map((img: any) => (
                <Avatar
                  style={{ cursor: 'pointer' }}
                  key={img.filename}
                  alt={img.filename} 
                  src={img.path}
                  onClick={() => setPreviewImages(statement.attachments)}
                />
              ))}
            </AvatarGroup>
          }
        </div>
        <p className="m-0" style={{ color: color === 'danger' ? '#c72205' : '#069612', minWidth: '50px' }}>{footer}</p>
        <p className="m-0" style={{ minWidth: '50px' }}>{total}</p>
      </div>

      <hr style={{ color: '#b7b7b7' }} />

      <Dialog 
        open={dialog}
        onClose={() => setDialog(false)}
      >
        <DialogContent>
          <p style={{ direction: 'rtl' }}>الرجاء التاكد من ان القيمة قد دخلت في الحسبة ثم قم بادخال في اي يوم تم ادخالها</p>
          <p style={{ direction: 'rtl' }}>ايضا قم بالتاكد سبب اضافة دين او استعماله وان يكون مطابق وصحيح</p>
          <div className="col-md-12 mb-4 d-flex">
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack spacing={3}>
                <DatePicker
                  label="Received Date"
                  inputFormat="dd/MM/yyyy"
                  value={receivedDate}
                  renderInput={(params: any) => <TextField {...params} />} 
                  onChange={(value: any) => setReceivedDate(value)}
                />
              </Stack>
            </LocalizationProvider>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={verifyPayment} >Close</Button>
          <Button disabled={isLoading} color="success" onClick={verifyPayment}>Verify</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={previewImages}
        onClose={() => setPreviewImages(undefined)}
      >
        <DialogContent>
          <SwipeableTextMobileStepper data={previewImages} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewImages(undefined)} >Close</Button>
        </DialogActions>
      </Dialog>
</div>
  )
}

export default PaymentDetails;
