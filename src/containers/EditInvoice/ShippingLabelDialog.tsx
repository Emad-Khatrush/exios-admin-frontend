import { useState } from 'react';
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, ToggleButton, ToggleButtonGroup } from '@mui/material';
import QRCode from 'qrcode.react';
import * as htmlToImage from 'html-to-image';

type Props = {
  open: boolean
  order: any
  onClose: () => void
  onError: (message: string) => void
}

const LABEL_ID = 'order-shipping-label';

// The shipping mark the supplier prints and puts on the packages, downloaded as an image
const ShippingLabelDialog = ({ open, order, onClose, onError }: Props) => {
  const [method, setMethod] = useState<'air' | 'sea'>(order?.shipment?.method === 'sea' ? 'sea' : 'air');
  const [inspection, setInspection] = useState(false);
  const customerId = order?.user?.customerId;

  const download = async () => {
    try {
      const dataUrl = await htmlToImage.toJpeg(document.getElementById(LABEL_ID) as HTMLElement);
      require('downloadjs')(dataUrl, 'shipping Label.jpeg');
    } catch (error) {
      onError('Could not create the label image. Try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Shipping label</DialogTitle>
      <DialogContent>
        <div className="op-label-options">
          <ToggleButtonGroup color="success" value={method} exclusive size="small" onChange={(_, value) => value && setMethod(value)}>
            <ToggleButton value="air">Air</ToggleButton>
            <ToggleButton value="sea">Sea</ToggleButton>
          </ToggleButtonGroup>
          <FormControlLabel label="Inspection required" control={<Checkbox checked={inspection} onChange={(event) => setInspection(event.target.checked)} />} />
        </div>

        <p className="op-label-address">
          (Exios仓）{method}({customerId}) 广东省佛山市南区里水镇洲村工业区一横路15号之三A
          联系人/Contact person:
          杨生:19700263771
          备注(请认真阅读):（导航搜索：明都LOFT青年社区）
          送货时间:周一至周六早上9点至下午6点，周日休息，(送货之前一定要提前电话联系)
          空运货外箱需要套编织袋并注明“空运/BYAIR”及客户唛头，海运货(重货需套编织袋)并标注“海运/BYSEA”及客户唛头，仓库不提供卸货。
          所有货物品牌货不收(如果不如实告知目送至此仓库地址，本公司不承担任何责任后果需供货商自负)，货物如带电需贴电池防火标，随货需装箱单一份(并且需
          要发电子版给公司)。
        </p>

        <div className="op-label" id={LABEL_ID}>
          <div><img src="/images/exios-logo.png" alt="Exios" width={160} height={90} /></div>
          <div><QRCode value={`${window.location.origin}/shouldAllowToAccessApp?id=${order?._id}`} /></div>
          <div>
            <p><strong>Customer ID:</strong> {customerId}</p>
            <p><strong>Shipment Method:</strong> {method}</p>
            {inspection && <p className="op-label__inspection">Inspection Required</p>}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Back</Button>
        <Button variant="contained" onClick={download}>Download label</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShippingLabelDialog;
