/**
 * Theme consumer hook exported separately to keep component modules compatible with Fast Refresh.
 */
import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from '@/context/theme-context';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
