import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import BrowserUI from './BrowserUI';
import NewTab from './pages/NewTab';
import History from './pages/History';
import Bookmarks from './pages/Bookmarks';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Shortcuts from './pages/Shortcuts';
import { useSettings } from './hooks';

const pages: Record<string, React.FC> = {
  ui: BrowserUI, newtab: NewTab, history: History, bookmarks: Bookmarks,
  downloads: Downloads, settings: Settings, shortcuts: Shortcuts
};

const route = location.hash.replace(/^#\//, '').split('?')[0] || 'newtab';
window.addEventListener('hashchange', () => location.reload());

function Root() {
  useSettings(); // applies the theme to <html>
  const Page = pages[route] ?? NewTab;
  return <Page />;
}

createRoot(document.getElementById('root')!).render(<Root />);
