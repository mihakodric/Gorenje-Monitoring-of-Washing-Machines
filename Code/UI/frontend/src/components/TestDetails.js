import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { testsAPI, sensorsAPI } from '../api';
import { ArrowLeft, Square } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

const TestDetails = () => {
  const { testName } = useParams();
  const [test, setTest] = useState(null);
  const [testData, setTestData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dataLimit, setDataLimit] = useState(1000);

  const loadTestDetails = useCallback(async () => {
    try {
      const [testRes, summaryRes, sensorsRes] = await Promise.all([
        testsAPI.getById(testName),
        testsAPI.getSummary(testName),
        sensorsAPI.getAll()
      ]);

      setTest(testRes.data);
      setSummary(summaryRes.data);
      setSensors(sensorsRes.data);

      // Load sensor data
      const dataParams = {
        limit: dataLimit
      };
      if (selectedSensor !== 'all') {
        dataParams.sensor_id = selectedSensor;
      }

      const dataRes = await testsAPI.getData(testName, dataParams);
      setTestData(dataRes.data);

    } catch (error) {
      console.error('Error loading test details:', error);
    } finally {
      setLoading(false);
    }
  }, [testName, selectedSensor, dataLimit]);

  useEffect(() => {
    if (testName) {
      loadTestDetails();
    }
  }, [testName, loadTestDetails]);

  const handleStopTest = async () => {
    if (window.confirm('Are you sure you want to stop this test?')) {
      try {
        await testsAPI.stop(testName);
        loadTestDetails();
      } catch (error) {
        console.error('Error stopping test:', error);
        alert('Error stopping test');
      }
    }
  };

  const prepareChartData = () => {
    if (!testData.length) return null;

    // Group data by sensor and direction
    const groupedData = {};
    testData.forEach(point => {
      const key = `${point.sensor_id}_${point.direction}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          label: `${point.sensor_id} (${point.direction})`,
          data: [],
          borderColor: getColorForSensor(point.sensor_id),
          backgroundColor: getColorForSensor(point.sensor_id, 0.1),
        };
      }
      groupedData[key].data.push({
        x: new Date(point.time),
        y: point.value
      });
    });

    // Sort data points by time
    Object.values(groupedData).forEach(dataset => {
      dataset.data.sort((a, b) => a.x - b.x);
    });

    return {
      datasets: Object.values(groupedData)
    };
  };

  const getColorForSensor = (sensorId, alpha = 1) => {
    const colors = [
      `rgba(255, 99, 132, ${alpha})`,
      `rgba(54, 162, 235, ${alpha})`,
      `rgba(255, 205, 86, ${alpha})`,
      `rgba(75, 192, 192, ${alpha})`,
      `rgba(153, 102, 255, ${alpha})`,
      `rgba(255, 159, 64, ${alpha})`
    ];
    const hash = sensorId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Sensor Data - ${testName}`,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            millisecond: 'HH:mm:ss.SSS',
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm'
          }
        }
      },
      y: {
        beginAtZero: false,
      },
    },
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading test details...</p>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="card">
        <p>Test not found.</p>
        <Link to="/tests" className="btn btn-primary">
          <ArrowLeft size={16} />
          Back to Tests
        </Link>
      </div>
    );
  }

  const chartData = prepareChartData();

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <div>
            <Link to="/tests" className="btn btn-secondary" style={{ marginRight: '10px' }}>
              <ArrowLeft size={16} />
              Back
            </Link>
            <span className="card-title">Test: {test.test_name}</span>
          </div>
          <div>
            {test.status === 'running' && (
              <button className="btn btn-danger" onClick={handleStopTest}>
                <Square size={16} />
                Stop Test
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <p><strong>Status:</strong> <span className={`status status-${test.status}`}>{test.status}</span></p>
            <p><strong>Machine ID:</strong> {test.machine_id || 'Not specified'}</p>
            <p><strong>Created By:</strong> {test.created_by}</p>
          </div>
          <div>
            <p><strong>Start Time:</strong> {new Date(test.start_time).toLocaleString()}</p>
            {test.end_time && (
              <p><strong>End Time:</strong> {new Date(test.end_time).toLocaleString()}</p>
            )}
            <p><strong>Data Points:</strong> {test.data_points || 0}</p>
          </div>
        </div>

        {test.description && (
          <div style={{ marginTop: '15px' }}>
            <p><strong>Description:</strong> {test.description}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Data Visualization</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
              className="form-control"
              style={{ width: '200px' }}
            >
              <option value="all">All Sensors</option>
              {sensors.map(sensor => (
                <option key={sensor.sensor_id} value={sensor.sensor_id}>
                  {sensor.name} ({sensor.sensor_id})
                </option>
              ))}
            </select>
            <select
              value={dataLimit}
              onChange={(e) => setDataLimit(parseInt(e.target.value))}
              className="form-control"
              style={{ width: '120px' }}
            >
              <option value={100}>100 points</option>
              <option value={500}>500 points</option>
              <option value={1000}>1000 points</option>
              <option value={5000}>5000 points</option>
            </select>
          </div>
        </div>

        {chartData && chartData.datasets.length > 0 ? (
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No data available for the selected sensor(s).</p>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {summary && summary.data_summary && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Data Summary</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Sensor ID</th>
                  <th>Direction</th>
                  <th>Count</th>
                  <th>Min Value</th>
                  <th>Max Value</th>
                  <th>Average</th>
                  <th>First Reading</th>
                  <th>Last Reading</th>
                </tr>
              </thead>
              <tbody>
                {summary.data_summary.map((item, index) => (
                  <tr key={index}>
                    <td>{item.sensor_id}</td>
                    <td>{item.direction}</td>
                    <td>{item.count}</td>
                    <td>{item.min_value?.toFixed(3)}</td>
                    <td>{item.max_value?.toFixed(3)}</td>
                    <td>{item.avg_value?.toFixed(3)}</td>
                    <td>{new Date(item.first_reading).toLocaleString()}</td>
                    <td>{new Date(item.last_reading).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestDetails;
