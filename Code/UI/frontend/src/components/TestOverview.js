import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { SENSOR_COLORS, hexToRgba } from '../constants/colors';
import { 
  ArrowLeft, 
  Play, 
  Square, 
  Edit2, 
  Save, 
  X, 
  Activity, 
  Zap, 
  Clock,
  MapPin,
  Info,
  Wifi,
  WifiOff,
  Sparkles
} from 'lucide-react';
import { testsAPI, testRelationsAPI, sensorsAPI, machinesAPI, measurementsAPI } from '../api';

const TestOverview = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  // Test data state
  const [test, setTest] = useState(null);
  const [testSensors, setTestSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editable fields state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedNote, setEditedNote] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  // Chart state
  const [selectedSensorIds, setSelectedSensorIds] = useState(new Set());
  const [plotData, setPlotData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [sensorMeasurements, setSensorMeasurements] = useState({});
  const [dataMode, setDataMode] = useState('aggregated'); // 'aggregated' or 'raw'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aggregationType, setAggregationType] = useState('absolute'); // 'absolute' or 'regular'
  
  // Chart ref for zoom controls
  const chartRef = useRef(null);

  // Plotly layout configuration
  const plotLayout = {
    title: 'Sensor Data Over Time',
    xaxis: {
      title: 'Time',
      type: 'date',
      showgrid: true,
      gridcolor: 'rgba(0, 0, 0, 0.1)'
    },
    yaxis: {
      title: 'Value',
      showgrid: true,
      gridcolor: 'rgba(0, 0, 0, 0.1)'
    },
    hovermode: 'closest',
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.1
    },
    margin: {
      l: 60,
      r: 20,
      t: 60,
      b: 60
    },
    autosize: true
  };

  // Plotly config for interactions
  const plotConfig = {
    displayModeBar: true,
    modeBarButtonsToAdd: ['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
    modeBarButtonsToRemove: ['toImage'],
    responsive: true,
    displaylogo: false
  };

  // Zoom control functions (for Plotly)
  const resetZoom = () => {
    if (chartRef.current) {
      const update = {
        'xaxis.autorange': true,
        'yaxis.autorange': true
      };
      window.Plotly.relayout(chartRef.current.el, update);
    }
  };

  // Simplified zoom functions for Plotly (since Plotly has built-in zoom controls)
  const zoomIn = () => {
    // Plotly handles zoom via built-in controls
    console.log('Use Plotly zoom controls or mouse wheel');
  };

  const zoomOut = () => {
    // Plotly handles zoom via built-in controls  
    console.log('Use Plotly zoom controls or mouse wheel');
  };

  useEffect(() => {
    loadTestData();
    
    // Simplified keyboard shortcuts - only reset zoom since Plotly handles zoom natively
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch(event.key) {
          case '0':
            event.preventDefault();
            resetZoom();
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [testId]);

  // We no longer reload all traces on any selection change; incremental logic handles updates.

  const loadTestData = async () => {
    try {
      setLoading(true);
      
      // Load test with machine details
      const testResponse = await testsAPI.getById(testId);
      const testData = testResponse.data;
      setTest(testData);
      setEditedNote(testData.test_notes || '');
      setEditedDescription(testData.test_description || '');

      // Load test relations (sensors)
      const relationsResponse = await testRelationsAPI.getByTestId(testId);
      const relations = relationsResponse.data;
      console.log('Loaded test relations:', relations);

      setTestSensors(relations);

    } catch (error) {
      console.error('Error loading test data:', error);
      setError('Failed to load test data');
    } finally {
      setLoading(false);
    }
  };

  const buildTracesFromMeasurements = useCallback((sensor, measurements, colorStartIndex = 0, mode = 'aggregated', aggType = 'absolute') => {
    const channelGroups = {};
    measurements.forEach(m => {
      const channel = m.measurement_channel || 'main';
      if (!channelGroups[channel]) channelGroups[channel] = [];
      channelGroups[channel].push(m);
    });
    let colorIndex = colorStartIndex;
    const traces = [];
    Object.keys(channelGroups).sort().forEach(channel => {
      const channelData = channelGroups[channel].sort((a, b) => new Date(a.measurement_timestamp) - new Date(b.measurement_timestamp));
      const times = channelData.map(m => new Date(m.measurement_timestamp));
      
      const baseTraceName = channel === 'main' || channel === 'null'
        ? `${sensor.sensor_name} (${sensor.sensor_location || 'N/A'})`
        : `${sensor.sensor_name} - ${channel.toUpperCase()} (${sensor.sensor_location || 'N/A'})`;
      
      const color = SENSOR_COLORS[colorIndex % SENSOR_COLORS.length];
      
      if (mode === 'raw') {
        // Raw mode: single trace
        const values = channelData.map(m => parseFloat(m.measurement_value));
        traces.push({
          x: times,
          y: values,
          type: 'scattergl',
          mode: 'lines',
          name: baseTraceName,
          sensorId: sensor.id,
          line: { color: color, width: 1 },
          hovertemplate: `<b>%{fullData.name}</b><br>` +
            `Time: %{x}<br>` +
            `Value: %{y:.3f}${sensor.sensor_type_unit || ''}<br>` +
            `<extra></extra>`,
          connectgaps: false
        });
      } else {
        // Aggregated mode: min, max, avg with shading
        const suffix = aggType === 'absolute' ? '_abs_value' : '_value';
        const minValues = channelData.map(m => parseFloat(m[`min${suffix}`]));
        const maxValues = channelData.map(m => parseFloat(m[`max${suffix}`]));
        const avgValues = channelData.map(m => parseFloat(m[`avg${suffix}`]));
        
        // Shaded area between min and max
        traces.push({
          x: [...times, ...times.slice().reverse()],
          y: [...maxValues, ...minValues.slice().reverse()],
          fill: 'toself',
          fillcolor: hexToRgba(color, 0.3),
          type: 'scattergl',
          mode: 'none',
          name: `${baseTraceName} Range`,
          sensorId: sensor.id,
          showlegend: true,
          hoverinfo: 'skip',
          connectgaps: false
        });
        
        // Max line
        traces.push({
          x: times,
          y: maxValues,
          type: 'scattergl',
          mode: 'lines',
          name: `${baseTraceName} Max`,
          sensorId: sensor.id,
          line: { color: color, width: 1, dash: 'dot' },
          hovertemplate: `<b>Max</b><br>` +
            `Time: %{x}<br>` +
            `Value: %{y:.3f}${sensor.sensor_type_unit || ''}<br>` +
            `<extra></extra>`,
          connectgaps: false,
          showlegend: false
        });
        
        // Min line
        traces.push({
          x: times,
          y: minValues,
          type: 'scattergl',
          mode: 'lines',
          name: `${baseTraceName} Min`,
          sensorId: sensor.id,
          line: { color: color, width: 1, dash: 'dot' },
          hovertemplate: `<b>Min</b><br>` +
            `Time: %{x}<br>` +
            `Value: %{y:.3f}${sensor.sensor_type_unit || ''}<br>` +
            `<extra></extra>`,
          connectgaps: false,
          showlegend: false
        });
        
        // Average line (bold)
        traces.push({
          x: times,
          y: avgValues,
          type: 'scattergl',
          mode: 'lines+markers',
          name: `${baseTraceName} Avg`,
          sensorId: sensor.id,
          line: { color: color, width: 2 },
          marker: { color: color, size: 4 },
          hovertemplate: `<b>Average</b><br>` +
            `Time: %{x}<br>` +
            `Value: %{y:.3f}${sensor.sensor_type_unit || ''}<br>` +
            `<extra></extra>`,
          connectgaps: false,
          showlegend: true
        });
      }
      
      colorIndex++;
    });
    return traces;
  }, []);

  // Rebuild plot data when aggregationType changes
  useEffect(() => {
    if (selectedSensorIds.size > 0 && dataMode === 'aggregated' && Object.keys(sensorMeasurements).length > 0) {
      const selectedSensors = testSensors.filter(s => selectedSensorIds.has(s.id));
      const allTraces = [];
      
      selectedSensors.forEach((sensor, i) => {
        const cacheKey = `${sensor.id}_${dataMode}`;
        if (sensorMeasurements[cacheKey]) {
          const traces = buildTracesFromMeasurements(sensor, sensorMeasurements[cacheKey], i, dataMode, aggregationType);
          allTraces.push(...traces);
        }
      });
      
      if (allTraces.length > 0) {
        setPlotData(allTraces);
      }
    }
  }, [aggregationType, dataMode, selectedSensorIds, sensorMeasurements, testSensors, buildTracesFromMeasurements]);

  const fetchAndCacheSensor = useCallback(async (sensor, mode = 'aggregated', colorStartIndex = 0) => {
    const response = mode === 'raw' 
      ? await measurementsAPI.getSensorDataRaw(sensor.id, { limit: 50000, last_minutes: 3 })
      : await measurementsAPI.getSensorDataAvg(sensor.id, { limit: 50000 });
    const measurements = response.data || [];
    const traces = buildTracesFromMeasurements(sensor, measurements, colorStartIndex, mode, aggregationType);
    setSensorMeasurements(prev => ({ ...prev, [`${sensor.id}_${mode}`]: measurements }));
    return traces; // Return traces instead of updating state here
  }, [buildTracesFromMeasurements, aggregationType]);

  // Handle sensor toggle with current data mode
  const handleSensorToggle = async (sensorId, event) => {
    const multi = event && (event.ctrlKey || event.metaKey);
    let newSelectedIds = new Set(selectedSensorIds);

    // Set loading immediately
    setChartLoading(true);
    
    try {
      // Small delay to ensure loading spinner renders
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (multi) {
        // Multi-select toggle behavior
        if (newSelectedIds.has(sensorId)) {
          newSelectedIds.delete(sensorId);
          // Remove traces for this sensor
          setPlotData(prev => prev.filter(t => t.sensorId !== sensorId));
        } else {
          newSelectedIds.add(sensorId);
          const sensor = testSensors.find(s => s.id === sensorId);
          if (sensor) {
            // Calculate color index based on how many sensors are already selected
            const colorIndex = Array.from(newSelectedIds).indexOf(sensorId);
            // Always fetch fresh data from database
            const traces = await fetchAndCacheSensor(sensor, dataMode, colorIndex);
            setPlotData(prev => [...prev, ...traces]);
          }
        }
      } else {
        // Single-select mode
        if (newSelectedIds.has(sensorId) && newSelectedIds.size === 1) {
          // Deselect if already sole selected
          newSelectedIds = new Set();
          setPlotData([]);
        } else {
          // Replace selection with only this sensor
          newSelectedIds = new Set([sensorId]);
          const sensor = testSensors.find(s => s.id === sensorId);
          if (sensor) {
            // Always fetch fresh data from database
            const traces = await fetchAndCacheSensor(sensor, dataMode, 0);
            setPlotData(traces);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling sensor:', error);
    } finally {
      setChartLoading(false);
    }
    
    setSelectedSensorIds(newSelectedIds);
  };

  const handleDataModeChange = async (newMode) => {
    if (newMode === dataMode) return;
    
    setDataMode(newMode);
    
    // Clear current plot and reload data for selected sensors
    if (selectedSensorIds.size > 0) {
      setPlotData([]);
      setChartLoading(true);
      
      try {
        const selectedSensors = testSensors.filter(s => selectedSensorIds.has(s.id));
        
        const allTraces = [];
        for (let i = 0; i < selectedSensors.length; i++) {
          const sensor = selectedSensors[i];
          const cacheKey = `${sensor.id}_${newMode}`;
          
          let traces;
          if (!sensorMeasurements[cacheKey]) {
            traces = await fetchAndCacheSensor(sensor, newMode, i);
          } else {
            traces = buildTracesFromMeasurements(sensor, sensorMeasurements[cacheKey], i, newMode, aggregationType);
          }
          allTraces.push(...traces);
        }
        
        setPlotData(allTraces);
      } catch (error) {
        console.error('Error switching data mode:', error);
      } finally {
        setChartLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    if (selectedSensorIds.size === 0) return;
    
    setIsRefreshing(true);
    setPlotData([]);
    
    try {
      const selectedSensors = testSensors.filter(s => selectedSensorIds.has(s.id));
      
      // Clear cache for selected sensors in current mode
      const newCache = { ...sensorMeasurements };
      selectedSensors.forEach(sensor => {
        const cacheKey = `${sensor.id}_${dataMode}`;
        delete newCache[cacheKey];
      });
      setSensorMeasurements(newCache);
      
      // Fetch fresh data and collect all traces
      const allTraces = [];
      for (let i = 0; i < selectedSensors.length; i++) {
        const sensor = selectedSensors[i];
        const traces = await fetchAndCacheSensor(sensor, dataMode, i);
        allTraces.push(...traces);
      }
      
      setPlotData(allTraces);
    } catch (error) {
      console.error('Error refreshing data:', error);
      alert('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveNote = async () => {
    try {
      console.log('Saving note:', editedNote);
      // Always send the note, even if empty (to allow clearing notes)
      const updateData = { test_notes: editedNote || '' };
      await testsAPI.update(testId, updateData);
      setTest({ ...test, test_notes: editedNote });
      setIsEditingNote(false);
    } catch (error) {
      console.error('Error saving note!!!:', error);
      alert('Failed to save note');
    }
  };

  const handleSaveDescription = async () => {
    try {
      await testsAPI.update(testId, { test_description: editedDescription });
      setTest({ ...test, test_description: editedDescription });
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Error saving description:', error);
      alert('Failed to save description');
    }
  };

  const handleStartTest = async () => {
    try {
      const res = await testsAPI.start(testId);
      const updated = await testsAPI.getById(testId);
      setTest(updated.data);
    } catch (error) {
      console.error('Error starting test:', error);
      alert(error?.response?.data?.detail || 'Failed to start test');
    }
  };


  const handleStopTest = async () => {
    try {
      const res = await testsAPI.stop(testId);
      const updated = await testsAPI.getById(testId);
      setTest(updated.data);
    } catch (error) {
      console.error('Error stopping test:', error);
      alert(error?.response?.data?.detail || 'Failed to stop test');
    }
  };

  const formatLastReceived = (secondsAgo) => {
    if (secondsAgo < 60) {
      return `${secondsAgo}s ago`;
    } else if (secondsAgo < 3600) {
      return `${Math.floor(secondsAgo / 60)}m ago`;
    } else {
      return `${Math.floor(secondsAgo / 3600)}h ago`;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'status-running';
      case 'completed': return 'status-completed'; 
      case 'idle': return 'status-inactive';
      case 'failed': return 'status-error';
      default: return 'status-inactive';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span className="loading-text">Loading test overview...</span>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="container">
        <div className="error-state">
          <h2>Error Loading Test</h2>
          <p>{error || 'Test not found'}</p>
          <button onClick={() => navigate('/tests')} className="btn btn-primary">
            <ArrowLeft size={16} />
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Enhanced Header with Test and Machine Details */}
      <div className="page-header enhanced-header">
        <div className="header-top-row">
          <div className="header-left">
            <button onClick={() => navigate('/tests')} className="btn btn-secondary btn-icon">
              <ArrowLeft size={18} />
            </button>
            <div className="header-main-info">
              <div className="title-section">
                <h1 className="page-title enhanced-title">{test.test_name}</h1>
                <p className="page-subtitle">Test ID: {test.id} • Created: {new Date(test.test_created_at).toLocaleDateString()}</p>
              </div>
              <div className="machine-section">
                <div className="machine-info">
                  <Zap size={14} style={{ color: '#10b981' }} />
                  <span className="machine-name">{test.machine_name}</span>
                  <span className="machine-type">({test.machine_type_name || 'Unknown Type'})</span>
                </div>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="test-control-status-group">
              <div className="test-control-buttons">
                <button 
                  className="btn btn-secondary btn-icon"
                  onClick={() => navigate(`/tests/edit/${testId}`)}
                  title="Edit Test"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                {test.test_status === 'running' ? (
                  <button 
                    className="btn btn-danger btn-icon"
                    onClick={handleStopTest}
                    title="Stop Test"
                  >
                    <Square size={16} />
                    Stop Test
                  </button>
                ) : (
                  <button 
                    className="btn btn-success btn-icon"
                    onClick={handleStartTest}
                    title="Start Test"
                  >
                    <Play size={16} />
                    Start Test
                  </button>
                )}
                <button 
                  className="btn btn-primary btn-icon"
                  onClick={() => navigate(`/tests/analysis/${testId}`)}
                  title="Analysis"
                >
                  <Sparkles size={16} />
                  Analysis
                </button>
              </div>
              <span className={`status-card ${getStatusColor(test.test_status)}`}>
                {test.test_status === 'running' ? <Play size={14} /> : null}
                {test.test_status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions enhanced-actions">
          <div className="editable-controls-grid">
            <div className="editable-field">
              <div className="field-header">
                <span className="edit-label">Description:</span>
                {isEditingDescription && (
                  <div className="edit-buttons">
                    <button onClick={handleSaveDescription} className="header-btn save">
                      <Save size={12} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingDescription(false);
                        setEditedDescription(test.test_description || '');
                      }} 
                      className="header-btn cancel"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              {isEditingDescription ? (
                <div className="header-edit">
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="header-textarea"
                    placeholder="Add description..."
                    rows="3"
                  />
                </div>
              ) : (
                <span 
                  className="header-editable-text multiline" 
                  onClick={() => setIsEditingDescription(true)}
                  title="Click to edit description"
                >
                  {test.test_description || 'Add description...'}
                </span>
              )}
            </div>
            <div className="editable-field">
              <div className="field-header">
                <span className="edit-label">Note:</span>
                {isEditingNote && (
                  <div className="edit-buttons">
                    <button onClick={handleSaveNote} className="header-btn save">
                      <Save size={12} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingNote(false);
                        setEditedNote(test.test_notes || '');
                      }} 
                      className="header-btn cancel"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              {isEditingNote ? (
                <div className="header-edit">
                  <textarea
                    value={editedNote}
                    onChange={(e) => setEditedNote(e.target.value)}
                    className="header-textarea"
                    placeholder="Add note..."
                    rows="3"
                  />
                </div>
              ) : (
                <span 
                  className="header-editable-text multiline" 
                  onClick={() => setIsEditingNote(true)}
                  title="Click to edit note"
                >
                  {test.test_notes || 'Add note...'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="test-overview-layout">
        {/* Data Section - Sensors Table and Chart */}
        <div className="data-section">
          {/* Left Side - Sensors Table */}
          <div className="sensors-panel">
            <div className="card sensors-table-card">
              <div className="card-header">
                <div className="flex-center gap-10">
                  <Info size={20} style={{ color: '#f59e0b' }} />
                  <div>
                    <h3 className="card-title">Test Sensors</h3>
                    <p className="card-subtitle">{testSensors.length} sensors configured</p>
                  </div>
                </div>
              </div>
              <div className="card-body sensors-body">
                <div className="sensors-scroll-container">
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Sensor</th>
                        <th>Location</th>
                        <th>Type</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testSensors.map((sensor) => (
                        <tr 
                          key={sensor.id}
                          className={`sensor-row ${selectedSensorIds.has(sensor.id) ? 'selected' : ''}`}
                          onClick={(e) => handleSensorToggle(sensor.id, e)}
                        >
                          <td>
                            <div className="sensor-info">
                              {sensor.sensor_is_online ? (
                                <Wifi size={14} className="status-online" style={{ marginRight: '8px' }} />
                              ) : (
                                <WifiOff size={14} className="status-offline" style={{ marginRight: '8px' }} />
                              )}
                              <strong>{sensor.sensor_name}</strong>
                            </div>
                          </td>
                          <td>
                            <div className="sensor-location">
                              <MapPin size={12} />
                              {sensor.sensor_location || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="sensor-type">
                              <span>{sensor.sensor_type_name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="unit-badge">{sensor.sensor_type_unit || 'N/A'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {testSensors.length === 0 && (
                  <div className="empty-state">
                    <p>No sensors configured for this test</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Chart */}
          <div className="chart-panel">
            <div className="card chart-card">
              <div className="card-header">
                <div className="flex-center gap-10">
                  <Activity size={20} style={{ color: '#8b5cf6' }} />
                  <div>
                    <h3 className="card-title">Sensor Data Visualization</h3>
                    <p className="card-subtitle">
                      {selectedSensorIds.size > 0 
                        ? `${selectedSensorIds.size} sensor${selectedSensorIds.size > 1 ? 's' : ''} selected • ${dataMode === 'raw' ? 'Raw data (last 10000 points)' : 'Aggregated data (10s avg)'}`
                        : 'Click on sensors to view data'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="card-body chart-container-wrapper">
                {selectedSensorIds.size === 0 ? (
                  <div className="chart-empty-state">
                    <Activity size={64} style={{ color: '#d1d5db' }} />
                    <h4>No sensors selected</h4>
                    <p>Click on sensors in the table to display their data on this chart</p>
                  </div>
                ) : chartLoading ? (
                  <div className="chart-loading">
                    <div className="spinner"></div>
                    <p>Loading chart data...</p>
                  </div>
                ) : (
                  <div className="chart-container">
                    <div className="chart-controls">
                      <div className="chart-control-buttons">
                        {dataMode === 'aggregated' && (
                          <select
                            className="form-control"
                            value={aggregationType}
                            onChange={(e) => setAggregationType(e.target.value)}
                            style={{ 
                              width: 'auto', 
                              minWidth: '160px',
                              height: '38px',
                              padding: '6px 12px',
                              fontSize: '14px',
                              marginRight: '10px'
                            }}
                            title="Select aggregation type"
                            disabled={chartLoading || isRefreshing}
                          >
                            <option value="absolute">Absolute Values</option>
                            <option value="regular">Regular Values</option>
                          </select>
                        )}
                        <div 
                          className={`data-mode-toggle ${chartLoading || isRefreshing ? 'disabled' : ''}`}
                          style={{ marginRight: '10px' }}
                        >
                          <div className="toggle-background" style={{
                            transform: dataMode === 'aggregated' ? 'translateX(0)' : 'translateX(100%)'
                          }} />
                          <div 
                            className={`toggle-option ${dataMode === 'aggregated' ? 'active' : ''}`}
                            onClick={() => !chartLoading && !isRefreshing && handleDataModeChange('aggregated')}
                          >
                            📊 Aggregated
                          </div>
                          <div 
                            className={`toggle-option ${dataMode === 'raw' ? 'active' : ''}`}
                            onClick={() => !chartLoading && !isRefreshing && handleDataModeChange('raw')}
                          >
                            📈 Raw
                          </div>
                        </div>
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={handleRefresh}
                          disabled={selectedSensorIds.size === 0 || isRefreshing || chartLoading}
                          title="Refresh chart data"
                          style={{ marginRight: '10px' }}
                        >
                          🔄 Refresh
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={resetZoom}
                          title="Reset Zoom"
                        >
                          ↺ Reset Zoom
                        </button>
                      </div>
                      <div className="chart-instructions">
                        <small>💡 Use toolbar to zoom/pan • Drag to select area • Double-click to reset zoom • Ctrl+0 to reset</small>
                      </div>
                    </div>
                    <Plot 
                      key={`plot-${dataMode}-${aggregationType}`}
                      ref={chartRef}
                      data={plotData}
                      layout={plotLayout}
                      config={plotConfig}
                      style={{width: '100%', height: '100%'}}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestOverview;