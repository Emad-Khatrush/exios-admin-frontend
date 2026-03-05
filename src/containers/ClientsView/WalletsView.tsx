import React, { useState } from 'react';
import { Box, Typography, Button, Divider, Tabs, Tab, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaidIcon from '@mui/icons-material/Paid';
import HistoryIcon from '@mui/icons-material/History';
import * as XLSX from 'xlsx';
import moment from 'moment';
import StatementList from './StatementList'; // Importing the component below

const WalletsView = ({ wallets }: { wallets: any[] }) => {
  const navigate = useNavigate();
  const [view, setView] = useState(0); // 0 = Wallets list, 1 = StatementList

  // Global Totals for the Summary Bar
  const totalLYD = wallets.reduce((acc, curr) => acc + (curr.lydBalance || 0), 0);
  const totalUSD = wallets.reduce((acc, curr) => acc + (curr.usdBalance || 0), 0);

  const handleDownloadExcel = () => {
    const excelData = wallets.map(data => ({
      'Customer ID': data.user?.customerId,
      'Name': `${data.user?.firstName} ${data.user?.lastName}`,
      'Phone': data.user?.phone,
      'LYD Balance': data.lydBalance,
      'USD Balance': data.usdBalance,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Wallets');
    XLSX.writeFile(workbook, `Wallets_Report_${moment().format('YYYY-MM-DD')}.xlsx`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f9f9f9' }}>
      
      {/* 1. Switcher Header & Action Button */}
      <Box sx={{ bgcolor: 'white', px: 2, pt: 2, borderBottom: '1px solid #eee' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" fontWeight="bold">Wallet Management</Typography>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadExcel}
            sx={{ borderRadius: '10px', height: '42px', px: 3, fontWeight: 'bold' }}
          >
            Export Excel
          </Button>
        </Stack>

        <Tabs value={view} onChange={(_, val) => setView(val)} variant="fullWidth">
          <Tab icon={<AccountBalanceIcon fontSize="small" />} label="Balances" iconPosition="start" />
          <Tab icon={<HistoryIcon fontSize="small" />} label="Activities" iconPosition="start" />
        </Tabs>
      </Box>

      {/* 2. Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 0 ? (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Summary Stats Bar */}
            <div className="totals-summary-bar" style={{ padding: '16px', display: 'flex', gap: '16px' }}>
              <div className="stat-card lyd-card" style={{ flex: 1, background: '#e3f2fd', padding: '15px', borderRadius: '12px', border: '1px solid #bbdefb' }}>
                <Typography variant="caption" fontWeight="bold" color="primary">Total LYD Portfolio</Typography>
                <Typography variant="h5" fontWeight="bold">{totalLYD.toLocaleString()} LYD</Typography>
              </div>
              <div className="stat-card usd-card" style={{ flex: 1, background: '#e8f5e9', padding: '15px', borderRadius: '12px', border: '1px solid #c8e6c9' }}>
                <Typography variant="caption" fontWeight="bold" color="success.main">Total USD Portfolio</Typography>
                <Typography variant="h5" fontWeight="bold">${totalUSD.toLocaleString()} USD</Typography>
              </div>
            </div>

            <Divider />

            {/* Wallets List */}
            {wallets.length === 0 ? (
              <Box p={5} textAlign="center"><Typography color="textSecondary">No active balances.</Typography></Box>
            ) : (
              wallets.map((data, i) => (
                <div key={data._id || i} className="wallet-row-container">
                  <div className="wallet-row">
                    <div className="user-info">
                      <Typography variant="subtitle1" fontWeight="bold">
                        {`${data.user?.firstName} ${data.user?.lastName}`}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">ID: {data.user?.customerId}</Typography>
                    </div>

                    <div className="amounts-container">
                      <div className={`balance-box ${data.lydBalance === 0 ? 'zero' : 'active-lyd'}`}>
                        <span className="label">LYD</span>
                        <span className="value">{data.lydBalance.toLocaleString()}</span>
                      </div>
                      <div className={`balance-box ${data.usdBalance === 0 ? 'zero' : 'active-usd'}`}>
                        <span className="label">USD</span>
                        <span className="value">${data.usdBalance.toLocaleString()}</span>
                      </div>
                    </div>

                    <Button 
                      variant="outlined" 
                      size="small"
                      startIcon={<AccountCircleIcon />}
                      onClick={() => navigate(`/user/${data.user?._id}`)}
                    >
                      Profile
                    </Button>
                  </div>
                  <Divider sx={{ mx: 2 }} />
                </div>
              ))
            )}
          </Box>
        ) : (
          <StatementList navigate={navigate} />
        )}
      </Box>
    </Box>
  );
};

export default WalletsView;