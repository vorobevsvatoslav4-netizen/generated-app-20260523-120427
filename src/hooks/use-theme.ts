import * as React from 'react';
/**
 * useTheme hook manages the application's light/dark mode preference.
 * Explicitly importing React ensures the hook dispatcher is correctly resolved.
 */
export function useTheme() {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);
  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };
  return { isDark, toggleTheme };
}