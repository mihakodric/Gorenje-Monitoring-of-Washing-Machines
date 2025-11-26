import React, { useState, useEffect } from 'react';
import { sensorsAPI, sensorTypesAPI } from '../api';
import { Plus, Edit, Trash2, Activity, Zap, Thermometer, Eye, Droplets, Gauge, Search, Filter, X, Wifi } from 'lucide-react';
import SensorModal from './SensorModal';

const Sensors = () => {
  const [sensors, setSensors] = useState([]);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [filteredSensors, setFilteredSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSensor, setEditingSensor] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [typeFilter, setTypeFilter] = useState('all'); // all, temperature, current, etc.
  const [sortField, setSortField] = useState('sensor_name');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    loadSensorsAndSensorTypes();
  }, []);

  useEffect(() => {
    filterAndSortSensors();
  }, [sensors, searchTerm, statusFilter, typeFilter, sortField, sortDirection]);

  const filterAndSortSensors = () => {
    let filtered = sensors.filter(sensor => {
      // Search filter
      const matchesSearch = sensor.sensor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (sensor.sensor_type_id && sensor.sensor_type_id.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
                           sensor.sensor_mqtt_topic.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && sensor.sensor_is_online) ||
                           (statusFilter === 'inactive' && !sensor.sensor_is_online);

      // Type filter
      const matchesType = typeFilter === 'all' || sensor.sensor_type_id?.toString() === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'sensor_last_seen') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredSensors(filtered);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setSortField('sensor_name');
    setSortDirection('asc');
  };

  const getSensorTypes = () => {
    return [...new Set(sensors.map(s => s.sensor_type_id).filter(Boolean))];
  };

  const loadSensorsAndSensorTypes = async () => {
    try {
      const [sensorsResponse, sensorTypesResponse] = await Promise.all([
        sensorsAPI.getAll(),
        sensorTypesAPI.getAll()
      ]);
      setSensors(sensorsResponse.data);
      setSensorTypes(sensorTypesResponse.data);
    } catch (error) {
      console.error('Error loading sensors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSensor = () => {
    setEditingSensor(null);
    setShowModal(true);
  };

  const handleEditSensor = (sensor) => {
    setEditingSensor(sensor);
    setShowModal(true);
  };

  const handleDeleteSensor = async (sensorId) => {
    if (window.confirm('Are you sure you want to delete this sensor? This action cannot be undone.')) {
      try {
        await sensorsAPI.delete(sensorId);
        loadSensorsAndSensorTypes();
      } catch (error) {
        console.error('Error deleting sensor:', error);
        alert('Error deleting sensor. Please try again.');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingSensor(null);
  };

  const handleModalSave = () => {
    setShowModal(false);
    setEditingSensor(null);
    loadSensorsAndSensorTypes();
  };

  const handleIdentifySensor = (sensor) => {
    // TODO: Send MQTT message to {sensor.sensor_mqtt_topic}/cmd/identify
    console.log(`Identify sensor: ${sensor.sensor_name} (${sensor.sensor_mqtt_topic}/cmd/identify)`);
    alert(`Identify command will be sent to:\n${sensor.sensor_mqtt_topic}/cmd/identify\n\nThis feature will be implemented soon.`);
  };

  const getSensorBadgeStyle = (sensorType) => {
    const color = '#10b981'; // Default to green
    return {
      background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
      color: color,
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'capitalize',
      border: `2px solid ${color}30`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    };
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading sensors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          Sensor Management
        </h1>
        <p className="page-subtitle">
          Configure and monitor your washing machine sensors
        </p>
      </div>

      <div className="card no-padding">
        <div className="card-header">
          <div className="card-title">
            <Activity size={28} className="text-primary" />
            <div>
              <h2>Active Sensors</h2>
              <p className="card-subtitle">
                {filteredSensors.filter(s => s.sensor_is_online).length} of {filteredSensors.length} sensors online
                {sensors.length !== filteredSensors.length && ` (${sensors.length} total)`}
              </p>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleAddSensor}
          >
            <Plus size={18} />
            Add New Sensor
          </button>
        </div>

        <div className="card-body">
          {/* Filters */}
          <div className="filter-section">
          {/* Search */}
          <div className="form-group">
            <div className="search-container">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search sensors..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="form-group">
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="form-group">
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {getSensorTypes().map(type => (
                <option key={type} value={type}>
                  {sensorTypes.find(st => st.id === type)?.sensor_type_name || `Type ${type}`}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear
            </button>
          )}

          {/* Results count */}
          <div className="filter-count">
            Showing {filteredSensors.length} of {sensors.length} sensors
          </div>
          </div>

          {sensors.length === 0 ? (
          <div className="empty-state">
            <Activity size={64} className="empty-icon" />
            <h3 className="empty-title">No Sensors Found</h3>
            <p className="empty-description">
              Get started by adding your first sensor to begin monitoring your washing machine.
            </p>
            <button className="btn btn-primary" onClick={handleAddSensor}>
              <Plus size={18} />
              Add Your First Sensor
            </button>
          </div>
        ) : filteredSensors.length === 0 ? (
          <div className="empty-state">
            <Filter size={64} className="empty-icon" />
            <h3 className="empty-title">No Matching Sensors</h3>
            <p className="empty-description">
              No sensors match your current filters. Try adjusting your search criteria.
            </p>
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={18} />
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('sensor_name')}
                  >
                    <div className="sort-header">
                      Sensor Details
                      {sortField === 'sensor_name' && (
                        <span className="sort-indicator">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('sensor_type_id')}
                  >
                    <div className="sort-header">
                      Type
                      {sortField === 'sensor_type_id' && (
                        <span className="sort-indicator">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th>MQTT Configuration</th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('sensor_is_online')}
                  >
                    <div className="sort-header">
                      Status
                      {sortField === 'sensor_is_online' && (
                        <span className="sort-indicator">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('sensor_last_seen')}
                  >
                    <div className="sort-header">
                      Last Activity
                      {sortField === 'sensor_last_seen' && (
                        <span className="sort-indicator">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSensors.map((sensor) => {
                  return (
                    <tr key={sensor.id}>
                      <td>
                        <div className={`sensor-card`}>
                          <div className="sensor-icon">
                            <Activity size={20} />
                          </div>
                          <div className="sensor-content">
                            <div className="sensor-name">
                              {sensor.sensor_name}
                            </div>
                            {sensor.sensor_description && (
                              <div className="sensor-description">
                                {sensor.sensor_description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="badge badge-success">
                          {sensorTypes.find(st => st.id === sensor.sensor_type_id)?.sensor_type_name || `Type ${sensor.sensor_type_id}`}
                        </div>
                      </td>
                      <td>
                        <div className="code-block">
                          {sensor.sensor_mqtt_topic}
                        </div>
                      </td>
                      <td>
                        <div className={`status-badge ${sensor.sensor_is_online ? 'status-online' : 'status-offline'}`}>
                          <div className={`status-dot ${sensor.sensor_is_online ? 'online' : 'offline'}`} />
                          {sensor.sensor_is_online ? 'Online' : 'Offline'}
                        </div>
                      </td>
                      <td>
                        <div className="date-primary">
                          {sensor.sensor_last_seen ? 
                            new Date(sensor.sensor_last_seen).toLocaleDateString() : 
                            'Never'
                          }
                        </div>
                        <div className="date-secondary">
                          {sensor.sensor_last_seen ? 
                            new Date(sensor.sensor_last_seen).toLocaleTimeString() : 
                            'No data received'
                          }
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleIdentifySensor(sensor)}
                            disabled={!sensor.sensor_is_online}
                            title={sensor.sensor_is_online ? "Identify sensor (blink LED)" : "Sensor offline"}
                          >
                            <Wifi size={14} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditSensor(sensor)}
                            title="Edit sensor"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteSensor(sensor.id)}
                            title="Delete sensor"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      {showModal && (
        <SensorModal
          sensor={editingSensor}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default Sensors;
