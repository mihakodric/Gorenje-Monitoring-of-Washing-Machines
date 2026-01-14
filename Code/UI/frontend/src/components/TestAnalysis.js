import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { ArrowLeft, Plus, Edit, Save, X, Trash2, RefreshCw, Scissors, Download } from 'lucide-react';
import { testsAPI, testRelationsAPI, measurementsAPI, testSegmentsAPI } from '../api';
import { SENSOR_COLORS, SEGMENT_COLORS, SEGMENT_TRANSPARENCY_FILL, SEGMENT_TRANSPARENCY_BORDER, hexToRgba } from '../constants/colors';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Segment state
  const [segments, setSegments] = useState([]);
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editedSegment, setEditedSegment] = useState({});
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [newSegment, setNewSegment] = useState({ segment_name: '', start_time: '', end_time: '' });
  
  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState('');
  const [cropEnd, setCropEnd] = useState('');
  const [cropping, setCropping] = useState(false);
  
  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDataType, setExportDataType] = useState('aggregated');
  const [exportTimeRange, setExportTimeRange] = useState('whole');
  const [exportSegmentId, setExportSegmentId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null); // { filename, progress, status }
  
  // Store current x-axis range and selected segment for highlighting
  const xAxisRangeRef = useRef(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  
  // Aggregation type for plotting
  const [aggregationType, setAggregationType] = useState('absolute'); // 'absolute' or 'regular'

  useEffect(() => {
    loadTestData();
    loadSegments();
  }, [testId]);

  // Force plot update when aggregation type changes
  useEffect(() => {
    // Only trigger if we have sensor data loaded
    if (Object.keys(sensorData).length > 0) {
      // Force re-render by updating a dummy state or just rely on React's re-render
      // Since aggregationType is used in buildTracesForSensor, changing it will automatically update the plot
    }
  }, [aggregationType]);

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

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      
      // Reload sensor data for all sensors
      const dataPromises = testSensors.map(sensor => 
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
      console.error('Error refreshing data:', error);
      alert('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartCrop = () => {
    // Calculate the earliest and latest timestamps from all sensor data
    let earliestTime = null;
    let latestTime = null;
    
    Object.values(sensorData).forEach(data => {
      if (data && data.length > 0) {
        data.forEach(point => {
          const timestamp = new Date(point.measurement_timestamp);
          if (!earliestTime || timestamp < earliestTime) {
            earliestTime = timestamp;
          }
          if (!latestTime || timestamp > latestTime) {
            latestTime = timestamp;
          }
        });
      }
    });
    
    if (earliestTime && latestTime) {
      // Format for datetime-local input (YYYY-MM-DDTHH:mm:ss)
      const formatForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };
      
      setCropStart(formatForInput(earliestTime));
      setCropEnd(formatForInput(latestTime));
      setIsCropping(true);
    } else {
      alert('No data available to crop');
    }
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCropStart('');
    setCropEnd('');
  };

  const handleConfirmCrop = async () => {
    if (!cropStart || !cropEnd) {
      alert('Please select both start and end times');
      return;
    }
    
    const startTime = new Date(cropStart);
    const endTime = new Date(cropEnd);
    
    if (startTime >= endTime) {
      alert('Start time must be before end time');
      return;
    }
    
    // Count how many measurements will be deleted
    let totalMeasurements = 0;
    let measurementsToDelete = 0;
    
    Object.values(sensorData).forEach(data => {
      if (data && data.length > 0) {
        totalMeasurements += data.length;
        data.forEach(point => {
          const timestamp = new Date(point.measurement_timestamp);
          if (timestamp < startTime || timestamp > endTime) {
            measurementsToDelete++;
          }
        });
      }
    });
    
    const confirmMessage = 
      `⚠️ WARNING: This will permanently delete ${measurementsToDelete} measurements outside the range:\n\n` +
      `Start: ${startTime.toLocaleString()}\n` +
      `End: ${endTime.toLocaleString()}\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Do you want to proceed?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      setCropping(true);
      
      const response = await measurementsAPI.cropMeasurements(
        parseInt(testId),
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      alert(
        `✅ Crop successful!\n\n` +
        `Deleted:\n` +
        `- ${response.data.raw_deleted} raw measurements\n` +
        `- ${response.data.avg_deleted} aggregated measurements\n` +
        `- Total: ${response.data.total_deleted} measurements`
      );
      
      // Reload data
      setIsCropping(false);
      setCropStart('');
      setCropEnd('');
      await handleRefreshData();
      
    } catch (error) {
      console.error('Error cropping measurements:', error);
      alert(`❌ Failed to crop measurements:\n${error.response?.data?.detail || error.message}`);
    } finally {
      setCropping(false);
    }
  };

  const handleExport = async () => {
    if (exportTimeRange === 'segment' && !exportSegmentId) {
      alert('Please select a segment to export');
      return;
    }
    
    try {
      setExporting(true);
      
      const params = {
        test_id: parseInt(testId),
        data_type: exportDataType,
        time_range: exportTimeRange,
      };
      
      if (exportTimeRange === 'segment') {
        params.segment_id = parseInt(exportSegmentId);
      }
      
      // Create filename for display
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const segmentName = exportTimeRange === 'segment' 
        ? `_${segments.find(s => s.id === parseInt(exportSegmentId))?.segment_name || 'segment'}` 
        : '';
      const filename = `test_${testId}_${exportDataType}${segmentName}_${timestamp}.parquet`;
      
      // Start export job
      const response = await measurementsAPI.exportMeasurements(params);
      const jobId = response.data.job_id;
      
      // Close modal and show progress notification
      setShowExportModal(false);
      setExporting(false);
      setExportProgress({ filename, progress: 0, status: 'queued' });
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await measurementsAPI.getExportStatus(jobId);
          const status = statusResponse.data;
          
          setExportProgress({
            filename,
            progress: status.progress || 0,
            status: status.status
          });
          
          if (status.status === 'completed') {
            clearInterval(pollInterval);
            
            // Download the file
            const downloadResponse = await measurementsAPI.downloadExport(jobId);
            const blob = new Blob([downloadResponse.data], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            // Keep notification visible for 3 seconds after completion
            setTimeout(() => {
              setExportProgress(null);
            }, 3000);
            
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setExportProgress({
              filename,
              progress: 0,
              status: 'failed',
              error: status.error
            });
            
            // Auto-hide failed notification after 5 seconds
            setTimeout(() => {
              setExportProgress(null);
            }, 5000);
          }
          // If status is 'queued' or 'processing', keep polling
        } catch (error) {
          console.error('Error checking export status:', error);
          clearInterval(pollInterval);
          setExportProgress({
            filename,
            progress: 0,
            status: 'failed',
            error: error.message
          });
          
          setTimeout(() => {
            setExportProgress(null);
          }, 5000);
        }
      }, 2000); // Poll every 2 seconds
      
    } catch (error) {
      console.error('Error starting export:', error);
      alert(`❌ Failed to start export:\n${error.response?.data?.detail || error.message}`);
      setExporting(false);
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
    // Format as YYYY-MM-DDTHH:mm:ss in local timezone
    const formatLocalDateTime = (dateString) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };
    
    setEditingSegmentId(segment.id);
    setEditedSegment({
      segment_name: segment.segment_name,
      start_time: formatLocalDateTime(segment.start_time),
      end_time: formatLocalDateTime(segment.end_time)
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
      
      const baseTraceName = channel === 'main' || channel === 'null'
        ? sensor.sensor_name
        : `${sensor.sensor_name} - ${channel.toUpperCase()}`;
      
      const color = SENSOR_COLORS[colorIndex % SENSOR_COLORS.length];
      const suffix = aggregationType === 'absolute' ? '_abs_value' : '_value';
      
      const minValues = channelData.map(m => parseFloat(m[`min${suffix}`]));
      const maxValues = channelData.map(m => parseFloat(m[`max${suffix}`]));
      const avgValues = channelData.map(m => parseFloat(m[`avg${suffix}`]));
      
      // Shaded area between min and max
      traces.push({
        x: [...times, ...times.slice().reverse()],
        y: [...maxValues, ...minValues.slice().reverse()],
        fill: 'toself',
        fillcolor: hexToRgba(color, 0.1),
        type: 'scattergl',
        mode: 'none',
        name: `${baseTraceName} Range`,
        xaxis: subplotIndex === 0 ? 'x' : `x${subplotIndex + 1}`,
        yaxis: subplotIndex === 0 ? 'y' : `y${subplotIndex + 1}`,
        showlegend: false,
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
        line: { color: color, width: 0.5 },
        xaxis: subplotIndex === 0 ? 'x' : `x${subplotIndex + 1}`,
        yaxis: subplotIndex === 0 ? 'y' : `y${subplotIndex + 1}`,
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
        line: { color: color, width: 0.5},
        xaxis: subplotIndex === 0 ? 'x' : `x${subplotIndex + 1}`,
        yaxis: subplotIndex === 0 ? 'y' : `y${subplotIndex + 1}`,
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
        line: { color: color, width: 2 },
        marker: { color: color, size: 3 },
        xaxis: subplotIndex === 0 ? 'x' : `x${subplotIndex + 1}`,
        yaxis: subplotIndex === 0 ? 'y' : `y${subplotIndex + 1}`,
        hovertemplate: `<b>Average</b><br>` +
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

    // Calculate height: give each sensor reasonable space
    const minHeightPerSensor = 120; // Minimum height per sensor for good visibility
    const maxHeightPerSensor = 250; // Maximum height per sensor to show more sensors at once
    
    // Available viewport height (subtract header, margins, and padding)
    const availableHeight = window.innerHeight - 170;
    
    // Calculate ideal height per sensor based on available space
    const idealHeightPerSensor = availableHeight / numSensors;
    
    // Use constrained height per sensor: at least min, at most max, prefer ideal
    const heightPerSensor = Math.max(minHeightPerSensor, Math.min(maxHeightPerSensor, idealHeightPerSensor));
    const plotHeight = numSensors * heightPerSensor;

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

    // Add crop boundary lines if in cropping mode
    if (isCropping && cropStart && cropEnd) {
      const cropStartTime = new Date(cropStart).getTime();
      const cropEndTime = new Date(cropEnd).getTime();
      
      testSensors.forEach((sensor, sensorIndex) => {
        const xAxisRef = sensorIndex === 0 ? 'x' : `x${sensorIndex + 1}`;
        const yAxisRef = sensorIndex === 0 ? 'y' : `y${sensorIndex + 1}`;
        
        // Start line (green)
        layout.shapes.push({
          type: 'line',
          xref: xAxisRef,
          yref: yAxisRef + ' domain',
          x0: cropStartTime,
          x1: cropStartTime,
          y0: 0,
          y1: 1,
          line: {
            color: '#10b981',
            width: 3,
            dash: 'dot'
          },
          layer: 'above'
        });
        
        // End line (red)
        layout.shapes.push({
          type: 'line',
          xref: xAxisRef,
          yref: yAxisRef + ' domain',
          x0: cropEndTime,
          x1: cropEndTime,
          y0: 0,
          y1: 1,
          line: {
            color: '#ef4444',
            width: 3,
            dash: 'dot'
          },
          layer: 'above'
        });
      });
      
      // Add annotations for crop boundaries on the first subplot
      layout.annotations.push({
        text: 'Crop Start',
        xref: 'x',
        yref: 'paper',
        x: cropStartTime,
        y: 1.02,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: { size: 11, color: '#10b981', weight: 'bold' },
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        bordercolor: '#10b981',
        borderwidth: 2,
        borderpad: 3
      });
      
      layout.annotations.push({
        text: 'Crop End',
        xref: 'x',
        yref: 'paper',
        x: cropEndTime,
        y: 1.02,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: { size: 11, color: '#ef4444', weight: 'bold' },
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        bordercolor: '#ef4444',
        borderwidth: 2,
        borderpad: 3
      });
    }

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
      <div className="page-header" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <div className="header-left">
          <button onClick={() => navigate(`/tests/overview/${testId}`)} className="btn btn-secondary btn-icon">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">Test Analysis</h1>
            <p className="page-subtitle">{test.test_name} • {testSensors.length} sensors</p>
          </div>
        </div>
        <div className="header-right" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flexShrink: 0 }}>
          {isCropping ? (
            <>
              <label style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', margin: 0 }}>Start:</label>
              <input
                type="datetime-local"
                step="1"
                className="form-control"
                value={cropStart}
                onChange={(e) => setCropStart(e.target.value)}
                style={{ width: '180px', height: '38px', fontSize: '12px', flexShrink: 0, margin: 0 }}
              />
              <label style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', margin: 0 }}>End:</label>
              <input
                type="datetime-local"
                step="1"
                className="form-control"
                value={cropEnd}
                onChange={(e) => setCropEnd(e.target.value)}
                style={{ width: '180px', height: '38px', fontSize: '12px', flexShrink: 0, margin: 0 }}
              />
              <button 
                className="btn btn-danger btn-icon"
                onClick={handleConfirmCrop}
                disabled={cropping || !cropStart || !cropEnd}
                style={{ whiteSpace: 'nowrap', flexShrink: 0, margin: 0 }}
              >
                <Scissors size={14} />
                {cropping ? 'Cropping...' : 'Crop'}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleCancelCrop}
                disabled={cropping}
                style={{ whiteSpace: 'nowrap', flexShrink: 0, margin: 0 }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-secondary btn-icon"
                onClick={handleStartCrop}
                disabled={isRefreshing || loadingData || Object.keys(sensorData).length === 0}
                title="Crop Data"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, margin: 0 }}
              >
                <Scissors size={14} />
                Crop
              </button>
              <button 
                className="btn btn-primary btn-icon"
                onClick={handleRefreshData}
                disabled={isRefreshing || loadingData}
                title="Refresh Data"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, margin: 0 }}
              >
                <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
                Refresh
              </button>
              <button 
                className="btn btn-success btn-icon"
                onClick={() => setShowExportModal(true)}
                disabled={isRefreshing || loadingData || Object.keys(sensorData).length === 0}
                title="Export Data"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, margin: 0 }}
              >
                <Download size={14} />
                Export
              </button>
            </>
          )}
          <select
            className="form-control"
            value={aggregationType}
            onChange={(e) => setAggregationType(e.target.value)}
            style={{ 
              width: '150px',
              height: '38px',
              padding: '6px 10px',
              fontSize: '13px',
              flexShrink: 0,
              margin: 0
            }}
            title="Select aggregation type"
          >
            <option value="absolute">Absolute</option>
            <option value="regular">Regular</option>
          </select>
        </div>
      </div>

      {/* Main Layout: 2/3 plots, 1/3 segment definition */}
      <div className="analysis-layout">
        {/* Left side - Sensor plots */}
        <div className="plots-section" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 170px)' }}>
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

      {/* Export Progress Notification */}
      {exportProgress && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'white',
          border: `2px solid ${exportProgress.status === 'completed' ? '#10b981' : exportProgress.status === 'failed' ? '#ef4444' : '#3b82f6'}`,
          borderRadius: '12px',
          padding: '16px',
          minWidth: '350px',
          maxWidth: '500px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          animation: 'slideInLeft 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Download size={20} color={exportProgress.status === 'completed' ? '#10b981' : exportProgress.status === 'failed' ? '#ef4444' : '#3b82f6'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>
                {exportProgress.status === 'completed' ? '✅ Export Complete' : 
                 exportProgress.status === 'failed' ? '❌ Export Failed' : 
                 exportProgress.status === 'processing' ? '⚙️ Exporting...' : '⏳ Export Queued'}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-all' }}>
                {exportProgress.filename}
              </div>
            </div>
            <button
              onClick={() => setExportProgress(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
          
          {exportProgress.status !== 'failed' && (
            <div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${exportProgress.progress}%`,
                  height: '100%',
                  backgroundColor: exportProgress.status === 'completed' ? '#10b981' : '#3b82f6',
                  transition: 'width 0.3s ease',
                  borderRadius: '4px'
                }} />
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', textAlign: 'right', fontWeight: '500' }}>
                {exportProgress.progress}%
              </div>
            </div>
          )}
          
          {exportProgress.error && (
            <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
              {exportProgress.error}
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Export Data</h3>
              <button 
                className="modal-close"
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#1f2937', letterSpacing: '0.01em' }}>Data Type</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: `2px solid ${exportDataType === 'aggregated' ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: exportDataType === 'aggregated' ? '#eff6ff' : 'white',
                    transition: 'all 0.2s ease',
                    ':hover': { borderColor: '#3b82f6' }
                  }}>
                    <input
                      type="radio"
                      name="dataType"
                      value="aggregated"
                      checked={exportDataType === 'aggregated'}
                      onChange={(e) => setExportDataType(e.target.value)}
                      disabled={exporting}
                      style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Aggregated (10s intervals)</span>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: `2px solid ${exportDataType === 'raw' ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: exportDataType === 'raw' ? '#eff6ff' : 'white',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="dataType"
                      value="raw"
                      checked={exportDataType === 'raw'}
                      onChange={(e) => {
                        setExportDataType(e.target.value);
                        // Auto-switch to segment when raw is selected
                        if (e.target.value === 'raw' && exportTimeRange === 'whole') {
                          setExportTimeRange('segment');
                        }
                      }}
                      disabled={exporting}
                      style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Raw</span>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#1f2937', letterSpacing: '0.01em' }}>Time Range</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: `2px solid ${exportTimeRange === 'whole' && exportDataType !== 'raw' ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: exportDataType === 'raw' ? 'not-allowed' : 'pointer',
                    backgroundColor: exportTimeRange === 'whole' && exportDataType !== 'raw' ? '#eff6ff' : exportDataType === 'raw' ? '#f9fafb' : 'white',
                    opacity: exportDataType === 'raw' ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="timeRange"
                      value="whole"
                      checked={exportTimeRange === 'whole'}
                      onChange={(e) => setExportTimeRange(e.target.value)}
                      disabled={exporting || exportDataType === 'raw'}
                      style={{ marginRight: '12px', width: '18px', height: '18px', cursor: exportDataType === 'raw' ? 'not-allowed' : 'pointer', accentColor: '#3b82f6' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Whole Test</span>
                      {exportDataType === 'raw' && (
                        <span style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>Not available for raw data</span>
                      )}
                    </div>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: `2px solid ${exportTimeRange === 'segment' ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: exportTimeRange === 'segment' ? '#eff6ff' : 'white',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="timeRange"
                      value="segment"
                      checked={exportTimeRange === 'segment'}
                      onChange={(e) => setExportTimeRange(e.target.value)}
                      disabled={exporting}
                      style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Specific Segment</span>
                  </label>
                </div>
                {exportDataType === 'raw' && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '12px 14px', 
                    backgroundColor: '#fef2f2', 
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px', lineHeight: '1' }}>⚠️</span>
                    <p style={{ fontSize: '12px', color: '#dc2626', margin: 0, lineHeight: '1.5' }}>
                      Raw data exports can be very large. Please select a specific segment to avoid timeout errors.
                    </p>
                  </div>
                )}
              </div>

              {exportTimeRange === 'segment' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#1f2937', letterSpacing: '0.01em' }}>Select Segment</label>
                  <select
                    value={exportSegmentId}
                    onChange={(e) => setExportSegmentId(e.target.value)}
                    disabled={exporting}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '14px',
                      color: '#1f2937',
                      backgroundColor: 'white',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  >
                    <option value="" style={{ color: '#9ca3af' }}>-- Select Segment --</option>
                    {segments.map(segment => (
                      <option key={segment.id} value={segment.id} style={{ color: '#1f2937' }}>
                        {segment.segment_name} ({new Date(segment.start_time).toLocaleString()} - {new Date(segment.end_time).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '20px 24px', gap: '12px', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '100px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: exporting ? '#9ca3af' : '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  if (!exporting) e.currentTarget.style.backgroundColor = '#059669';
                }}
                onMouseOut={(e) => {
                  if (!exporting) e.currentTarget.style.backgroundColor = '#10b981';
                }}
              >
                {exporting ? (
                  <>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestAnalysis;
