import { ReactNode, useMemo } from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

// The accounting section is Arabic and right-to-left. MUI needs its own emotion cache with the
// RTL plugin so paddings, borders and icons flip; the rest of the admin is untouched.
const rtlCache = createCache({ key: 'acc-rtl', stylisPlugins: [prefixer, rtlPlugin] });

const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', sans-serif";

export const AccountingTheme = ({ children }: { children: ReactNode }) => {
  const theme = useMemo(() => createTheme({
    direction: 'rtl',
    // The admin's global CSS makes the root font 20px; MUI sizes in rem, so it must know that
    typography: { fontFamily: FONT, fontSize: 13.5, htmlFontSize: 20, button: { textTransform: 'none', fontWeight: 600 } },
    palette: {
      primary: { main: '#0f766e', dark: '#115e59', light: '#5eaaa3', contrastText: '#ffffff' },
      error: { main: '#b42318' },
      warning: { main: '#b54708' },
      success: { main: '#067647' },
      text: { primary: '#1f2a37', secondary: '#5b6675' },
      divider: '#e7eaf0',
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiTextField: { defaultProps: { size: 'small' } },
      // Dialogs and menus render outside the section, so they carry the section's direction,
      // font and colour tokens themselves
      MuiDialog: { defaultProps: { dir: 'rtl', className: 'acc-root' } as any, styleOverrides: { paper: { borderRadius: 14 } } },
      MuiPopover: { defaultProps: { dir: 'rtl', className: 'acc-root' } as any },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontFamily: FONT, fontSize: 12 } } },
    },
  }), []);

  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>
        <div dir="rtl" className="acc-root">{children}</div>
      </ThemeProvider>
    </CacheProvider>
  );
};
