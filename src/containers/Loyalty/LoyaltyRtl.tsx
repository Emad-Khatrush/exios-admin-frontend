import { CSSProperties, ReactNode } from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { Grow, useMediaQuery } from '@mui/material';
import { Theme, ThemeProvider } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

// The loyalty screens are Arabic and right-to-left. MUI gets its own emotion cache with the RTL
// plugin and the surrounding theme with its direction flipped, so fields, paddings and the
// pagination arrows mirror; the rest of the admin is untouched. Dialogs opened inside keep it
// (context crosses portals).
const rtlCache = createCache({ key: 'lp-rtl', stylisPlugins: [prefixer, rtlPlugin] });
const rtlTheme = (outer: Theme) => ({ ...outer, direction: 'rtl' as const });

export const LoyaltyRtl = ({ children }: { children: ReactNode }) => (
  <CacheProvider value={rtlCache}>
    <ThemeProvider theme={rtlTheme}>{children}</ThemeProvider>
  </CacheProvider>
);

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
