import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { testsAPI, sensorsAPI, washingMachinesAPI } from '../api';
import { 
  Save, X, User, FileText, Settings, Check, AlertTriangle, 
  Search, Filter, ChevronDown, Wifi, WifiOff, ChevronRight,
  Plus, Trash2, Edit
} from 'lucide-react';

const NewTest = () => {
  const navigate = useNavigate();
  const { id: testId } = useParams(); // For editing existing tests
  const isEditing = Boolean(testId);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Available data
  const [machines, setMachines] = useState([]);
  const [sensors, setSensors] = useState([]);
  
  // Form data
  const [testForm, setTestForm] = useState({
    test_name: '',
    description: '',
    notes: '',
    created_by: ''
  });
  
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedSensors, setSelectedSensors] = useState([]); // Array of {sensor_id, sensor_location, sensor: sensorObject}
  
  // Filtering and search states for machines
  const [machineSearch, setMachineSearch] = useState('');
  const [machineStatusFilter, setMachineStatusFilter] = useState('all');
  
  // Filtering and search states for available sensors
  const [availableSensorSearch, setAvailableSensorSearch] = useState('');
  const [availableSensorTypeFilter, setAvailableSensorTypeFilter] = useState('all');
  const [availableSensorStatusFilter, setAvailableSensorStatusFilter] = useState('all');
  
  // Filtering and search states for selected sensors
  const [selectedSensorSearch, setSelectedSensorSearch] = useState('');
  const [selectedSensorTypeFilter, setSelectedSensorTypeFilter] = useState('all');
  
  // Validation
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isEditing && testId && machines.length > 0 && sensors.length > 0) {
      loadTestData();
    }
  }, [isEditing, testId, machines.length, sensors.length]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [machinesResponse, sensorsResponse] = await Promise.all([
        washingMachinesAPI.getAll(),
        sensorsAPI.getAll()
      ]);
      
      setMachines(machinesResponse.data || []);
      setSensors(sensorsResponse.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading machines and sensors');
    } finally {
      setLoading(false);
    }
  };

  const loadTestData = async () => {
    try {
      const response = await testsAPI.getWithRelations(testId);
      const testData = response.data;
      
      // Populate form
      setTestForm({
        test_name: testData.test_name,
        description: testData.description || '',
        notes: testData.notes || '',
        created_by: testData.created_by
      });
      
      // Set selected machine
      if (testData.machine_id) {
        const machine = machines.find(m => m.id === testData.machine_id);
        setSelectedMachine(machine);
      }
      
      // Set selected sensors with locations
      if (testData.sensors && testData.sensors.length > 0) {
        const selectedSensorsData = testData.sensors.map(sensorRel => {
          const sensor = sensors.find(s => s.id === sensorRel.sensor_id);
          return {
            sensor_id: sensorRel.sensor_id,
            sensor_location: sensorRel.sensor_location || '',
            sensor: sensor
          };
        });
        setSelectedSensors(selectedSensorsData);
      }
    } catch (error) {
      console.error('Error loading test data:', error);
      alert('Error loading test data');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!testForm.test_name.trim()) {
      newErrors.test_name = 'Test name is required';
    }
    
    if (!testForm.created_by.trim()) {
      newErrors.created_by = 'Created by field is required';
    }
    
    if (!selectedMachine) {
      newErrors.machine = 'Please select a machine';
    }
    
    if (selectedSensors.length === 0) {
      newErrors.sensors = 'Please select at least one sensor';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      
      const sensorData = selectedSensors.map(s => ({
        sensor_id: s.sensor_id,
        sensor_location: s.sensor_location
      }));

      if (isEditing) {
        // Update existing test
        await testsAPI.update(testId, testForm);
        await testsAPI.updateRelations(testId, {
          machine_id: selectedMachine.id,
          sensors: sensorData
        });
      } else {
        // Create new test
        await testsAPI.createWithRelations({
          test: testForm,
          machine_id: selectedMachine.id,
          sensors: sensorData
        });
      }

      navigate('/tests');
    } catch (error) {
      console.error('Error saving test:', error);
      alert(`Error ${isEditing ? 'updating' : 'creating'} test`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/tests');
  };

  // Filter functions
  const getFilteredMachines = () => {
    return machines.filter(machine => {
      const matchesSearch = machine.machine_name.toLowerCase().includes(machineSearch.toLowerCase()) ||
                           (machine.description && machine.description.toLowerCase().includes(machineSearch.toLowerCase()));
      
      const matchesStatus = machineStatusFilter === 'all' || 
                           (machineStatusFilter === 'visible' && machine.visible) ||
                           (machineStatusFilter === 'hidden' && !machine.visible);
      
      return matchesSearch && matchesStatus;
    });
  };

  const getFilteredAvailableSensors = () => {
    return sensors.filter(sensor => {
      const matchesSearch = sensor.sensor_name.toLowerCase().includes(availableSensorSearch.toLowerCase()) ||
                           sensor.sensor_id.toLowerCase().includes(availableSensorSearch.toLowerCase()) ||
                           (sensor.description && sensor.description.toLowerCase().includes(availableSensorSearch.toLowerCase()));
      
      const matchesType = availableSensorTypeFilter === 'all' || sensor.sensor_type === availableSensorTypeFilter;
      
      const matchesStatus = availableSensorStatusFilter === 'all' || 
                           (availableSensorStatusFilter === 'online' && sensor.is_online) ||
                           (availableSensorStatusFilter === 'offline' && !sensor.is_online) ||
                           (availableSensorStatusFilter === 'visible' && sensor.visible) ||
                           (availableSensorStatusFilter === 'hidden' && !sensor.visible);
      
      // Don't show already selected sensors
      const isNotSelected = !selectedSensors.some(s => s.sensor_id === sensor.id);
      
      return matchesSearch && matchesType && matchesStatus && isNotSelected;
    });
  };

  const getFilteredSelectedSensors = () => {
    return selectedSensors.filter(selectedSensor => {
      const sensor = selectedSensor.sensor;
      const matchesSearch = sensor.sensor_name.toLowerCase().includes(selectedSensorSearch.toLowerCase()) ||
                           sensor.sensor_id.toLowerCase().includes(selectedSensorSearch.toLowerCase()) ||
                           (sensor.description && sensor.description.toLowerCase().includes(selectedSensorSearch.toLowerCase())) ||
                           selectedSensor.sensor_location.toLowerCase().includes(selectedSensorSearch.toLowerCase());
      
      const matchesType = selectedSensorTypeFilter === 'all' || sensor.sensor_type === selectedSensorTypeFilter;
      
      return matchesSearch && matchesType;
    });
  };

  const handleSelectSensor = (sensor) => {
    setSelectedSensors(prev => [...prev, {
      sensor_id: sensor.id,
      sensor_location: '',
      sensor: sensor
    }]);
  };

  const handleRemoveSensor = (sensorId) => {
    setSelectedSensors(prev => prev.filter(s => s.sensor_id !== sensorId));
  };

  const handleUpdateSensorLocation = (sensorId, location) => {
    setSelectedSensors(prev => 
      prev.map(s => 
        s.sensor_id === sensorId 
          ? { ...s, sensor_location: location }
          : s
      )
    );
  };

  const getSensorTypes = () => {
    const types = [...new Set(sensors.map(s => s.sensor_type))];
    return types.sort();
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <h1 style={{ margin: 0, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={28} />
          {isEditing ? 'Edit Test' : 'Create New Test'}
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleCancel}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <X size={16} />
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : (isEditing ? 'Update Test' : 'Create Test')}
          </button>
        </div>
      </div>

      {/* Top Row - Test Information and Machine Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
        {/* Left Column - Test Information */}
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '20px'
        }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FileText size={20} />
            Test Information
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Test Name *
              </label>
              <input
                type="text"
                className="form-control"
                value={testForm.test_name}
                onChange={(e) => setTestForm({...testForm, test_name: e.target.value})}
                placeholder="Enter test name"
              />
              {errors.test_name && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '5px' }}>
                  {errors.test_name}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Created By *
              </label>
              <input
                type="text"
                className="form-control"
                value={testForm.created_by}
                onChange={(e) => setTestForm({...testForm, created_by: e.target.value})}
                placeholder="Enter your name"
              />
              {errors.created_by && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '5px' }}>
                  {errors.created_by}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Description
              </label>
              <textarea
                className="form-control"
                value={testForm.description}
                onChange={(e) => setTestForm({...testForm, description: e.target.value})}
                rows="3"
                placeholder="Optional description of the test"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Notes
              </label>
              <textarea
                className="form-control"
                value={testForm.notes}
                onChange={(e) => setTestForm({...testForm, notes: e.target.value})}
                rows="3"
                placeholder="Optional notes or comments"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Machine Selection */}
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '20px'
        }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Settings size={20} />
            Select Machine *
          </h2>

          {/* Machine Search and Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search machines..."
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                style={{ paddingLeft: '35px' }}
              />
              <Search size={16} style={{ 
                position: 'absolute', 
                left: '10px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af' 
              }} />
            </div>
            <select
              className="form-control"
              value={machineStatusFilter}
              onChange={(e) => setMachineStatusFilter(e.target.value)}
              style={{ width: '140px' }}
            >
              <option value="all">All Status</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          {/* Selected Machine */}
          {selectedMachine && (
            <div style={{ 
              backgroundColor: '#f0fdf4', 
              border: '1px solid #22c55e', 
              borderRadius: '6px', 
              padding: '12px',
              marginBottom: '15px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{selectedMachine.machine_name}</strong>
                  {selectedMachine.description && (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {selectedMachine.description}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setSelectedMachine(null)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Machine Table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Machine Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredMachines().map((machine) => (
                  <tr key={machine.id}>
                    <td>
                      <strong>{machine.machine_name}</strong>
                    </td>
                    <td>{machine.description || '-'}</td>
                    <td>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px',
                        backgroundColor: machine.visible ? '#dcfce7' : '#fef2f2',
                        color: machine.visible ? '#166534' : '#991b1b'
                      }}>
                        {machine.visible ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedMachine(machine)}
                        disabled={selectedMachine?.id === machine.id}
                      >
                        {selectedMachine?.id === machine.id ? 'Selected' : 'Select'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.machine && (
            <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '10px' }}>
              {errors.machine}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - Sensor Selection (Full Width) */}
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        padding: '20px'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Wifi size={20} />
          Select Sensors *
        </h2>

        {/* Horizontal Layout for Available and Selected Sensors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Left Side - Available Sensors */}
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} color="#3b82f6" />
              Available Sensors
            </h3>
            
            {/* Search and Filters for Available Sensors */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search available sensors..."
                  value={availableSensorSearch}
                  onChange={(e) => setAvailableSensorSearch(e.target.value)}
                  style={{ paddingLeft: '35px' }}
                />
                <Search size={16} style={{ 
                  position: 'absolute', 
                  left: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} />
              </div>
              <select
                className="form-control"
                value={availableSensorTypeFilter}
                onChange={(e) => setAvailableSensorTypeFilter(e.target.value)}
                style={{ width: '120px' }}
              >
                <option value="all">All Types</option>
                {getSensorTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                className="form-control"
                value={availableSensorStatusFilter}
                onChange={(e) => setAvailableSensorStatusFilter(e.target.value)}
                style={{ width: '120px' }}
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            
            <div style={{ 
              border: '1px solid #d1d5db', 
              borderRadius: '6px',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              <table className="table table-striped table-hover mb-0">
                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th>Sensor Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAvailableSensors().length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ 
                        padding: '40px', 
                        textAlign: 'center', 
                        color: '#6b7280',
                        fontStyle: 'italic'
                      }}>
                        {sensors.length === 0 ? 'No sensors available' : 'No sensors match your search criteria'}
                      </td>
                    </tr>
                  ) : (
                    getFilteredAvailableSensors().map((sensor) => (
                      <tr key={sensor.id}>
                        <td>
                          <div>
                            <strong>{sensor.sensor_name}</strong>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              {sensor.sensor_id}
                            </div>
                            {sensor.description && (
                              <div style={{ fontSize: '10px', color: '#888' }}>
                                {sensor.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            fontSize: '10px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151'
                          }}>
                            {sensor.sensor_type}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {sensor.is_online ? (
                              <>
                                <Wifi size={12} color="#22c55e" />
                                <span style={{ fontSize: '11px', color: '#22c55e' }}>Online</span>
                              </>
                            ) : (
                              <>
                                <WifiOff size={12} color="#ef4444" />
                                <span style={{ fontSize: '11px', color: '#ef4444' }}>Offline</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleSelectSensor(sensor)}
                            title="Add sensor to test"
                          >
                            <Plus size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Side - Selected Sensors */}
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} color="#22c55e" />
              Selected Sensors ({selectedSensors.length})
            </h3>
            
            {/* Search and Filters for Selected Sensors */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search selected sensors..."
                  value={selectedSensorSearch}
                  onChange={(e) => setSelectedSensorSearch(e.target.value)}
                  style={{ paddingLeft: '35px' }}
                />
                <Search size={16} style={{ 
                  position: 'absolute', 
                  left: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} />
              </div>
              <select
                className="form-control"
                value={selectedSensorTypeFilter}
                onChange={(e) => setSelectedSensorTypeFilter(e.target.value)}
                style={{ width: '120px' }}
              >
                <option value="all">All Types</option>
                {getSensorTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {getFilteredSelectedSensors().length === 0 ? (
              <div style={{ 
                backgroundColor: '#f9fafb', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                {selectedSensors.length === 0 
                  ? 'No sensors selected yet. Choose sensors from the available list.' 
                  : 'No selected sensors match your search criteria.'
                }
              </div>
            ) : (
              <div style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                maxHeight: '500px',
                overflowY: 'auto'
              }}>
                <table className="table table-hover mb-0">
                  <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                    <tr>
                      <th>Sensor Name</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th style={{ width: '60px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredSelectedSensors().map((selectedSensor) => (
                      <tr key={selectedSensor.sensor_id}>
                        <td>
                          <div>
                            <strong>{selectedSensor.sensor.sensor_name}</strong>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              {selectedSensor.sensor.sensor_id}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            fontSize: '10px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151'
                          }}>
                            {selectedSensor.sensor.sensor_type}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={selectedSensor.sensor_location}
                            onChange={(e) => handleUpdateSensorLocation(selectedSensor.sensor_id, e.target.value)}
                            placeholder="Enter location"
                            style={{ fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveSensor(selectedSensor.sensor_id)}
                            title="Remove sensor"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {errors.sensors && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <AlertTriangle size={12} />
                {errors.sensors}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default NewTest;