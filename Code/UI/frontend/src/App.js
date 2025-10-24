import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
// import Dashboard from './components/Dashboard';
import Sensors from './components/Sensors';
import Tests from './components/Tests';
import NewTest from './components/NewTest';
import Machines from './components/Machines';
import Settings from './components/Settings';
import './App.css';
import './styles/index.css';

function App() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      // Auto-collapse on mobile
      if (mobile) {
        setIsNavCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return (
    <Router>
      <div className="App">
        <Navigation 
          isCollapsed={isNavCollapsed} 
          setIsCollapsed={setIsNavCollapsed} 
        />
        <div className={`main-content ${isNavCollapsed ? 'nav-collapsed' : ''}`}>
          <Routes>
            {/* <Route path="/" element={<Dashboard />} /> */}
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/tests" element={<Tests />} />
            <Route path="/tests/new" element={<NewTest />} />
            <Route path="/tests/edit/:id" element={<NewTest />} />
            <Route path="/machines" element={<Machines/>} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
