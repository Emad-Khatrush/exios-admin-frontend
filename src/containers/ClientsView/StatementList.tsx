import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Avatar, Stack, CircularProgress, Fade, Chip, IconButton, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AttachFileIcon from '@mui/icons-material/AttachFile'; // New Icon
import moment from 'moment';
import api from '../../api';

// Updated Types to include attachments
interface UserStatement {
  _id: string;
  description: string;
  amount: number;
  currency: 'USD' | 'LYD';
  total: number;
  calculationType: '+' | '-';
  createdAt: string;
  attachments?: any[]; // Array of URLs or file paths
  user?: { 
    _id: string;
    firstName: string; 
    lastName: string; 
    customerId: string; 
  };
  createdBy?: { firstName: string };
}

const StatementList = ({ navigate }: { navigate: any }) => {
  const [items, setItems] = useState<UserStatement[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`statements/latest?page=${page}`);     
        const data = response.data;
        
        setItems(prev => [...prev, ...data.statements]);
        setHasMore(data.hasMore);
      } catch (err) {
        console.error("Statement Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page]);

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      {items.map((item, index) => {
        const isLast = items.length === index + 1;
        const isPlus = item.calculationType === '+';
        const hasAttachments = item.attachments && item.attachments.length > 0;

        return (
          <Fade in key={item._id}>
            <Box 
              ref={isLast ? lastElementRef : null}
              sx={{ 
                bgcolor: 'white', mb: 1.5, p: 2, borderRadius: 3, 
                border: '1px solid #eee', display: 'flex', 
                alignItems: 'center', justifyContent: 'space-between',
                transition: '0.2s',
                '&:hover': { bgcolor: '#fcfdfe', borderColor: 'primary.light', cursor: 'pointer' }
              }}
              onClick={() => navigate(`/user/${item.user?._id}`)}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: isPlus ? '#e8f5e9' : '#ffebee', color: isPlus ? 'success.main' : 'error.main' }}>
                  {isPlus ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                </Avatar>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" fontWeight="bold">
                      {item.user?.firstName} {item.user?.lastName}
                    </Typography>
                    <Chip label={item.user?.customerId} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                    
                    {/* Attachment Indicator */}
                    {hasAttachments && (
                      <Tooltip title="View Attachment">
                        <IconButton 
                          size="small" 
                          sx={{ p: 0, color: 'primary.main' }}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevents navigating to user profile
                            window.open(item.attachments![0].path, '_blank');
                          }}
                        >
                          <AttachFileIcon sx={{ fontSize: 16, transform: 'rotate(45deg)' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                  
                  <Typography style={{ direction: 'rtl', textAlign: 'end' }} color="textSecondary">{item.description}</Typography>
                  <Typography variant="caption" color="text.disabled">
                    {moment(item.createdAt).format('lll')} • Admin: {item.createdBy?.firstName || 'System'}
                  </Typography>
                </Box>
              </Stack>
              
              <Box textAlign="right">
                <Typography variant="subtitle1" fontWeight="bold" color={isPlus ? 'success.main' : 'error.main'}>
                  {item.calculationType}{item.amount.toLocaleString()} {item.currency}
                </Typography>
                <Typography variant="caption" sx={{ bgcolor: '#eee', px: 1, py: 0.2, borderRadius: 1, fontWeight: 'bold' }}>
                  Bal: {item.total.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Fade>
        );
      })}
      
      {loading && (
        <Box textAlign="center" py={3}>
          <CircularProgress size={26} thickness={5} />
        </Box>
      )}
    </Box>
  );
};

export default StatementList;