import React, { useState, useRef } from 'react';
// Note: Importing from Skypack CDN to resolve dependencies in this environment.
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, User } from 'lucide-react';
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';

const formatDate = (date: any) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
};

const UserStatementDesign = (props: { userStatements: any[] }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const statementRef = useRef(null);

  const userStatements = props.userStatements || [];

  const finalTotal = userStatements.length > 0 ? userStatements[userStatements.length - 1].total : 0;
  const currency = userStatements.length > 0 ? userStatements[userStatements.length - 1].currency : 'USD';

  const handleDownloadPdf = async () => {
    setIsLoading(true);
    const input = statementRef.current;

    if (!input) {
      setIsLoading(false);
      return;
    }

    const canvas = await html2canvas(input, {
      scale: 1.3, // Adjust scale for better quality
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgProps = new jsPDF().getImageProperties(imgData);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(`${props.userStatements[0]?.user?.firstName}-${props.userStatements[0]?.user?.lastName}-statement-${Date.now()}.pdf`);
    setIsLoading(false);
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans p-4 sm:p-8 flex flex-col items-center" dir="rtl">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => setOpenDialog(true)}
          >
            <Download size={18} />
            تحميل كشف الحساب
          </button>
        </div>
      </div>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        className="flex items-center justify-center"
        fullScreen
      >
        <DialogContent>
          <div ref={statementRef} id="statement" className="bg-white p-6 sm:p-10 rounded-xl shadow-lg">
              <header className="flex justify-between items-start pb-6 border-b-2 border-slate-100">
                <div className='text-center'>
                  <img
                    src={'/images/exios-logo.png'}
                    alt="Exios Company Logo"
                    className="my-2"
                    width={180}
                    height={120}
                  />
                  <h4 className="text-3xl font-bold text-slate-900">شركة إكسيوس للشحن</h4>
                  <p className="text-slate-500 mb-0">طرابلس باب بن غشير</p>
                  <p className="text-slate-500">0912068211 - 0919734019</p>
                </div>
                <div className="text-end mx-3">
                  <h3 className="text-xl font-semibold text-slate-800">البيان</h3>
                  <p style={{ direction: 'rtl' }} className="text-xl font-semibold text-slate-800">كشف حساب لعملة: {currency}</p>
                  <p className="text-slate-500">التاريخ: {formatDate(new Date())}</p>
                </div>
              </header>

              <section  className="grid md:grid-cols-2 gap-8 my-8">
                <div className="bg-slate-50 p-4 rounded-lg text-end">
                  <h4 className="font-semibold text-slate-600 mb-3">العميل:</h4>
                  <div style={{ direction: 'rtl' }} className="flex items-center gap-3 text-slate-800">
                    <User className="w-5 h-5 text-slate-500" />
                    <span>{props.userStatements[0]?.user?.firstName} {props.userStatements[0]?.user?.lastName}</span>
                  </div>
                  <div style={{ direction: 'rtl' }} className="flex items-center gap-3 text-slate-800 mt-2">
                    كود العميل: <span className="text-sm font-mono">{props.userStatements[0]?.user?.customerId}</span>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex flex-col justify-center items-center text-center">
                  <h4 className="font-semibold text-blue-800">الرصيد الكلي</h4>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    {finalTotal.toLocaleString('en-US', { style: 'currency', currency: currency })}
                  </p>
                </div>
              </section>

              <section>
                <h4 className="text-end text-lg font-semibold text-slate-700 mb-4 mt-4 mx-3">تفاصيل العمليات</h4>
                <div className="overflow-x-auto mx-3">
                  <table style={{ direction: 'rtl' }}>
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-3 font-semibold text-slate-600">التاريخ</th>
                        <th className="p-3 font-semibold text-slate-600">الوصف</th>
                        <th className="p-3 font-semibold text-slate-600">المبلغ</th>
                        <th className="p-3 font-semibold text-slate-600">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(userStatements || []).map((item: any) => (
                        <tr key={item._id} className="border-b border-slate-100 last:border-b-0">
                          <td className="p-2 text-slate-500 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                          <td className="p-2 text-right" dir="rtl">
                            <p className="font-medium text-slate-800">{item.description}</p>
                            <p className="text-sm text-slate-500">{item.note}</p>
                          </td>
                          <td className={`p-2 font-semibold whitespace-nowrap ${item.calculationType === '+' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.calculationType}
                            {item.amount.toLocaleString('en-US', { style: 'currency', currency: item.currency })}
                          </td>
                          <td className="p-2 font-medium text-slate-700 whitespace-nowrap">
                            {item.total.toLocaleString('en-US', { style: 'currency', currency: item.currency })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <footer className="mt-10 pt-6 border-t-2 border-slate-100 text-center text-slate-500 text-sm">
                <p>شكرًا لتعاملكم معنا!</p>
                <p>لأي استفسارات، يرجى التواصل مع خدمة العملاء.</p>
              </footer>
            </div>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} >Back</Button>
          <Button
            onClick={handleDownloadPdf}
            disabled={isLoading}
            style={{ height: '40px', width: '200px' }}
            variant="contained"
          >
            {isLoading ? (
              <>
                <svg width={10} height={10} className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري التحميل...
              </>
            ) : (
              <>
                <Download size={18} />
                تحميل PDF
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>
                    
    </div>
  );
}
export default UserStatementDesign;
