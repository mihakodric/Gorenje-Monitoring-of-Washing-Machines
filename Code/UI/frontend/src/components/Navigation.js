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
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/sensors', label: 'Sensors', icon: Zap },
    { path: '/tests', label: 'Tests', icon: TestTube },
    { path: '/washing-machines', label: 'Washing Machines', icon: Droplet },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !isCollapsed && (
        <div style={overlayStyle} onClick={toggleNavigation}></div>
      )}

      <nav 
        style={{
          ...navStyle,
          width: isCollapsed ? '70px' : '260px',
          transform: isMobile && isCollapsed ? 'translateX(-100%)' : 'translateX(0)',
        }} 
        className="navigation-sidebar"
      >
        <div style={{
          ...brandStyle,
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: isCollapsed ? '20px 10px' : '20px 20px',
        }}>
          {!isCollapsed && (
            <>
              <div 
                style={{
                  ...logoWrapperStyle,
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onClick={toggleNavigation}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                }}
                title="Click to collapse navigation"
              >
                <Activity size={28} style={logoIconStyle} />
              </div>
              <div style={brandTextStyle}>
                <span style={brandTitleStyle}>Gorenje Monitor</span>
                <span style={brandSubtitleStyle}>Washing Machine Control</span>
              </div>
            </>
          )}
          
          {isCollapsed && (
            <div 
              style={{
                ...logoWrapperStyle, 
                margin: 0,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={toggleNavigation}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              title="Click to expand navigation"
            >
              <Activity size={24} style={logoIconStyle} />
            </div>
          )}
        </div>      <ul style={{...listStyle, padding: isCollapsed ? '0 5px' : '0 10px'}}>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <li key={item.path} style={{position: 'relative'}}>
              <Link
                to={item.path}
                style={{
                  ...linkStyle,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '14px 10px' : '14px 15px',
                  ...(isActive ? activeLinkStyle : {})
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateX(5px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
                title={isCollapsed ? item.label : ''}
              >
                <div style={iconWrapperStyle}>
                  <IconComponent size={20} />
                </div>
                {!isCollapsed && (
                  <>
                    <span style={labelStyle}>{item.label}</span>
                    {isActive && <div style={activeIndicatorStyle}></div>}
                  </>
                )}
              </Link>
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div style={{
                  ...tooltipStyle,
                  opacity: 0,
                  pointerEvents: 'none'
                }} className="nav-tooltip">
                  {item.label}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      
      <div style={{
        ...footerStyle,
        padding: isCollapsed ? '15px 10px' : '20px',
        textAlign: isCollapsed ? 'center' : 'left'
      }}>
        {!isCollapsed && (
          <>
            <div style={statusStyle}>
              <div style={statusDotStyle}></div>
              <span style={statusTextStyle}>System Online</span>
            </div>
            <div style={versionStyle}>
              <small>Version 1.0.0</small>
            </div>
          </>
        )}
        {isCollapsed && (
          <div style={statusStyle}>
            <div style={statusDotStyle}></div>
          </div>
        )}
      </div>
      </nav>
    </>
  );
};const navStyle = {
  position: 'fixed',
  left: 0,
  top: 0,
  width: '260px',
  height: '100vh',
  background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
  color: 'white',
  padding: 0,
  zIndex: 1000,
  boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

const toggleButtonStyle = {
  position: 'fixed',
  top: '20px',
  zIndex: 1001,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

const toggleButtonInsideStyle = {
  background: 'rgba(255, 255, 255, 0.2)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  ':hover': {
    background: 'rgba(255, 255, 255, 0.3)',
  }
};

const tooltipStyle = {
  position: 'absolute',
  left: '75px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: '#2d3748',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  zIndex: 1002,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  transition: 'opacity 0.3s ease',
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 999,
  backdropFilter: 'blur(2px)',
};

const brandStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '20px 20px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  marginBottom: '15px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
};

const logoWrapperStyle = {
  width: '44px',
  height: '44px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
};

const logoIconStyle = {
  color: 'white',
  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
};

const brandTextStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const brandTitleStyle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: 'white',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
};

const brandSubtitleStyle = {
  fontSize: '12px',
  color: 'rgba(255, 255, 255, 0.7)',
  fontWeight: '500',
};

const listStyle = {
  listStyle: 'none',
  padding: '0 10px',
  margin: 0,
  flex: 1,
  overflowY: 'auto',
};

const linkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '14px 15px',
  color: 'rgba(255, 255, 255, 0.8)',
  textDecoration: 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  borderRadius: '10px',
  margin: '3px 0',
  position: 'relative',
  overflow: 'hidden',
};

const hoverLinkStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  color: 'white',
  transform: 'translateX(5px)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
};

const activeLinkStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  color: 'white',
  transform: 'translateX(5px)',
  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
  borderLeft: '4px solid #60a5fa',
};

const iconWrapperStyle = {
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const labelStyle = {
  fontSize: '14px',
  fontWeight: '500',
  letterSpacing: '0.5px',
};

const activeIndicatorStyle = {
  position: 'absolute',
  right: '15px',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  backgroundColor: '#60a5fa',
  boxShadow: '0 0 8px rgba(96, 165, 250, 0.6)',
  animation: 'pulse 2s infinite',
};

const footerStyle = {
  padding: '20px',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  marginTop: 'auto',
};

const statusStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '10px',
};

const statusDotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: '#10b981',
  boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
  animation: 'pulse 2s infinite',
};

const statusTextStyle = {
  fontSize: '12px',
  color: 'rgba(255, 255, 255, 0.7)',
  fontWeight: '500',
};

const versionStyle = {
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: '11px',
  textAlign: 'center',
};

// Add keyframes animation styles to document head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* Tooltip hover effect */
    .navigation-sidebar li:hover .nav-tooltip {
      opacity: 1 !important;
    }
    
    /* Mobile specific navigation styles */
    @media (max-width: 1024px) {
      .navigation-sidebar {
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.3) !important;
      }
    }
    
    @media (max-width: 768px) {
      .navigation-sidebar {
        width: 280px !important;
      }
    }
    
    @media (max-width: 480px) {
      .navigation-sidebar {
        width: 90vw !important;
        max-width: 320px !important;
      }
    }
  `;
  if (!document.head.querySelector('style[data-navigation]')) {
    style.setAttribute('data-navigation', 'true');
    document.head.appendChild(style);
  }
}

export default Navigation;
