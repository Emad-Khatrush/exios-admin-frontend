import { ReactNode } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// One look for the order pages and every dialog they open: the admin's green as the only
// accent (dark enough for white text to pass contrast), 8px controls, compact fields.
const theme = createTheme({
  // The admin's global CSS makes the root font 20px; MUI sizes in rem, so it must know that
  typography: { htmlFontSize: 20, fontSize: 14, button: { textTransform: 'none', fontWeight: 600 } },
  palette: {
    primary: { main: '#007b3d', dark: '#00602f', light: '#4caf7d', contrastText: '#ffffff' },
    success: { main: '#007b3d', dark: '#00602f', contrastText: '#ffffff' },
    error: { main: '#c62828' },
    text: { primary: '#1c2530', secondary: '#5d6875' },
    divider: '#e4e8ee',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
  },
});

const OrderTheme = ({ children }: { children: ReactNode }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;

export default OrderTheme;
