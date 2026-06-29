export default function Sidebar({ collapsed, onToggle, activeView, onViewChange, onLogout, onOpenHelp }) {
  const NavItem = ({ id, label, icon, disabled = false }) => {
    const active = activeView === id;
    
    return (
      <div 
        className={`nav-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && onViewChange(id)}
        style={{ 
          padding: '10px 12px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: disabled ? 'not-allowed' : 'pointer', 
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
          opacity: disabled ? 0.5 : 1,
          position: 'relative'
        }} 
        title={disabled ? `${label} // PHASE_2 // COMING_SOON` : label}
      >
        <span style={{ width: '20px', textAlign: 'center' }}>{icon}</span> 
        {!collapsed && <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: active ? 'bold' : 'normal' }}>{label}</span>}
        {active && !collapsed && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>▶</span>}
      </div>
    );
  };

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'all 0.3s' }}>
      <div style={{ padding: collapsed ? '24px 16px' : '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent-amber)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: '8px', height: '10px', backgroundColor: 'var(--accent-amber)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>SOVEREIGN_01</div>
              <div style={{ color: 'var(--accent-amber)', fontSize: '9px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>LEVEL_4_ACCESS</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            «
          </button>
        )}
      </div>
      
      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            »
          </button>
        </div>
      )}
      
      <div style={{ padding: collapsed ? '24px 8px' : '24px 16px', flex: 1 }}>
        {!collapsed && <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px', paddingLeft: '8px' }}>NAVIGATION</div>}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <NavItem id="terminal" label="TERMINAL" icon="▶" />
          <NavItem id="watchlist" label="WATCHLIST" icon="○" />
          <NavItem id="signals" label="SIGNALS" icon="⚡" />
          <NavItem id="eval" label="EVAL" icon="◎" />
          <NavItem id="reports" label="REPORTS" icon="📄" />
        </nav>
      </div>

      <div style={{ padding: collapsed ? '24px 8px' : '24px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }} title="HELP" onClick={onOpenHelp}>
          <span>?</span> {!collapsed && <span>HELP</span>}
        </div>
        <div 
          style={{ padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }} 
          title="LOGOUT"
          onClick={onLogout}
        >
          <span>→</span> {!collapsed && <span>LOGOUT</span>}
        </div>
      </div>
    </div>
  );
}
