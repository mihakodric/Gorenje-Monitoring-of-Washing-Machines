import React, { useState, useEffect } from 'react';
import { systemAPI, mqttAPI, sensorsAPI, testsAPI } from '../api';
import { Activity, Zap, TestTube, Play, Square, Settings, TrendingUp, Database, Wifi } from 'lucide-react';

const Dashboard = () => {
  const [systemStatus, setSystemStatus] = useState(null);
  const [mqttStatus, setMqttStatus] = useState(false);
  const [stats, setStats] = useState({
    sensors: 0,
    tests: 0,
    activeSensors: 0,
    runningTests: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [systemRes, mqttRes, sensorsRes, testsRes] = await Promise.all([
        systemAPI.status(),
        mqttAPI.status(),
        sensorsAPI.getAll(),
        testsAPI.getAll()
      ]);

      setSystemStatus(systemRes.data);
      setMqttStatus(mqttRes.data.running);

      const sensors = sensorsRes.data;
      const tests = testsRes.data;

      setStats({
        sensors: sensors.length,
        tests: tests.length,
        activeSensors: sensors.filter(s => s.is_online).length,
        runningTests: tests.filter(t => t.status === 'running').length
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMqttToggle = async () => {
    try {
      if (mqttStatus) {
        await mqttAPI.stop();
      } else {
        await mqttAPI.start();
      }
      setTimeout(loadDashboardData, 1000); // Refresh after 1 second
    } catch (error) {
      console.error('Error toggling MQTT:', error);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '10px'
        }}>
          Washing Machine Monitor
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', fontWeight: '500' }}>
          Real-time system overview and control center
        </p>
      </div>
      
      {/* System Status Card */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <div className="card-header">
          <h2 className="card-title">
            <Settings size={24} />
            System Control Center
          </h2>
          <button
            className={`btn ${mqttStatus ? 'btn-danger' : 'btn-success'}`}
            onClick={handleMqttToggle}
            style={{ minWidth: '140px' }}
          >
            {mqttStatus ? (
              <>
                <Square size={16} />
                Stop MQTT
              </>
            ) : (
              <>
                <Play size={16} />
                Start MQTT
              </>
            )}
          </button>
        </div>
        
        <div className="grid grid-3">
          <div style={{
            padding: '25px',
            borderRadius: '12px',
            background: mqttStatus ? 
              'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 
              'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
            border: mqttStatus ? '2px solid #a7f3d0' : '2px solid #fca5a5',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <Wifi size={28} style={{ 
                color: mqttStatus ? '#10b981' : '#ef4444',
                marginRight: '10px'
              }} />
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: mqttStatus ? '#10b981' : '#ef4444',
                boxShadow: `0 0 8px ${mqttStatus ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                animation: 'pulse 2s infinite'
              }}></div>
            </div>
            <h3 style={{ 
              margin: '0 0 5px 0', 
              color: mqttStatus ? '#065f46' : '#7f1d1d',
              fontSize: '18px'
            }}>
              MQTT Service
            </h3>
            <p style={{ 
              margin: 0, 
              color: mqttStatus ? '#047857' : '#991b1b',
              fontWeight: '600'
            }}>
              {mqttStatus ? 'Online & Connected' : 'Offline'}
            </p>
            <small style={{ 
              color: mqttStatus ? '#059669' : '#b91c1c',
              fontSize: '12px'
            }}>
              Broker: {systemStatus?.mqtt_broker || '192.168.0.77'}
            </small>
          </div>

          <div style={{
            padding: '25px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '2px solid #93c5fd',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <Database size={28} style={{ color: '#3b82f6', marginRight: '10px' }} />
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)',
                animation: 'pulse 2s infinite'
              }}></div>
            </div>
            <h3 style={{ margin: '0 0 5px 0', color: '#1e40af', fontSize: '18px' }}>
              Database
            </h3>
            <p style={{ margin: 0, color: '#1d4ed8', fontWeight: '600' }}>
              Connected & Active
            </p>
            <small style={{ color: '#2563eb', fontSize: '12px' }}>
              {systemStatus?.database || 'SQLite Database'}
            </small>
          </div>

          <div style={{
            padding: '25px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '2px solid #86efac',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <Activity size={28} style={{ color: '#22c55e', marginRight: '10px' }} />
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)',
                animation: 'pulse 2s infinite'
              }}></div>
            </div>
            <h3 style={{ margin: '0 0 5px 0', color: '#15803d', fontSize: '18px' }}>
              System Status
            </h3>
            <p style={{ margin: 0, color: '#166534', fontWeight: '600' }}>
              All Systems Online
            </p>
            <small style={{ color: '#16a34a', fontSize: '12px' }}>
              Monitoring Active
            </small>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-4" style={{ marginBottom: '30px' }}>
        <div className="card stats-card" style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          transform: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <Zap size={32} style={{ opacity: 0.9 }} />
            <div className="stats-number">{stats.sensors}</div>
          </div>
          <div className="stats-label">Total Sensors</div>
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <TrendingUp size={14} />
            Registered devices
          </div>
        </div>

        <div className="card stats-card" style={{ 
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          transform: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <Activity size={32} style={{ opacity: 0.9 }} />
            <div className="stats-number">{stats.activeSensors}</div>
          </div>
          <div className="stats-label">Active Sensors</div>
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <TrendingUp size={14} />
            Currently monitoring
          </div>
        </div>

        <div className="card stats-card" style={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          transform: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <TestTube size={32} style={{ opacity: 0.9 }} />
            <div className="stats-number">{stats.tests}</div>
          </div>
          <div className="stats-label">Total Tests</div>
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <TrendingUp size={14} />
            All time records
          </div>
        </div>

        <div className="card stats-card" style={{ 
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          transform: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <Play size={32} style={{ opacity: 0.9 }} />
            <div className="stats-number">{stats.runningTests}</div>
          </div>
          <div className="stats-label">Running Tests</div>
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <TrendingUp size={14} />
            Currently executing
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Activity size={24} />
            Quick Actions
          </h2>
          <div style={{
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#6b7280'
          }}>
            Control Panel
          </div>
        </div>
        
        <div className="grid grid-3" style={{ gap: '20px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.href = '/sensors'}
            style={{ 
              padding: '20px',
              fontSize: '16px',
              height: 'auto',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <Zap size={32} />
            <div>
              <div style={{ fontWeight: 'bold' }}>Manage Sensors</div>
              <small style={{ opacity: 0.8 }}>Configure & monitor sensors</small>
            </div>
          </button>
          
          <button 
            className="btn btn-success" 
            onClick={() => window.location.href = '/tests'}
            style={{ 
              padding: '20px',
              fontSize: '16px',
              height: 'auto',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <TestTube size={32} />
            <div>
              <div style={{ fontWeight: 'bold' }}>Manage Tests</div>
              <small style={{ opacity: 0.8 }}>Create & analyze tests</small>
            </div>
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={loadDashboardData}
            style={{ 
              padding: '20px',
              fontSize: '16px',
              height: 'auto',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <Activity size={32} />
            <div>
              <div style={{ fontWeight: 'bold' }}>Refresh Data</div>
              <small style={{ opacity: 0.8 }}>Update system status</small>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
