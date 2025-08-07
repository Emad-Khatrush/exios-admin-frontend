import React, { useRef, useState, useEffect } from 'react';
import { Download, User } from 'lucide-react';
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { useReactToPrint } from 'react-to-print';

const formatDate = (date: any) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
};

const UserStatementDesign = (props: { userStatements: any[] }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [printMode, setPrintMode] = useState<'all' | 'last15'>('all');
  const [printRequested, setPrintRequested] = useState(false);
  const statementRef = useRef<HTMLDivElement>(null);

  const userStatements = props.userStatements || [];
  const statementsToPrint =
    printMode === 'last15' ? userStatements.slice(-15) : userStatements;

  const finalTotal =
    statementsToPrint.length > 0
      ? statementsToPrint[statementsToPrint.length - 1].total
      : 0;

  const currency =
    statementsToPrint.length > 0
      ? statementsToPrint[statementsToPrint.length - 1].currency
      : 'USD';

  const handlePrint = useReactToPrint({
    contentRef: statementRef,
    documentTitle: `${props.userStatements[0]?.user?.firstName}-${props.userStatements[0]?.user?.lastName}-statement-${printMode}`,
  });

  // ✅ Handle print AFTER re-render
  useEffect(() => {
    if (printRequested) {
      handlePrint?.();
      setPrintRequested(false);
    }
  }, [printRequested, handlePrint]);

  const handlePrintRequest = (mode: 'all' | 'last15') => {
    setPrintMode(mode);
    setPrintRequested(true); // triggers useEffect AFTER render
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans p-4 sm:p-8 flex flex-col items-center" dir="rtl">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => {
            setPrintMode('all');
            setOpenDialog(true);
          }}>
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
                <p className="text-xl font-semibold text-slate-800">كشف حساب لعملة: {currency}</p>
                <p className="text-slate-500">التاريخ: {formatDate(new Date())}</p>
              </div>
            </header>

            <section className="grid md:grid-cols-2 gap-8 my-8">
              <div className="bg-slate-50 p-4 rounded-lg text-end">
                <h4 className="font-semibold text-slate-600 mb-3">العميل:</h4>
                <div className="flex items-center gap-3 text-slate-800" style={{ direction: 'rtl' }}>
                  <User className="w-5 h-5 text-slate-500" />
                  <span>{props.userStatements[0]?.user?.firstName} {props.userStatements[0]?.user?.lastName}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-800 mt-2" style={{ direction: 'rtl' }}>
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
                    {statementsToPrint.map((item: any) => (
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
          <Button onClick={() => setOpenDialog(false)}>Back</Button>
          <Button
            onClick={() => handlePrintRequest('last15')}
            variant="outlined"
            color="primary"
          >
            <Download size={18} />
            طباعة آخر 15
          </Button>
          <Button
            onClick={() => handlePrintRequest('all')}
            variant="contained"
            color="primary"
          >
            <Download size={18} />
            طباعة الكل
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default UserStatementDesign;
