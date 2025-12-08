import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, Droplet, TestTube, Activity, Settings, Menu, X } from 'lucide-react';

const Navigation = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      
      // On mobile, hide the nav by default
      if (mobile) {
        setIsOpen(false);
      } else {
        // On desktop, show the nav
        setIsOpen(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleNavigation = () => {
    if (isMobile) {
      setIsOpen(!isOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const closeNavOnMobile = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/sensors', label: 'Sensors', icon: Zap },
    { path: '/machines', label: 'Machines', icon: Droplet },
    { path: '/tests', label: 'Tests', icon: TestTube },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Hamburger Button - Always visible, fixed at top */}
      <button 
        className="hamburger-button"
        onClick={toggleNavigation}
        aria-label="Toggle navigation"
      >
        {(isMobile && !isOpen) || (!isMobile && isCollapsed) ? <Menu size={24} /> : <X size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div 
          className="nav-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <nav 
        className={`navigation-sidebar ${isMobile ? (isOpen ? 'mobile-open' : 'mobile-closed') : ''} ${!isMobile && isCollapsed ? 'desktop-collapsed' : ''}`}
      >
        <div className="nav-brand">
          {(!isMobile && !isCollapsed) || (isMobile && isOpen) ? (
            <>
              <div className="nav-logo">
                <Activity size={28} className="nav-logo-icon" />
              </div>
              <div className="nav-brand-text">
                <span className="nav-brand-title">Gorenje Monitor</span>
                <span className="nav-brand-subtitle">Long term monitoring</span>
              </div>
            </>
          ) : (
            <div className="nav-logo collapsed">
              <Activity size={24} className="nav-logo-icon" />
            </div>
          )}
        </div>

        <ul className="nav-list">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.path;
            const showLabel = (!isMobile && !isCollapsed) || (isMobile && isOpen);
            
            return (
              <li key={item.path} className="nav-item">
                <Link
                  to={item.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeNavOnMobile}
                >
                  <div className="nav-icon">
                    <IconComponent size={20} />
                  </div>
                  {showLabel && (
                    <>
                      <span className="nav-label">{item.label}</span>
                      {isActive && <div className="nav-active-indicator"></div>}
                    </>
                  )}
                </Link>
                
                {/* Tooltip for collapsed desktop state */}
                {!isMobile && isCollapsed && (
                  <div className="nav-tooltip">
                    {item.label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        
        <div className="nav-footer">
          {((!isMobile && !isCollapsed) || (isMobile && isOpen)) ? (
            <>
              <div className="nav-status">
                <div className="nav-status-dot"></div>
                <span className="nav-status-text">System Online</span>
              </div>
              <div className="nav-version">
                <small>Version 1.0.0</small>
              </div>
            </>
          ) : (
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
