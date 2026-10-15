import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useFamily } from '@/lib/store';
import { ink, paper, type Palette } from './tokens';

const ThemeContext = createContext<Palette>(paper);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = useFamily((s) => s.settings.theme);
  const system = useColorScheme();
  const palette = useMemo(() => {
    if (pref === 'paper') return paper;
    if (pref === 'ink') return ink;
    return system === 'dark' ? ink : paper;
  }, [pref, system]);
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Forces a palette for one subtree (Flow is always ink, like night water). */
export function ForceTheme({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}
