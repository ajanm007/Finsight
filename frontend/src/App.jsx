import React, { useState, useEffect } from 'react';
import Landing from './components/landing/Landing';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import StatusBar from './components/layout/StatusBar';
import Dashboard from './components/dashboard/Dashboard';
import WatchlistView from './components/watchlist/WatchlistView';
import SignalsView from './components/signals/SignalsView';
import ReportsView from './components/reports/ReportsView';
import EvalView from './components/eval/EvalView';
import SettingsModal from './components/layout/SettingsModal';
import HelpModal from './components/layout/HelpModal';
import Login from './components/auth/Login';
import { useAnalysis } from './hooks/useAnalysis';
import { supabase } from './supabase';

function App() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [session, setSession] = useState(null);
  const [currentTicker, setCurrentTicker] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('terminal'); // terminal, watchlist, signals, reports
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { status, toolStates, brief, error, startAnalysis } = useAnalysis();
  
  useEffect(() => {
    // Check for initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthorized(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthorized(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSearch = (ticker, refresh = false) => {
    setCurrentTicker(ticker);
    setActiveView('terminal');
    startAnalysis(ticker, refresh);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentTicker(null);
  };

  useEffect(() => {
    if (!isAuthorized) return;

    let timeoutId;
    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('Session expired due to inactivity');
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    // Initial timer start
    resetTimer();

    // Listen for activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthorized]);

  if (!isAuthorized) {
    return <Login />;
  }

  if (!currentTicker) {
    return (
      <>
        <Landing onSearch={handleSearch} onLogout={handleLogout} />
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </>
    );
  }

  const renderContent = () => {
    switch (activeView) {
      case 'watchlist':
        return <WatchlistView onSelectTicker={handleSearch} />;
      case 'signals':
        return <SignalsView onSelectTicker={handleSearch} />;
      case 'eval':
        return <EvalView />;
      case 'reports':
        return <ReportsView />;
      case 'terminal':
      default:
        return (
          <Dashboard 
            ticker={currentTicker} 
            status={status}
            toolStates={toolStates}
            brief={brief}
            error={error}
            onSearch={handleSearch}
          />
        );
    }
  };

  return (
    <div className={`app-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <TopBar
        ticker={currentTicker}
        onSearch={handleSearch}
        status={status}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={handleLogout}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <main className="main-content">
        {renderContent()}
      </main>
      <StatusBar brief={brief} />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}


export default App;
