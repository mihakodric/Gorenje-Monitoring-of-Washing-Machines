import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { ArrowLeft, Plus, Edit, Save, X, Trash2 } from 'lucide-react';
import { testsAPI, testRelationsAPI, measurementsAPI, testSegmentsAPI } from '../api';
import '../styles/test-analysis.css';

// Sensor color palette - shared across all visualizations
const SENSOR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
];

// Segment color palette - used for shaded areas on plots
const SEGMENT_TRANSPARENCY_FILL = 0.10;
const SEGMENT_TRANSPARENCY_BORDER = 0.7;
const SEGMENT_COLORS = [
  `rgba(59, 130, 246, ${SEGMENT_TRANSPARENCY_FILL})`,   // blue
  `rgba(239, 68, 68, ${SEGMENT_TRANSPARENCY_FILL})`,    // red
  `rgba(16, 185, 129, ${SEGMENT_TRANSPARENCY_FILL})`,   // green
  `rgba(245, 158, 11, ${SEGMENT_TRANSPARENCY_FILL})`,   // orange
  `rgba(139, 92, 246, ${SEGMENT_TRANSPARENCY_FILL})`,   // purple
  `rgba(236, 72, 153, ${SEGMENT_TRANSPARENCY_FILL})`,   // pink
];

const TestAnalysis = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [testSensors, setTestSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [loadingData, setLoadingData] = useState(false);
  
  // Segment state
  const [segments, setSegments] = useState([]);
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editedSegment, setEditedSegment] = useState({});
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [newSegment, setNewSegment] = useState({ segment_name: '', start_time: '', end_time: '' });
  
  // Store current x-axis range and selected segment for highlighting
  const xAxisRangeRef = useRef(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);

  useEffect(() => {
    loadTestData();
    loadSegments();
  }, [testId]);

  const loadTestData = async () => {
    try {
      setLoading(true);
      
      // Load test details
      const testResponse = await testsAPI.getById(testId);
      const testData = testResponse.data;
      setTest(testData);

      // Load test relations (sensors)
      const relationsResponse = await testRelationsAPI.getByTestId(testId);
      const relations = relationsResponse.data;

      // Group sensors by sensor_type_name alphabetically
      const groupedSensors = relations.reduce((acc, sensor) => {
        const sensorType = sensor.sensor_type_name || 'Unknown';
        if (!acc[sensorType]) {
          acc[sensorType] = [];
        }
        acc[sensorType].push(sensor);
        return acc;
      }, {});

      // Sort sensor types alphabetically and sensors within each type
      const sortedSensorTypes = Object.keys(groupedSensors).sort();
      const sortedSensors = sortedSensorTypes.flatMap(type => 
        groupedSensors[type].sort((a, b) => a.sensor_name.localeCompare(b.sensor_name))
      );

      setTestSensors(sortedSensors);

      // Load aggregated data for all sensors
      setLoadingData(true);
      const dataPromises = sortedSensors.map(sensor => 
        measurementsAPI.getSensorDataAvg(sensor.id, { limit: 10000 })
          .then(response => ({ sensorId: sensor.id, data: response.data }))
      );
      
      const results = await Promise.all(dataPromises);
      const dataMap = {};
      results.forEach(result => {
        dataMap[result.sensorId] = result.data;
      });
      setSensorData(dataMap);
      
    } catch (error) {
      console.error('Error loading test data:', error);
      setError('Failed to load test data');
    } finally {
      setLoading(false);
      setLoadingData(false);
    }
  };

  const loadSegments = async () => {
    try {
      const response = await testSegmentsAPI.getByTestId(testId);
      setSegments(response.data);
    } catch (error) {
      console.error('Error loading segments:', error);
    }
  };

  const handleAddSegment = async () => {
    try {
      await testSegmentsAPI.create({
        test_id: parseInt(testId),
        segment_name: newSegment.segment_name,
        start_time: new Date(newSegment.start_time).toISOString(),
        end_time: new Date(newSegment.end_time).toISOString()
      });
      setNewSegment({ segment_name: '', start_time: '', end_time: '' });
      setIsAddingSegment(false);
      loadSegments();
    } catch (error) {
      console.error('Error adding segment:', error);
      alert('Failed to add segment: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleEditSegment = (segment) => {
    setEditingSegmentId(segment.id);
    setEditedSegment({
      segment_name: segment.segment_name,
      start_time: new Date(segment.start_time).toISOString().slice(0, 19),
      end_time: new Date(segment.end_time).toISOString().slice(0, 19)
    });
  };

  const handleSaveSegment = async (segmentId) => {
    try {
      await testSegmentsAPI.update(segmentId, {
        segment_name: editedSegment.segment_name,
        start_time: new Date(editedSegment.start_time).toISOString(),
        end_time: new Date(editedSegment.end_time).toISOString()
      });
      setEditingSegmentId(null);
      setEditedSegment({});
      loadSegments();
    } catch (error) {
      console.error('Error updating segment:', error);
      alert('Failed to update segment: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteSegment = async (segmentId) => {
    if (window.confirm('Are you sure you want to delete this segment?')) {
      try {
        await testSegmentsAPI.delete(segmentId);
        loadSegments();
      } catch (error) {
        console.error('Error deleting segment:', error);
        alert('Failed to delete segment: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingSegmentId(null);
    setEditedSegment({});
  };

  const handleCancelAdd = () => {
    setIsAddingSegment(false);
    setNewSegment({ segment_name: '', start_time: '', end_time: '' });
  };

  const handleSegmentClick = (segment) => {
    // Don't change selection if currently editing
    if (editingSegmentId === segment.id) return;
    
    // Toggle selection: if clicking the same segment, deselect it
    setSelectedSegmentId(prevId => prevId === segment.id ? null : segment.id);
  };

  const handleStartAddSegment = () => {
    // Auto-detect start and end time from stored x-axis range
    try {
      if (xAxisRangeRef.current && xAxisRangeRef.current.length === 2) {
        // Convert to local time format for datetime-local input
        const startDate = new Date(xAxisRangeRef.current[0]);
        const endDate = new Date(xAxisRangeRef.current[1]);
        
        // Format as YYYY-MM-DDTHH:mm:ss in local timezone
        const formatLocalDateTime = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };
        
        setNewSegment({ 
          segment_name: '', 
          start_time: formatLocalDateTime(startDate), 
          end_time: formatLocalDateTime(endDate)
        });
        setIsAddingSegment(true);
        return;
      }
    } catch (error) {
      console.error('Error detecting x-axis range:', error);
    }
    
    // Fallback: empty values
    setNewSegment({ segment_name: '', start_time: '', end_time: '' });
    setIsAddingSegment(true);
  };

  const handlePlotRelayout = (eventData) => {
    // Store x-axis range when user zooms/pans
    // Use setTimeout to avoid blocking the event
    setTimeout(() => {
      if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
        xAxisRangeRef.current = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
      } else if (eventData['xaxis.range']) {
        xAxisRangeRef.current = eventData['xaxis.range'];
      }
    }, 0);
  };

  const buildTracesForSensor = (sensor, measurements, subplotIndex) => {
    // Group by channel
    const channelGroups = {};
    measurements.forEach(m => {
      const channel = m.measurement_channel || 'main';
      if (!channelGroups[channel]) channelGroups[channel] = [];
      channelGroups[channel].push(m);
    });

    const traces = [];
    let colorIndex = 0;

    Object.keys(channelGroups).sort().forEach(channel => {
      const channelData = channelGroups[channel].sort(
        (a, b) => new Date(a.measurement_timestamp) - new Date(b.measurement_timestamp)
      );

      const times = channelData.map(m => new Date(m.measurement_timestamp));
      const values = channelData.map(m => parseFloat(m.avg_value));

      const traceName = channel === 'main' || channel === 'null'
        ? sensor.sensor_name
        : `${sensor.sensor_name} - ${channel.toUpperCase()}`;

      traces.push({
        x: times,
        y: values,
        type: 'scattergl',
        mode: 'lines+markers',
        name: traceName,
        line: { color: SENSOR_COLORS[colorIndex % SENSOR_COLORS.length], width: 2 },
        marker: { color: SENSOR_COLORS[colorIndex % SENSOR_COLORS.length], size: 3 },
        xaxis: subplotIndex === 0 ? 'x' : `x${subplotIndex + 1}`,
        yaxis: subplotIndex === 0 ? 'y' : `y${subplotIndex + 1}`,
        hovertemplate: `<b>${traceName}</b><br>` +
          `Time: %{x}<br>` +
          `Value: %{y:.3f}${sensor.sensor_type_unit || ''}<br>` +
          `<extra></extra>`,
        connectgaps: false,
        showlegend: false
      });

      colorIndex++;
    });

    return traces;
  };

  const buildSubplotLayout = () => {
    const numSensors = testSensors.length;
    if (numSensors === 0) return {};

    const rowHeight = 1 / numSensors;
    const gap = 0.01; // Small gap between subplots
    const actualRowHeight = rowHeight - gap;

    // Calculate height: minimum per sensor, but fit to available space
    const minHeightPerSensor = 80;
    const minTotalHeight = numSensors * minHeightPerSensor;
    
    // Available viewport height (subtract header, margins, and padding)
    const availableHeight = window.innerHeight - 170;
    
    // Use the larger of: minimum required height or available height
    const plotHeight = Math.max(minTotalHeight, availableHeight);

    const layout = {
      grid: { rows: numSensors, columns: 1, pattern: 'independent' },
      hovermode: 'closest',
      showlegend: false, // Disable global legend, use annotations instead
      margin: { l: 60, r: 20, t: 20, b: 60 },
      autosize: true,
      height: plotHeight,
      annotations: [],
      shapes: [],
      uirevision: 'preserve-zoom' // Always preserve zoom state
    };

    // Create axes for each subplot
    testSensors.forEach((sensor, index) => {
      const isLast = index === numSensors - 1;
      const yPosition = 1 - (index * rowHeight);
      const domain = [yPosition - actualRowHeight, yPosition];

      const xAxisKey = index === 0 ? 'xaxis' : `xaxis${index + 1}`;
      const yAxisKey = index === 0 ? 'yaxis' : `yaxis${index + 1}`;

      // X-axis configuration
      layout[xAxisKey] = {
        type: 'date',
        showgrid: true,
        gridcolor: 'rgba(0, 0, 0, 0.1)',
        showticklabels: isLast,
        domain: [0, 1],
        anchor: index === 0 ? 'y' : `y${index + 1}`,
        linecolor: '#cbd5e1',
        linewidth: 2,
        mirror: true
      };
      
      // Link all x-axes to the first one (except the first itself)
      if (index > 0) {
        layout[xAxisKey].matches = 'x';
      }

      // Y-axis configuration
      layout[yAxisKey] = {
        title: {
          text: sensor.sensor_type_unit || '',
          font: { size: 12 }
        },
        showgrid: true,
        gridcolor: 'rgba(0, 0, 0, 0.1)',
        domain: domain,
        anchor: index === 0 ? 'x' : `x${index + 1}`,
        linecolor: '#cbd5e1',
        linewidth: 2,
        mirror: true
      };

      // Add sensor name and legend info as annotation at top of each subplot
      const measurements = sensorData[sensor.id] || [];
      const channelGroups = {};
      measurements.forEach(m => {
        const channel = m.measurement_channel || 'main';
        if (!channelGroups[channel]) channelGroups[channel] = [];
        channelGroups[channel].push(m);
      });
      
      const channelLegends = Object.keys(channelGroups).sort().map((channel, colorIndex) => {
        const color = SENSOR_COLORS[colorIndex % SENSOR_COLORS.length];
        if (channel === 'main' || channel === 'null') {
            // skip main channel in legend
            return '';
        } else {
          return `<span style="color:${color};">●</span> ${channel.toUpperCase()}`;
        }
      }).join('  ');

      const legendText = `<b>${sensor.sensor_name}</b> • ${sensor.sensor_location || 'N/A'} • ${channelLegends}`;

      layout.annotations.push({
        text: legendText,
        xref: 'paper',
        yref: index === 0 ? 'y domain' : `y${index + 1} domain`,
        x: 0.5,
        y: 0.98,
        xanchor: 'center',
        yanchor: 'top',
        showarrow: false,
        font: { size: 10, color: '#1f2937' },
        bgcolor: 'rgba(255, 255, 255, 0.9)',
        bordercolor: '#e2e8f0',
        borderwidth: 1,
        borderpad: 4
      });
    });

    // Add segment shapes (shaded areas) for each subplot
    segments.forEach((segment, segmentIndex) => {
      const segmentColor = SEGMENT_COLORS[segmentIndex % SEGMENT_COLORS.length];
      const isSelected = segment.id === selectedSegmentId;
      
      // Add shape for each subplot
      testSensors.forEach((sensor, sensorIndex) => {
        const xAxisRef = sensorIndex === 0 ? 'x' : `x${sensorIndex + 1}`;
        const yAxisRef = sensorIndex === 0 ? 'y' : `y${sensorIndex + 1}`;
        
        layout.shapes.push({
          type: 'rect',
          xref: xAxisRef,
          yref: yAxisRef + ' domain',
          x0: new Date(segment.start_time).getTime(),
          x1: new Date(segment.end_time).getTime(),
          y0: 0,
          y1: 1,
          fillcolor: segmentColor,
          line: {
            color: SEGMENT_COLORS[segmentIndex % SEGMENT_COLORS.length].replace(`${SEGMENT_TRANSPARENCY_FILL}`, `${SEGMENT_TRANSPARENCY_BORDER}`),
            width: isSelected ? 3 : 1  // Thicker border for selected segment
          },
          layer: 'below'
        });
      });
    });

    return layout;
  };

  const buildAllTraces = () => {
    const allTraces = [];
    testSensors.forEach((sensor, index) => {
      const measurements = sensorData[sensor.id] || [];
      const traces = buildTracesForSensor(sensor, measurements, index);
      allTraces.push(...traces);
    });
    return allTraces;
  };

  const plotConfig = {
    displayModeBar: true,
    modeBarButtonsToAdd: ['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
    modeBarButtonsToRemove: ['toImage'],
    responsive: true,
    displaylogo: false
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span className="loading-text">Loading test analysis...</span>
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
          <button onClick={() => navigate(`/tests/overview/${testId}`)} className="btn btn-primary">
            <ArrowLeft size={16} />
            Back to Test Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container analysis-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate(`/tests/overview/${testId}`)} className="btn btn-secondary btn-icon">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">Test Analysis</h1>
            <p className="page-subtitle">{test.test_name} • {testSensors.length} sensors</p>
          </div>
        </div>
      </div>

      {/* Main Layout: 2/3 plots, 1/3 segment definition */}
      <div className="analysis-layout">
        {/* Left side - Sensor plots */}
        <div className="plots-section">
          {loadingData ? (
            <div className="loading-message">
              <div className="spinner"></div>
              <p>Loading sensor data...</p>
            </div>
          ) : testSensors.length === 0 ? (
            <div className="empty-state">
              <p>No sensors configured for this test</p>
            </div>
          ) : (
            <div className="subplot-container">
              <Plot
                data={buildAllTraces()}
                layout={buildSubplotLayout()}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
                onRelayout={handlePlotRelayout}
              />
            </div>
          )}
        </div>

        {/* Right side - Segment definition panel */}
        <div className="segments-section">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Segment Definition</h3>
              <p className="card-subtitle">Define time segments for analysis</p>
            </div>
            <div className="card-body segments-table-body">
              <div className="segments-table-container">
                <table className="segments-table">
                  <thead>
                    <tr>
                      <th>Segment Name</th>
                      <th>Time Range</th>
                      <th className="sticky-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map(segment => (
                      <tr key={segment.id}>
                        {editingSegmentId === segment.id ? (
                          <>
                            <td>
                              <input
                                type="text"
                                className="segment-input"
                                value={editedSegment.segment_name}
                                onChange={(e) => setEditedSegment({ ...editedSegment, segment_name: e.target.value })}
                              />
                            </td>
                            <td>
                              <div className="segment-datetime-stack">
                                <input
                                  type="datetime-local"
                                  step="1"
                                  className="segment-input"
                                  value={editedSegment.start_time}
                                  onChange={(e) => setEditedSegment({ ...editedSegment, start_time: e.target.value })}
                                  placeholder="Start"
                                />
                                <input
                                  type="datetime-local"
                                  step="1"
                                  className="segment-input"
                                  value={editedSegment.end_time}
                                  onChange={(e) => setEditedSegment({ ...editedSegment, end_time: e.target.value })}
                                  placeholder="End"
                                />
                              </div>
                            </td>
                            <td className="sticky-actions">
                              <div className="segment-actions">
                                <button
                                  className="btn-icon-sm btn-success-sm"
                                  onClick={() => handleSaveSegment(segment.id)}
                                  disabled={!editedSegment.segment_name || !editedSegment.start_time || !editedSegment.end_time}
                                  title="Save"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  className="btn-icon-sm btn-secondary-sm"
                                  onClick={handleCancelEdit}
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td 
                              onClick={() => handleSegmentClick(segment)}
                              style={{ cursor: 'pointer' }}
                              title="Click to highlight this segment"
                            >
                              {segment.segment_name}
                            </td>
                            <td 
                              onClick={() => handleSegmentClick(segment)}
                              style={{ cursor: 'pointer' }}
                              title="Click to highlight this segment"
                            >
                              <div className="segment-datetime-stack">
                                <div style={{ fontSize: '11px' }}>{new Date(segment.start_time).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(segment.end_time).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                              </div>
                            </td>
                            <td className="sticky-actions">
                              <div className="segment-actions">
                                <button
                                  className="btn-icon-sm btn-primary-sm"
                                  onClick={() => handleEditSegment(segment)}
                                  title="Edit"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  className="btn-icon-sm btn-danger-sm"
                                  onClick={() => handleDeleteSegment(segment.id)}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {isAddingSegment && (
                      <tr className="adding-row">
                        <td>
                          <input
                            type="text"
                            className="segment-input"
                            placeholder="Segment name"
                            value={newSegment.segment_name}
                            onChange={(e) => setNewSegment({ ...newSegment, segment_name: e.target.value })}
                          />
                        </td>
                        <td>
                          <div className="segment-datetime-stack">
                            <input
                              type="datetime-local"
                              step="1"
                              className="segment-input"
                              value={newSegment.start_time}
                              onChange={(e) => setNewSegment({ ...newSegment, start_time: e.target.value })}
                              placeholder="Start"
                            />
                            <input
                              type="datetime-local"
                              step="1"
                              className="segment-input"
                              value={newSegment.end_time}
                              onChange={(e) => setNewSegment({ ...newSegment, end_time: e.target.value })}
                              placeholder="End"
                            />
                          </div>
                        </td>
                        <td className="sticky-actions">
                          <div className="segment-actions">
                            <button
                              className="btn-icon-sm btn-success-sm"
                              onClick={handleAddSegment}
                              disabled={!newSegment.segment_name || !newSegment.start_time || !newSegment.end_time}
                              title="Save"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              className="btn-icon-sm btn-secondary-sm"
                              onClick={handleCancelAdd}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn-primary btn-add-segment"
                onClick={handleStartAddSegment}
                disabled={isAddingSegment}
              >
                <Plus size={16} />
                Add Segment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAnalysis;
