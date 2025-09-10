import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../api';
import { Settings as SettingsIcon, Plus, Edit, Trash2, Save, X, Wifi, Zap, AlertTriangle, Check } from 'lucide-react';

const Settings = () => {
  const [mqttConfigs, setMqttConfigs] = useState([]);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mqtt');
  
  // MQTT Config states
  const [showMqttModal, setShowMqttModal] = useState(false);
  const [editingMqttConfig, setEditingMqttConfig] = useState(null);
  const [mqttForm, setMqttForm] = useState({
    name: '',
    broker_host: '',
    broker_port: 1883,
    username: '',
    password: '',
    topic_prefix: '',
    description: ''
  });

  // Sensor Type states
  const [showSensorTypeModal, setShowSensorTypeModal] = useState(false);
  const [editingSensorType, setEditingSensorType] = useState(null);
  const [sensorTypeForm, setSensorTypeForm] = useState({
    name: '',
    display_name: '',
    description: '',
    default_topic: '',
    data_format: 'json',
    unit: '',
    min_value: '',
    max_value: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [mqttResponse, typesResponse] = await Promise.all([
        settingsAPI.getMqttConfigs(),
        settingsAPI.getSensorTypes()
      ]);
      setMqttConfigs(mqttResponse.data);
      setSensorTypes(typesResponse.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // MQTT Config handlers
  const handleAddMqttConfig = () => {
    setEditingMqttConfig(null);
    setMqttForm({
      name: '',
      broker_host: '',
      broker_port: 1883,
      username: '',
      password: '',
      topic_prefix: '',
      description: ''
    });
    setShowMqttModal(true);
  };

  const handleEditMqttConfig = (config) => {
    setEditingMqttConfig(config);
    setMqttForm(config);
    setShowMqttModal(true);
  };

  const handleSaveMqttConfig = async () => {
    try {
      if (editingMqttConfig) {
        await settingsAPI.updateMqttConfig(editingMqttConfig.id, mqttForm);
      } else {
        await settingsAPI.createMqttConfig(mqttForm);
      }
      loadSettings();
      setShowMqttModal(false);
    } catch (error) {
      console.error('Error saving MQTT config:', error);
      alert('Error saving MQTT configuration');
    }
  };

  const handleDeleteMqttConfig = async (configId) => {
    if (window.confirm('Are you sure you want to delete this MQTT configuration? This will mark related sensors as inactive.')) {
      try {
        await settingsAPI.deleteMqttConfig(configId);
        loadSettings();
      } catch (error) {
        console.error('Error deleting MQTT config:', error);
        alert('Error deleting MQTT configuration');
      }
    }
  };

  // Sensor Type handlers
  const handleAddSensorType = () => {
    setEditingSensorType(null);
    setSensorTypeForm({
      name: '',
      display_name: '',
      description: '',
      default_topic: '',
      data_format: 'json',
      unit: '',
      min_value: '',
      max_value: ''
    });
    setShowSensorTypeModal(true);
  };

  const handleEditSensorType = (sensorType) => {
    setEditingSensorType(sensorType);
    setSensorTypeForm(sensorType);
    setShowSensorTypeModal(true);
  };

  const handleSaveSensorType = async () => {
    try {
      if (editingSensorType) {
        await settingsAPI.updateSensorType(editingSensorType.id, sensorTypeForm);
      } else {
        await settingsAPI.createSensorType(sensorTypeForm);
      }
      loadSettings();
      setShowSensorTypeModal(false);
    } catch (error) {
      console.error('Error saving sensor type:', error);
      alert('Error saving sensor type');
    }
  };

  const handleDeleteSensorType = async (typeId) => {
    if (window.confirm('Are you sure you want to delete this sensor type? This will mark related sensors as inactive and require updates.')) {
      try {
        await settingsAPI.deleteSensorType(typeId);
        loadSettings();
      } catch (error) {
        console.error('Error deleting sensor type:', error);
        alert('Error deleting sensor type');
      }
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
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
          System Settings
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', fontWeight: '500' }}>
          Configure MQTT connections and sensor types
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '2px solid #e5e7eb', 
        marginBottom: '30px' 
      }}>
        <button
          onClick={() => setActiveTab('mqtt')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'mqtt' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: activeTab === 'mqtt' ? 'white' : '#6b7280',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Wifi size={16} />
          MQTT Configuration
        </button>
        <button
          onClick={() => setActiveTab('sensors')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'sensors' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: activeTab === 'sensors' ? 'white' : '#6b7280',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Zap size={16} />
          Sensor Types
        </button>
      </div>

      {/* MQTT Configuration Tab */}
      {activeTab === 'mqtt' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Wifi size={28} style={{ color: '#667eea' }} />
              <div>
                <h2 className="card-title" style={{ margin: 0, fontSize: '20px' }}>
                  MQTT Configurations
                </h2>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  Manage MQTT broker connections and topics
                </p>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleAddMqttConfig}
              style={{ 
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <Plus size={18} />
              Add Configuration
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Broker</th>
                  <th>Topic Prefix</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mqttConfigs.map((config) => (
                  <tr key={config.id}>
                    <td>
                      <strong>{config.name}</strong>
                      {config.description && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {config.description}
                        </div>
                      )}
                    </td>
                    <td>{config.broker_host}:{config.broker_port}</td>
                    <td>{config.topic_prefix || '-'}</td>
                    <td>
                      <span className={`status ${config.is_active ? 'status-running' : 'status-inactive'}`}>
                        {config.is_active ? <Check size={12} /> : <X size={12} />}
                        {config.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditMqttConfig(config)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteMqttConfig(config.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sensor Types Tab */}
      {activeTab === 'sensors' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Zap size={28} style={{ color: '#667eea' }} />
              <div>
                <h2 className="card-title" style={{ margin: 0, fontSize: '20px' }}>
                  Sensor Types
                </h2>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  Define custom sensor types and configurations
                </p>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleAddSensorType}
              style={{ 
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <Plus size={18} />
              Add Sensor Type
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type Name</th>
                  <th>Display Name</th>
                  <th>Default Topic</th>
                  <th>Unit</th>
                  <th>Range</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sensorTypes.map((sensorType) => (
                  <tr key={sensorType.id}>
                    <td>
                      <strong>{sensorType.name}</strong>
                      {sensorType.description && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {sensorType.description}
                        </div>
                      )}
                    </td>
                    <td>{sensorType.display_name}</td>
                    <td>{sensorType.default_topic || '-'}</td>
                    <td>{sensorType.unit || '-'}</td>
                    <td>
                      {sensorType.min_value && sensorType.max_value ? 
                        `${sensorType.min_value} - ${sensorType.max_value}` : 
                        '-'
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditSensorType(sensorType)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteSensorType(sensorType.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MQTT Config Modal */}
      {showMqttModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90%',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{editingMqttConfig ? 'Edit MQTT Configuration' : 'Add MQTT Configuration'}</h3>
              <button
                onClick={() => setShowMqttModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Configuration Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={mqttForm.name}
                  onChange={(e) => setMqttForm({...mqttForm, name: e.target.value})}
                  placeholder="e.g., Main MQTT Broker"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Broker Host *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={mqttForm.broker_host}
                  onChange={(e) => setMqttForm({...mqttForm, broker_host: e.target.value})}
                  placeholder="localhost or IP address"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Port
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={mqttForm.broker_port}
                  onChange={(e) => setMqttForm({...mqttForm, broker_port: parseInt(e.target.value)})}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Username
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={mqttForm.username}
                  onChange={(e) => setMqttForm({...mqttForm, username: e.target.value})}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Password
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={mqttForm.password}
                  onChange={(e) => setMqttForm({...mqttForm, password: e.target.value})}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Topic Prefix
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={mqttForm.topic_prefix}
                  onChange={(e) => setMqttForm({...mqttForm, topic_prefix: e.target.value})}
                  placeholder="e.g., sensors/"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Description
                </label>
                <textarea
                  className="form-control"
                  value={mqttForm.description}
                  onChange={(e) => setMqttForm({...mqttForm, description: e.target.value})}
                  rows="3"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowMqttModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveMqttConfig}
                disabled={!mqttForm.name || !mqttForm.broker_host}
              >
                <Save size={16} />
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Type Modal */}
      {showSensorTypeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90%',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{editingSensorType ? 'Edit Sensor Type' : 'Add Sensor Type'}</h3>
              <button
                onClick={() => setShowSensorTypeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Type Name * (lowercase, no spaces)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={sensorTypeForm.name}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, name: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                  placeholder="e.g., custom_pressure"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={sensorTypeForm.display_name}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, display_name: e.target.value})}
                  placeholder="e.g., Custom Pressure Sensor"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Default Topic
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={sensorTypeForm.default_topic}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, default_topic: e.target.value})}
                  placeholder="e.g., sensors/pressure"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Data Format
                </label>
                <select
                  className="form-control"
                  value={sensorTypeForm.data_format}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, data_format: e.target.value})}
                >
                  <option value="json">JSON</option>
                  <option value="string">String</option>
                  <option value="number">Number</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Unit of Measurement
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={sensorTypeForm.unit}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, unit: e.target.value})}
                  placeholder="e.g., bar, psi, °C"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Min Value
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={sensorTypeForm.min_value}
                    onChange={(e) => setSensorTypeForm({...sensorTypeForm, min_value: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Max Value
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={sensorTypeForm.max_value}
                    onChange={(e) => setSensorTypeForm({...sensorTypeForm, max_value: e.target.value})}
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Description
                </label>
                <textarea
                  className="form-control"
                  value={sensorTypeForm.description}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, description: e.target.value})}
                  rows="3"
                  placeholder="Describe this sensor type"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSensorTypeModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveSensorType}
                disabled={!sensorTypeForm.name || !sensorTypeForm.display_name}
              >
                <Save size={16} />
                Save Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Message */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
        <div style={{ fontSize: '14px', color: '#92400e' }}>
          <strong>Warning:</strong> Deleting configurations or sensor types will mark related sensors as inactive and require updates before they can be used again.
        </div>
      </div>
    </div>
  );
};

export default Settings;
