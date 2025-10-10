import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../api';
import { Settings as SettingsIcon, Plus, Edit, Trash2, Save, X, Wifi, Zap, AlertTriangle, Check } from 'lucide-react';

const Settings = () => {
  const [mqttConfig, setMqttConfig] = useState(null);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mqtt');
  const [mqttSaving, setMqttSaving] = useState(false);
  
  // MQTT Config form state - directly editable
  const [mqttForm, setMqttForm] = useState({
    broker_host: 'localhost',
    broker_port: 1883,
    username: '',
    password: ''
  });

  // Sensor Type states
  const [showSensorTypeModal, setShowSensorTypeModal] = useState(false);
  const [editingSensorType, setEditingSensorType] = useState(null);
  const [sensorTypeForm, setSensorTypeForm] = useState({
    mqtt_topic: '',
    display_name: '',
    unit: '',
    description: ''
  });

  // Machine Type states
  const [showMachineTypeModal, setShowMachineTypeModal] = useState(false);
  const [editingMachineType, setEditingMachineType] = useState(null);
  const [machineTypeForm, setMachineTypeForm] = useState({
    display_name: '',
    description: '',
    created_by: 'admin' // Default value, should be from user context in real app
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [mqttResponse, typesResponse, machineTypesResponse] = await Promise.all([
        settingsAPI.getMqttConfig(), // Get single MQTT config
        settingsAPI.getSensorTypes(),
        settingsAPI.getMachineTypes()
      ]);
      
      // Set the MQTT config data to both state and form
      const mqttData = mqttResponse.data;
      setMqttConfig(mqttData);
      if (mqttData) {
        setMqttForm({
          broker_host: mqttData.broker_host || 'localhost',
          broker_port: mqttData.broker_port || 1883,
          username: mqttData.username || '',
          password: mqttData.password || ''
        });
      }
      
      setSensorTypes(typesResponse.data);
      setMachineTypes(machineTypesResponse.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // MQTT Config handlers
  const handleSaveMqttConfig = async () => {
    try {
      setMqttSaving(true);
      if (mqttConfig && mqttConfig.id) {
        await settingsAPI.updateMqttConfig(mqttForm);
      } else {
        await settingsAPI.createMqttConfig(mqttForm);
      }
      await loadSettings(); // Reload to get updated data
    } catch (error) {
      console.error('Error saving MQTT config:', error);
      alert('Error saving MQTT configuration');
    } finally {
      setMqttSaving(false);
    }
  };

  const handleResetMqttConfig = () => {
    if (mqttConfig) {
      setMqttForm({
        broker_host: mqttConfig.broker_host || 'localhost',
        broker_port: mqttConfig.broker_port || 1883,
        username: mqttConfig.username || '',
        password: mqttConfig.password || ''
      });
    } else {
      setMqttForm({
        broker_host: 'localhost',
        broker_port: 1883,
        username: '',
        password: ''
      });
    }
  };

  // Sensor Type handlers
  const handleAddSensorType = () => {
    setEditingSensorType(null);
    setSensorTypeForm({
      mqtt_topic: '',
      display_name: '',
      unit: '',
      description: ''
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

  // Machine Type handlers
  const handleAddMachineType = () => {
    setEditingMachineType(null);
    setMachineTypeForm({
      display_name: '',
      description: '',
      created_by: 'admin' // Default value
    });
    setShowMachineTypeModal(true);
  };

  const handleEditMachineType = (machineType) => {
    setEditingMachineType(machineType);
    setMachineTypeForm({
      display_name: machineType.display_name,
      description: machineType.description || '',
      created_by: machineType.created_by
    });
    setShowMachineTypeModal(true);
  };

  const handleSaveMachineType = async () => {
    try {
      if (editingMachineType) {
        await settingsAPI.updateMachineType(editingMachineType.id, machineTypeForm);
      } else {
        await settingsAPI.createMachineType(machineTypeForm);
      }
      loadSettings();
      setShowMachineTypeModal(false);
    } catch (error) {
      console.error('Error saving machine type:', error);
      alert('Error saving machine type');
    }
  };

  const handleDeleteMachineType = async (typeId) => {
    if (window.confirm('Are you sure you want to delete this machine type?')) {
      try {
        await settingsAPI.deleteMachineType(typeId);
        loadSettings();
      } catch (error) {
        console.error('Error deleting machine type:', error);
        alert('Error deleting machine type');
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
          Configure MQTT broker connection and sensor types
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
        <button
          onClick={() => setActiveTab('machines')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'machines' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: activeTab === 'machines' ? 'white' : '#6b7280',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <SettingsIcon size={16} />
          Machine Types
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
                  MQTT Configuration
                </h2>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  Configure MQTT broker connection and topics
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleResetMqttConfig}
                style={{ 
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <X size={16} />
                Reset
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveMqttConfig}
                disabled={mqttSaving}
                style={{ 
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <Save size={16} />
                {mqttSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>

          <div style={{ padding: '30px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '20px' 
            }}>
              {/* Broker Configuration */}
              <div>
                <h4 style={{ 
                  color: '#374151', 
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Wifi size={18} />
                  Broker Connection
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151' }}>
                      Broker Host *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={mqttForm.broker_host}
                      onChange={(e) => setMqttForm({...mqttForm, broker_host: e.target.value})}
                      placeholder="localhost or IP address"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151' }}>
                      Port
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={mqttForm.broker_port}
                      onChange={(e) => setMqttForm({...mqttForm, broker_port: parseInt(e.target.value) || 1883})}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Authentication */}
              <div>
                <h4 style={{ 
                  color: '#374151', 
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <SettingsIcon size={18} />
                  Authentication (Optional)
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151' }}>
                      Username
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={mqttForm.username}
                      onChange={(e) => setMqttForm({...mqttForm, username: e.target.value})}
                      placeholder="Optional"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#374151' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      value={mqttForm.password}
                      onChange={(e) => setMqttForm({...mqttForm, password: e.target.value})}
                      placeholder="Optional"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>


            </div>

            {/* Connection Status */}
            {mqttConfig && (
              <div style={{
                marginTop: '30px',
                padding: '20px',
                backgroundColor: mqttConfig.is_active ? '#f0f9ff' : '#fef3c7',
                border: `2px solid ${mqttConfig.is_active ? '#3b82f6' : '#f59e0b'}`,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                {mqttConfig.is_active ? <Check size={20} style={{ color: '#3b82f6' }} /> : <AlertTriangle size={20} style={{ color: '#f59e0b' }} />}
                <div>
                  <p style={{ margin: 0, fontWeight: '600', color: mqttConfig.is_active ? '#1e40af' : '#92400e' }}>
                    Connection Status: {mqttConfig.is_active ? 'Connected' : 'Disconnected'}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: mqttConfig.is_active ? '#3730a3' : '#78350f' }}>
                    {mqttConfig.is_active ? 
                      `Connected to ${mqttConfig.broker_host}:${mqttConfig.broker_port}` : 
                      'MQTT broker is not reachable or configuration is invalid'
                    }
                  </p>
                </div>
              </div>
            )}
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
                  <th>Display Name</th>
                  <th>MQTT Topic</th>
                  <th>Unit</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sensorTypes.map((sensorType) => (
                  <tr key={sensorType.id}>
                    <td>
                      <strong>{sensorType.display_name}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>
                        {sensorType.mqtt_topic}
                      </code>
                    </td>
                    <td>{sensorType.unit || '-'}</td>
                    <td>
                      <div style={{ maxWidth: '200px', fontSize: '14px' }}>
                        {sensorType.description || '-'}
                      </div>
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

      {/* Machine Types Tab */}
      {activeTab === 'machines' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <SettingsIcon size={28} style={{ color: '#667eea' }} />
              <div>
                <h2 className="card-title" style={{ margin: 0, fontSize: '20px' }}>
                  Machine Types
                </h2>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  Define and manage different types of washing machines
                </p>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleAddMachineType}
              style={{ 
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <Plus size={18} />
              Add Machine Type
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Description</th>
                  <th>Created By</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {machineTypes.map((machineType) => (
                  <tr key={machineType.id}>
                    <td>
                      <strong>{machineType.display_name}</strong>
                    </td>
                    <td>
                      <div style={{ maxWidth: '300px', fontSize: '14px' }}>
                        {machineType.description || '-'}
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        {machineType.created_by}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        {new Date(machineType.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditMachineType(machineType)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteMachineType(machineType.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {machineTypes.length === 0 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                color: '#6b7280'
              }}>
                <p>No machine types defined yet.</p>
                <button 
                  className="btn btn-primary"
                  onClick={handleAddMachineType}
                  style={{ marginTop: '10px' }}
                >
                  <Plus size={16} />
                  Create First Machine Type
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Machine Type Modal */}
      {showMachineTypeModal && (
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
              <h3>{editingMachineType ? 'Edit Machine Type' : 'Add Machine Type'}</h3>
              <button
                onClick={() => setShowMachineTypeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={machineTypeForm.display_name}
                  onChange={(e) => setMachineTypeForm({...machineTypeForm, display_name: e.target.value})}
                  placeholder="e.g., Front Load Washer, Top Load Washer"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Description
                </label>
                <textarea
                  className="form-control"
                  value={machineTypeForm.description}
                  onChange={(e) => setMachineTypeForm({...machineTypeForm, description: e.target.value})}
                  rows="4"
                  placeholder="Describe the characteristics and features of this machine type"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Created By
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={machineTypeForm.created_by}
                  onChange={(e) => setMachineTypeForm({...machineTypeForm, created_by: e.target.value})}
                  placeholder="Enter creator name"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowMachineTypeModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveMachineType}
                disabled={!machineTypeForm.display_name || !machineTypeForm.created_by}
              >
                <Save size={16} />
                Save Machine Type
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
                  MQTT Topic *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={sensorTypeForm.mqtt_topic}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, mqtt_topic: e.target.value})}
                  placeholder="e.g., sensors/pressure"
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
                  placeholder="e.g., Pressure Sensor"
                />
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
                  placeholder="e.g., bar, °C, g, mm"
                />
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
                  placeholder="Describe this sensor type and its purpose"
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
                disabled={!sensorTypeForm.mqtt_topic || !sensorTypeForm.display_name}
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
