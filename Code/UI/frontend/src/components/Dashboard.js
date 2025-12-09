import React, { useState, useEffect } from 'react';
import { sensorsAPI, testsAPI, machinesAPI, sensorTypesAPI, machineTypesAPI } from '../api';
import { Activity, Zap, TestTube, Droplet, Layers } from 'lucide-react';
import Plot from 'react-plotly.js';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMachines: 0,
    totalSensors: 0,
    totalTests: 0,
    machineTypes: [],
    sensorTypes: [],
    testsByStatus: { idle: 0, running: 0, completed: 0, failed: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [machinesRes, sensorsRes, testsRes, machineTypesRes, sensorTypesRes] = await Promise.all([
        machinesAPI.getAll(),
        sensorsAPI.getAll(),
        testsAPI.getAll(),
        machineTypesAPI.getAll(),
        sensorTypesAPI.getAll()
      ]);

      const machines = machinesRes.data || [];
      const sensors = sensorsRes.data || [];
      const tests = testsRes.data || [];
      const machineTypes = machineTypesRes.data || [];
      const sensorTypes = sensorTypesRes.data || [];

      // Count machines by type
      const machineTypeCount = {};
      machines.forEach(m => {
        const typeName = machineTypes.find(mt => mt.id === m.machine_type_id)?.machine_type_name || 'Unknown';
        machineTypeCount[typeName] = (machineTypeCount[typeName] || 0) + 1;
      });

      // Count sensors by type
      const sensorTypeCount = {};
      sensors.forEach(s => {
        const typeName = sensorTypes.find(st => st.id === s.sensor_type_id)?.sensor_type_name || 'Unknown';
        sensorTypeCount[typeName] = (sensorTypeCount[typeName] || 0) + 1;
      });

      // Count tests by status
      const testsByStatus = { idle: 0, running: 0, completed: 0, failed: 0 };
      tests.forEach(t => {
        const status = t.test_status || 'idle';
        if (testsByStatus.hasOwnProperty(status)) {
          testsByStatus[status]++;
        }
      });

      setStats({
        totalMachines: machines.length,
        totalSensors: sensors.length,
        totalTests: tests.length,
        machineTypes: Object.entries(machineTypeCount).map(([name, count]) => ({ name, count })),
        sensorTypes: Object.entries(sensorTypeCount).map(([name, count]) => ({ name, count })),
        testsByStatus
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span className="loading-text">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">System overview and statistics</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2-col" style={{ marginBottom: '30px' }}>
        {/* Machine Types Chart */}
        {stats.machineTypes.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="flex-center gap-10">
                <Droplet size={20} style={{ color: '#3b82f6' }} />
                <h3 className="card-title">Machines by Type</h3>
              </div>
            </div>
            <div className="card-body">
              <Plot
                data={[{
                  values: stats.machineTypes.map(mt => mt.count),
                  labels: stats.machineTypes.map(mt => mt.name),
                  type: 'pie',
                  marker: {
                    colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
                  },
                  textinfo: 'label+value',
                  textposition: 'auto',
                  hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>',
                  hole: 0.0,
                  domain: { x: [0.05, 0.95], y: [0.05, 0.95] }
                }]}
                layout={{
                  showlegend: false,
                  margin: { t: 20, b: 20, l: 20, r: 20 },
                  height: 300
                }}
                config={{
                  displayModeBar: false,
                  responsive: true
                }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        )}

        {/* Sensor Types Chart */}
        {stats.sensorTypes.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="flex-center gap-10">
                <Zap size={20} style={{ color: '#8b5cf6' }} />
                <h3 className="card-title">Sensors by Type</h3>
              </div>
            </div>
            <div className="card-body">
              <Plot
                data={[{
                  values: stats.sensorTypes.map(st => st.count),
                  labels: stats.sensorTypes.map(st => st.name),
                  type: 'pie',
                  marker: {
                    colors: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
                  },
                  textinfo: 'label+value',
                  textposition: 'auto',
                  hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>',
                  hole: 0.0,
                  domain: { x: [0.05, 0.95], y: [0.05, 0.95] }
                }]}
                layout={{
                  showlegend: false,
                  margin: { t: 20, b: 20, l: 20, r: 20 },
                  height: 300
                }}
                config={{
                  displayModeBar: false,
                  responsive: true
                }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        )}

        {/* Test Status Chart */}
        <div className="card">
          <div className="card-header">
            <div className="flex-center gap-10">
              <TestTube size={20} style={{ color: '#f59e0b' }} />
              <h3 className="card-title">Tests by Status</h3>
            </div>
          </div>
          <div className="card-body">
            <Plot
              data={[{
                values: [
                  stats.testsByStatus.idle,
                  stats.testsByStatus.running
                ],
                labels: ['Idle', 'Running'],
                type: 'pie',
                marker: {
                  colors: ['#6b7280', '#10b981']
                },
                textinfo: 'label+value',
                textposition: 'auto',
                hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>',
                hole: 0.0,
                domain: { x: [0.05, 0.95], y: [0.05, 0.95] }
              }]}
              layout={{
                showlegend: false,
                margin: { t: 20, b: 20, l: 20, r: 20 },
                height: 300
              }}
              config={{
                displayModeBar: false,
                responsive: true
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
