import React from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaidIcon from '@mui/icons-material/Paid';
import * as XLSX from 'xlsx';
import moment from 'moment';

const WalletsView = ({ wallets }: { wallets: any[] }) => {
  const navigate = useNavigate();

  // Calculate Global Totals for the Dashboard
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* 1. Summary Stats Bar (Better UI) */}
      <div className="totals-summary-bar">
        <div className="stat-card lyd-card">
          <div className="icon-wrapper"><AccountBalanceIcon /></div>
          <div className="stat-content">
            <span className="stat-label">Total LYD</span>
            <span className="stat-value">{totalLYD.toLocaleString()} <small>LYD</small></span>
          </div>
        </div>

        <div className="stat-card usd-card">
          <div className="icon-wrapper"><PaidIcon /></div>
          <div className="stat-content">
            <span className="stat-label">Total USD</span>
            <span className="stat-value">${totalUSD.toLocaleString()} <small>USD</small></span>
          </div>
        </div>

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadExcel}
            sx={{ borderRadius: '10px', height: '48px', px: 3, fontWeight: 'bold' }}
          >
            Export Excel
          </Button>
        </Box>
      </div>

      <Divider />

      {/* 2. Wallet List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
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
                  onClick={() => {
                    navigate(`/user/${data.user?._id}`)
                  }}
                >
                  Profile
                </Button>
              </div>
              <Divider sx={{ mx: 2 }} />
            </div>
          ))
        )}
      </Box>
    </Box>
  );
};

export default WalletsView;