import React, { createContext, useState, useEffect, useContext } from 'react';

const STORAGE_KEY = 'dashboardTheme';

type ThemeContextType = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredDashboardTheme(): 'light' | 'dark' {
  const primary = localStorage.getItem(STORAGE_KEY);
  if (primary === 'light' || primary === 'dark') return primary;
  const legacy = localStorage.getItem('theme');
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => readStoredDashboardTheme());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
