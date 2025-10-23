import React, { useState, useEffect } from 'react';
import { sensorsAPI, sensorTypesAPI } from '../api';
import { Plus, Edit, Trash2, Activity, Zap, Thermometer, Eye, Droplets, Gauge, Search, Filter, X } from 'lucide-react';
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
      <div>
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading sensors...</p>
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
          Sensor Management
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', fontWeight: '500' }}>
          Configure and monitor your washing machine sensors
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Activity size={28} style={{ color: '#667eea' }} />
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '20px' }}>
                Active Sensors
              </h2>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                {filteredSensors.filter(s => s.sensor_is_online).length} of {filteredSensors.length} sensors online
                {sensors.length !== filteredSensors.length && ` (${sensors.length} total)`}
              </p>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleAddSensor}
            style={{ 
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <Plus size={18} />
            Add New Sensor
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #f0f2f5',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: '250px' }}>
              <Search size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="text"
                placeholder="Search sensors..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  paddingLeft: '40px',
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '120px' }}>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Type Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                className="form-control"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}
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
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={14} />
                Clear Filters
              </button>
            )}

            {/* Results count */}
            <div style={{
              marginLeft: 'auto',
              fontSize: '14px',
              color: '#6b7280',
              fontWeight: '500'
            }}>
              Showing {filteredSensors.length} of {sensors.length} sensors
            </div>
          </div>
        </div>

        {sensors.length === 0 ? (
          <div className="text-center" style={{ padding: '60px 40px' }}>
            <Activity size={64} style={{ color: '#d1d5db', marginBottom: '20px' }} />
            <h3 style={{ color: '#4b5563', marginBottom: '10px' }}>No Sensors Found</h3>
            <p style={{ color: '#9ca3af', marginBottom: '25px' }}>
              Get started by adding your first sensor to begin monitoring your washing machine.
            </p>
            <button className="btn btn-primary" onClick={handleAddSensor}>
              <Plus size={18} />
              Add Your First Sensor
            </button>
          </div>
        ) : filteredSensors.length === 0 ? (
          <div className="text-center" style={{ padding: '60px 40px' }}>
            <Filter size={64} style={{ color: '#d1d5db', marginBottom: '20px' }} />
            <h3 style={{ color: '#4b5563', marginBottom: '10px' }}>No Matching Sensors</h3>
            <p style={{ color: '#9ca3af', marginBottom: '25px' }}>
              No sensors match your current filters. Try adjusting your search criteria.
            </p>
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={18} />
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('sensor_name')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Sensor Details
                      {sortField === 'sensor_name' && (
                        <span style={{ fontSize: '12px' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('sensor_type_id')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Type
                      {sortField === 'sensor_type_id' && (
                        <span style={{ fontSize: '12px' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th>MQTT Configuration</th>
                  <th 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('sensor_is_online')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Status
                      {sortField === 'sensor_is_online' && (
                        <span style={{ fontSize: '12px' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('sensor_last_seen')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Last Activity
                      {sortField === 'sensor_last_seen' && (
                        <span style={{ fontSize: '12px' }}>
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
                  const sensorColor = '#10b981'; // Default to green
                  
                  return (
                    <tr key={sensor.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            backgroundColor: sensorColor + '20',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Activity size={20} style={{ color: sensorColor }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                              {sensor.sensor_name}
                            </div>
                            {sensor.sensor_description && (
                              <div style={{ 
                                marginTop: '8px', 
                                fontSize: '12px', 
                                color: '#6b7280',
                                fontWeight: '500'
                              }}>
                                {sensor.sensor_description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={getSensorBadgeStyle(sensor.sensor_type_id)}>
                          {sensorTypes.find(st => st.id === sensor.sensor_type_id)?.sensor_type_name || `Type ${sensor.sensor_type_id}`}
                        </div>
                      </td>
                      <td>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          color: '#374151',
                          backgroundColor: '#f3f4f6',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          {sensor.sensor_mqtt_topic}
                        </div>
                      </td>
                      <td>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          ...(sensor.sensor_is_online ? {
                            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                            color: '#065f46',
                            border: '2px solid #a7f3d0'
                          } : {
                            background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                            color: '#7f1d1d',
                            border: '2px solid #fca5a5'
                          })
                        }}>
                          <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: sensor.sensor_is_online ? '#10b981' : '#ef4444',
                            animation: sensor.sensor_is_online ? 'pulse 2s infinite' : 'none'
                          }}></div>
                          {sensor.sensor_is_online ? 'Online' : 'Offline'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                          {sensor.sensor_last_seen ? 
                            new Date(sensor.sensor_last_seen).toLocaleDateString() : 
                            'Never'
                          }
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {sensor.sensor_last_seen ? 
                            new Date(sensor.sensor_last_seen).toLocaleTimeString() : 
                            'No data received'
                          }
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditSensor(sensor)}
                            title="Edit sensor"
                            style={{ 
                              padding: '8px 12px',
                              minWidth: 'auto'
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteSensor(sensor.id)}
                            title="Delete sensor"
                            style={{ 
                              padding: '8px 12px',
                              minWidth: 'auto'
                            }}
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
