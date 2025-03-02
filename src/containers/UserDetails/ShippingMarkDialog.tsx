import { Button, Checkbox, DialogActions, DialogContent, FormControlLabel, ToggleButton, ToggleButtonGroup, Typography, Box, Paper, Divider, Snackbar, Alert } from '@mui/material';
import QRCode from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import { useState } from 'react';
import api from '../../api';
import { guideForShippingInChina } from '../../components/TransferOrdersList/readyTexts';
import { replaceWords } from '../../utils/methods';

const ShippingMarkDialog = ({ user }: { user: any }) => {
  const [shippingMethod, setShippingMethod] = useState<'air' | 'sea'>('air');
  const [isInspectionRequired, setIsInspectionRequired] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [resMessage, setResMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const downloadLabel = () => {
    const node = document.getElementById('shippingLabel');
    if (node) {
      htmlToImage.toJpeg(node, { quality: 0.95 })
        .then((dataUrl) => {
          require('downloadjs')(dataUrl, 'shipping_label.jpeg');
        })
        .catch((error) => console.error('Error generating image:', error));
    }
  };

  const sendWhatsupMessage = async () => {
    setIsSending(true); 

    const node = document.getElementById('shippingLabel');
    const dataUrls: any = [];

    if (node) {
      setShippingMethod('air');
      const imgUrl = await htmlToImage.toJpeg(node, { quality: 0.9 })
      dataUrls.push(imgUrl);
      setShippingMethod('sea');
      const imgUrl2 = await htmlToImage.toJpeg(node, { quality: 0.9 })
      dataUrls.push(imgUrl2);
    }

    // phoneNumber: `${user.phone}@c.us`
    api.post(`sendWhatsupMessage`, { phoneNumber: `5535728209@c.us`, message: replaceWords(guideForShippingInChina, {
      fullName: `${user.firstName}`,
      customerId: user.customerId
    })})
      .then(async () => {
        await api.post(`sendWhatsupImages`, { imgUrls: dataUrls, phoneNumber: `5535728209@c.us` });
        setIsSending(false);
        setIsFinished(true);
        setResMessage('Whatsup message has been send successfully');
      })
      .catch((err) => {
        console.log(err);
        setIsSending(false);
        setIsFinished(true);
        setIsError(true);
        setResMessage(err.response.data.message === 'whatsup-auth-not-found' ? 'You need to scan QR from your whatsup !' : err.response.data.message);
      })
  }

  return (
    <>
      <DialogContent>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2} p={3}>
          <Typography variant="h6" fontWeight="bold" textTransform="uppercase" textAlign="center" color="#2c3e50">
            Shipping Mark
          </Typography>

          <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
            <ToggleButtonGroup
              color="primary"
              value={shippingMethod}
              exclusive
              onChange={(event, value) => value && setShippingMethod(value)}
              size="medium"
            >
              <ToggleButton value="air" sx={{ fontWeight: 'bold' }}>Air</ToggleButton>
              <ToggleButton value="sea" sx={{ fontWeight: 'bold' }}>Sea</ToggleButton>
            </ToggleButtonGroup>
          </Paper>

          <FormControlLabel
            control={<Checkbox checked={isInspectionRequired} onChange={() => setIsInspectionRequired(!isInspectionRequired)} />}
            label={<Typography fontWeight="bold">Inspection Required</Typography>}
          />

          <Typography fontWeight="bold" textTransform="uppercase" textAlign="start" color="#2c3e50">
            广东省佛山市南海区里水镇科顺路6号 威微物流（Exios仓）({user?.customerId}){shippingMethod} 邓为军 13873096321
          </Typography>

          <Paper id="shippingLabel" elevation={4} sx={{ width: 450, p: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)' }}>
            <Box display="flex" flexDirection="column" gap={3}>
              <Box display="flex" justifyContent="center">
                <img src="/images/exios-logo.png" alt="Exios" width={180} height={100} style={{ objectFit: 'contain' }}/>
              </Box>

              <Divider />

              <Box display="flex" justifyContent="center">
                <QRCode value={`http://exios-admin-frontend.web.app/shouldAllowToAccessApp?id=${user?._id}`} size={160} />
              </Box>

              <Divider />

              <Box display="flex" flexDirection="column" gap={2} textAlign="left">
                <Typography variant="body1" fontWeight="600" color="#34495e">
                  <Box component="span" fontWeight="bold" color="#2c3e50">Customer ID:</Box> {user?.customerId}
                </Typography>
                <Typography variant="body1" fontWeight="600" color="#34495e">
                  <Box component="span" fontWeight="bold" color="#2c3e50">Shipment Method:</Box> {shippingMethod}
                </Typography>
                {isInspectionRequired && (
                  <Typography variant="body1" fontWeight="bold" color="#e74c3c">
                    Inspection Required
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        </Box>

        <Box display="flex" flexDirection="column" gap={3}>
          <hr />
          <textarea rows={15} style={{ direction: 'rtl' }}>
            {replaceWords(guideForShippingInChina, {
              fullName: `${user.firstName}`,
              customerId: user.customerId
            })}
          </textarea>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button disabled={isSending} onDoubleClick={sendWhatsupMessage} color="success" variant="contained" style={{ fontWeight: 'bold' }}>
          Send Shipping Guide to Customer
        </Button>
        <Button onClick={downloadLabel} color="primary" variant="contained" style={{ fontWeight: 'bold' }}>
          Download Label
        </Button>
      </DialogActions>

      <Snackbar 
        open={isFinished} 
        autoHideDuration={6000}
        onClose={() => {
          setIsFinished(false);
          setIsError(false);
        }}
      >
        <Alert 
          severity={isError ? 'error' : 'success'}
          sx={{ width: '100%' }}
          onClose={() => {
            setIsFinished(false);
            setIsError(false);
          }}
        >
          {resMessage}
        </Alert>
      </Snackbar>
      
    </>
  );
};

export default ShippingMarkDialog;