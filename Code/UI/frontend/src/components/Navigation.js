import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, Droplet, TestTube, Activity, Settings, BarChart3, Menu, X } from 'lucide-react';

const Navigation = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleNavigation = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navItems = [
    // { path: '/', label: 'Dashboard', icon: Home },
    { path: '/sensors', label: 'Sensors', icon: Zap },
    { path: '/machines', label: 'Machines', icon: Droplet },
    { path: '/tests', label: 'Tests', icon: TestTube },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !isCollapsed && (
        <div className="nav-overlay" onClick={toggleNavigation}></div>
      )}

      <nav 
        className="navigation-sidebar"
        style={{
          width: isCollapsed ? '70px' : '260px',
          transform: isMobile && isCollapsed ? 'translateX(-100%)' : 'translateX(0)',
        }}
      >
        <div 
          className="nav-brand"
          style={{
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '20px 10px' : '20px 20px',
          }}
        >
          {!isCollapsed && (
            <>
              <div 
                className="nav-logo"
                onClick={toggleNavigation}
                title="Click to collapse navigation"
              >
                <Activity size={28} className="nav-logo-icon" />
              </div>
              <div className="nav-brand-text">
                <span className="nav-brand-title">Gorenje Monitor</span>
                <span className="nav-brand-subtitle">Washing Machine Control</span>
              </div>
            </>
          )}
          
          {isCollapsed && (
            <div 
              className="nav-logo collapsed"
              onClick={toggleNavigation}
              title="Click to expand navigation"
            >
              <Activity size={24} className="nav-logo-icon" />
            </div>
          )}
        </div>      <ul className={`nav-list ${isCollapsed ? 'collapsed' : ''}`}>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                className={`nav-link ${isCollapsed ? 'collapsed' : ''} ${isActive ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <div className="nav-icon">
                  <IconComponent size={20} />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="nav-label">{item.label}</span>
                    {isActive && <div className="nav-active-indicator"></div>}
                  </>
                )}
              </Link>
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="nav-tooltip">
                  {item.label}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      
      <div className={`nav-footer ${isCollapsed ? 'collapsed' : ''}`}>
        {!isCollapsed && (
          <>
            <div className="nav-status">
              <div className="nav-status-dot"></div>
              <span className="nav-status-text">System Online</span>
            </div>
            <div className="nav-version">
              <small>Version 1.0.0</small>
            </div>
          </>
        )}
        {isCollapsed && (
          <div className="nav-status">
            <div className="nav-status-dot"></div>
          </div>
        )}
      </div>
      </nav>
    </>
  );
};

export default Navigation;
