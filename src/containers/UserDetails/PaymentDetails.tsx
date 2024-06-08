import { Button, ClickAwayListener, Grid, Tooltip } from "@mui/material"
import { useState } from "react"
import { FaRegQuestionCircle } from "react-icons/fa"

type Props = {
  title: string
  description: any
  footer: string
  total: string
  color?: 'danger' | 'success'
  tootipInfo?: string
}

const PaymentDetails = (props: Props) => {
  const { description, title, footer, color, total, tootipInfo } = props;

  const [open, setOpen] = useState(false);

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  return (
    <div>
      <div className="d-flex justify-content-between" style={{ direction: 'rtl' }}>
        <div className="d-flex gap-3 align-items-center">
          <h5 style={{ fontSize: '16px', color: color === 'danger' ? '#c72205' : '#069612' }} className="m-0">{title}</h5>
          <p style={{ fontSize: '16px', color: color === 'danger' ? '#c72205' : '#069612' }} className="m-0" dangerouslySetInnerHTML={{__html: description}} />
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
        </div>
        <p className="m-0" style={{ color: color === 'danger' ? '#c72205' : '#069612', minWidth: '50px' }}>{footer}</p>
        <p className="m-0" style={{ minWidth: '50px' }}>{total}</p>
      </div>

      <hr style={{ color: '#b7b7b7' }} />
    </div>
  )
}

export default PaymentDetails;
