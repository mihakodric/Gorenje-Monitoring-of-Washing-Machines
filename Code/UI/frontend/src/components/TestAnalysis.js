import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { ArrowLeft } from 'lucide-react';
import { testsAPI, testRelationsAPI, measurementsAPI } from '../api';
import '../styles/test-analysis.css';

const TestAnalysis = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [testSensors, setTestSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    loadTestData();
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

  const buildTracesForSensor = (sensor, measurements, subplotIndex) => {
    const sensorColors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
    ];

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
        line: { color: sensorColors[colorIndex % sensorColors.length], width: 2 },
        marker: { color: sensorColors[colorIndex % sensorColors.length], size: 3 },
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

    // Calculate height: minimum 150px per sensor, but use available space if more
    const minHeightPerSensor = 100;
    const minTotalHeight = numSensors * minHeightPerSensor;
    
    // Available viewport height (subtract header, margins, and padding - more conservative estimate)
    const availableHeight = window.innerHeight - 200;
    
    // Use the larger of: minimum required height or available height
    const plotHeight = Math.max(minTotalHeight, availableHeight);

    const layout = {
      grid: { rows: numSensors, columns: 1, pattern: 'independent' },
      hovermode: 'closest',
      showlegend: false, // Disable global legend, use annotations instead
      margin: { l: 60, r: 20, t: 20, b: 60 },
      autosize: true,
      height: plotHeight,
      annotations: []
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
        matches: 'x', // This makes all x-axes linked!
        linecolor: '#cbd5e1',
        linewidth: 2,
        mirror: true
      };

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
      
      const sensorColors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
      ];
      
      const channelLegends = Object.keys(channelGroups).sort().map((channel, colorIndex) => {
        const color = sensorColors[colorIndex % sensorColors.length];
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
              />
            </div>
          )}
        </div>

        {/* Right side - Segment definition panel */}
        <div className="segments-section">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Segment Definition</h3>
              <p className="card-subtitle">Define analysis segments</p>
            </div>
            <div className="card-body">
              <div className="segment-placeholder">
                <p>Segment definition tools will be added here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAnalysis;
