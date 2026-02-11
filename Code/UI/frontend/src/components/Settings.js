import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sensorTypesAPI, machineTypesAPI} from '../api';
import { Settings as SettingsIcon, Plus, Edit, Trash2, Save, X, Zap, AlertTriangle } from 'lucide-react';

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sensors');
  const [sensorTypes, setSensorTypes] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sensor Type states
  const [showSensorTypeModal, setShowSensorTypeModal] = useState(false);
  const [editingSensorType, setEditingSensorType] = useState(null);
  const [sensorTypeForm, setSensorTypeForm] = useState({
    display_name: '',
    unit: '',
    description: ''
  });

  // Machine Type states - no longer needed since we navigate to separate page
  // const [showMachineTypeModal, setShowMachineTypeModal] = useState(false);
  // const [editingMachineType, setEditingMachineType] = useState(null);
  // const [machineTypeForm, setMachineTypeForm] = useState({
  //   display_name: '',
  //   description: ''
  // });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
  let sensorTypesData = [];
  let machineTypesData = [];

  try {
    setLoading(true);
    const results = await Promise.allSettled([
      sensorTypesAPI.getAll(),
      machineTypesAPI.getAll()
    ]);
    
    sensorTypesData = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
    machineTypesData = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];

    setSensorTypes(sensorTypesData);
    setMachineTypes(machineTypesData);

  } catch (error) {
    console.error('Error loading settings:', error);
  } finally {
    setLoading(false);
  }
};


  // Sensor Type handlers
  const handleAddSensorType = () => {
    setEditingSensorType(null);
    setSensorTypeForm({
      sensor_type_name: '',
      sensor_type_unit: '',
      sensor_type_description: ''
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
        await sensorTypesAPI.update(editingSensorType.id, sensorTypeForm);
      } else {
        await sensorTypesAPI.create(sensorTypeForm);
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
        await sensorTypesAPI.delete(typeId);
        loadSettings();
      } catch (error) {
        console.error('Error deleting sensor type:', error);
        console.error('Error response:', error.response);
        console.error('Error response data:', error.response?.data);
        
        // Try to extract the error message from different possible locations
        let errorMessage = 'Error deleting sensor type. Please try again.';
        
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
      }
    }
  };

  // Machine Type handlers - updated to navigate to separate page
  const handleAddMachineType = () => {
    navigate('/machine-types/new');
  };

  const handleEditMachineType = (machineType) => {
    navigate(`/machine-types/edit/${machineType.id}`);
  };

  const handleDeleteMachineType = async (typeId) => {
    if (window.confirm('Are you sure you want to delete this machine type?')) {
      try {
        await machineTypesAPI.delete(typeId);
        loadSettings();
      } catch (error) {
        console.error('Error deleting machine type:', error);
        console.error('Error response:', error.response);
        console.error('Error response data:', error.response?.data);
        
        // Try to extract the error message from different possible locations
        let errorMessage = 'Error deleting machine type. Please try again.';
        
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
      }
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          System Settings
        </h1>
        <p className="page-subtitle">
          Configure sensor types and machine types
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          onClick={() => setActiveTab('sensors')}
          className={`tab-button ${activeTab === 'sensors' ? 'active' : 'inactive'}`}
        >
          <Zap size={16} />
          Sensor Types
        </button>
        <button
          onClick={() => setActiveTab('machines')}
          className={`tab-button ${activeTab === 'machines' ? 'active' : 'inactive'}`}
        >
          <SettingsIcon size={16} />
          Machine Types
        </button>
      </div>

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

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Unit</th>
                  <th>Description</th>
                  <th className="sticky-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sensorTypes.map((sensorType) => (
                  <tr key={sensorType.id}>
                    <td>
                      <strong>{sensorType.sensor_type_name}</strong>
                    </td>
                    <td>{sensorType.sensor_type_unit || '-'}</td>
                    <td>
                      <div style={{ maxWidth: '200px', fontSize: '14px' }}>
                        {sensorType.sensor_type_description || '-'}
                      </div>
                    </td>
                    <td className="sticky-actions">
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

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Description</th>
                  <th>Created At</th>
                  <th className="sticky-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {machineTypes.map((machineType) => (
                  <tr key={machineType.id}>
                    <td>
                      <strong>{machineType.machine_type_name}</strong>
                    </td>
                    <td>
                      <div style={{ maxWidth: '300px', fontSize: '14px' }}>
                        {machineType.machine_type_description || '-'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        {new Date(machineType.machine_type_created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="sticky-actions">
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
                  // onClick={handleAddMachineType}
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
                  Display Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={sensorTypeForm.sensor_type_name}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, sensor_type_name: e.target.value})}
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
                  value={sensorTypeForm.sensor_type_unit}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, sensor_type_unit: e.target.value})}
                  placeholder="e.g., bar, °C, g, mm"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Description
                </label>
                <textarea
                  className="form-control"
                  value={sensorTypeForm.sensor_type_description}
                  onChange={(e) => setSensorTypeForm({...sensorTypeForm, sensor_type_description: e.target.value})}
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
                disabled={!sensorTypeForm.sensor_type_name}
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
