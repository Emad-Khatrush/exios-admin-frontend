import { CSSProperties, ReactNode, useMemo } from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { Grow, useMediaQuery } from '@mui/material';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

// The loyalty screens are Arabic and right-to-left. MUI gets its own emotion cache with the RTL
// plugin and the surrounding theme with its direction flipped, so fields, paddings and the
// pagination arrows mirror; the rest of the admin is untouched. Dialogs opened inside keep it
// (context crosses portals).
const rtlCache = createCache({ key: 'lp-rtl', stylisPlugins: [prefixer, rtlPlugin] });

// The admin has no ThemeProvider at its root, so the theme is built from the one in force (MUI's
// default when there is none) with only the direction flipped. A function theme would need an outer
// theme and leaves every MUI component without palette or typography (the page crashed).
export const LoyaltyRtl = ({ children }: { children: ReactNode }) => {
  const outer = useTheme();
  const theme = useMemo(() => createTheme(outer, { direction: 'rtl' }), [outer]);
  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </CacheProvider>
  );
};

// A number or a $ amount inside Arabic text: kept left-to-right, in tabular figures
export const Num = ({ children, className }: { children: ReactNode, className?: string }) => (
  <bdi dir="ltr" className={`lp-num${className ? ` ${className}` : ''}`}>{children}</bdi>
);

// The place of an element in a screen's entrance (each step ~65ms after the one before)
export const stagger = (index: number) => ({ '--lp-i': index } as CSSProperties);

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// The same opening for every loyalty dialog: MUI's Grow, eased, and none under reduced motion
export const useDialogMotion = () => {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return {
    TransitionComponent: Grow,
    transitionDuration: reduced ? 0 : { enter: 260, exit: 160 },
    TransitionProps: { easing: { enter: EASE, exit: 'cubic-bezier(0.4, 0, 1, 1)' } },
  };
};
