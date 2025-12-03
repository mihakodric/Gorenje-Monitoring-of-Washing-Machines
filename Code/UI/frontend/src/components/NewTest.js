import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, Wifi, WifiOff, Crosshair } from 'lucide-react';
import { testsAPI, sensorsAPI, machinesAPI, machineTypesAPI, sensorTypesAPI, testRelationsAPI } from '../api';

const NewTest = () => {
  const navigate = useNavigate();
  const { id: testId } = useParams();
  const isEditing = Boolean(testId);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  
  // Available data
  const [machines, setMachines] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [sensorTypes, setSensorTypes] = useState([]);
  
  // Form data
  const [testForm, setTestForm] = useState({
    test_name: '',
    test_description: '',
    test_notes: ''
  });
  
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [testStatus, setTestStatus] = useState('idle');
  
  // Filter states
  const [machineSearch, setMachineSearch] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('all');
  const [availableSensorSearch, setAvailableSensorSearch] = useState('');
  const [availableSensorTypeFilter, setAvailableSensorTypeFilter] = useState('all');
  const [availableSensorStatusFilter, setAvailableSensorStatusFilter] = useState('all');
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
      const [machinesResponse, sensorsResponse, machineTypesResponse, sensorTypesResponse] = await Promise.all([
        machinesAPI.getAll(),
        sensorsAPI.getAll(),
        machineTypesAPI.getAll(),
        sensorTypesAPI.getAll()
      ]);
      
      setMachines(machinesResponse.data || []);
      setSensors(sensorsResponse.data || []);
      setMachineTypes(machineTypesResponse.data || []);
      setSensorTypes(sensorTypesResponse.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading machines and sensors');
    } finally {
      setLoading(false);
    }
  };

  const loadTestData = async () => {
    try {
      const testDetailsResponse = await testsAPI.getById(testId);
      const testData = testDetailsResponse.data;

      const testRelationsResponse = await testRelationsAPI.getByTestId(testId);
      const testRelationsData = testRelationsResponse.data;
      
      // Populate form
      setTestForm({
        test_name: testData.test_name,
        test_description: testData.test_description || '',
        test_notes: testData.test_notes || ''
      });
      
      // Set test status
      setTestStatus(testData.test_status || 'idle');
      
      // Set selected machine
      if (testData.machine_id) {
        const machine = machines.find(m => m.id === testData.machine_id);
        setSelectedMachine(machine);
      }
      
      // Set selected sensors with locations AND test_relation_id
      if (testRelationsData && testRelationsData.length > 0) {
        const selectedSensorsData = testRelationsData.map(relation => {
          const sensor = sensors.find(s => s.id === relation.sensor_id);
          return {
            test_relation_id: relation.id, // Keep the existing relation ID
            sensor_id: relation.sensor_id,
            sensor_location: relation.sensor_location || '',
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
        await testsAPI.update(testId, {
          ...testForm,
          machine_id: selectedMachine.id
        });
      } else {
        const payload = {
          test: testForm,
          machine_id: selectedMachine.id,
          sensors: sensorData
        };
        await testsAPI.createWithRelations(payload);
      }

      navigate('/tests');
    } catch (error) {
      console.error('Error saving test:', error);
      alert(`Error ${isEditing ? 'updating' : 'creating'} test: ${error.response?.data?.detail || error.message}`);
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
                           (machine.machine_description && machine.machine_description.toLowerCase().includes(machineSearch.toLowerCase()));
      
      const matchesType = machineTypeFilter === 'all' || 
                         machine.machine_type_id === parseInt(machineTypeFilter);
      
      return matchesSearch && matchesType;
    });
  };

  const getFilteredAvailableSensors = () => {
    return sensors.filter(sensor => {
      const matchesSearch = sensor.sensor_name.toLowerCase().includes(availableSensorSearch.toLowerCase()) ||
                           sensor.sensor_id.toLowerCase().includes(availableSensorSearch.toLowerCase()) ||
                           (sensor.sensor_description && sensor.sensor_description.toLowerCase().includes(availableSensorSearch.toLowerCase()));
      
      const matchesType = availableSensorTypeFilter === 'all' || sensor.sensor_type_id === parseInt(availableSensorTypeFilter);
      
      const matchesStatus = availableSensorStatusFilter === 'all' || 
                           (availableSensorStatusFilter === 'online' && sensor.sensor_is_online) ||
                           (availableSensorStatusFilter === 'offline' && !sensor.sensor_is_online) ||
                           (availableSensorStatusFilter === 'visible' && sensor.sensor_visible) ||
                           (availableSensorStatusFilter === 'hidden' && !sensor.sensor_visible);
      
      const isNotSelected = !selectedSensors.some(s => s.sensor_id === sensor.id);
      
      return matchesSearch && matchesType && matchesStatus && isNotSelected;
    });
  };

  const getFilteredSelectedSensors = () => {
    return selectedSensors.filter(selectedSensor => {
      const sensor = selectedSensor.sensor;
      const matchesSearch = sensor.sensor_name.toLowerCase().includes(selectedSensorSearch.toLowerCase()) ||
                           sensor.sensor_id.toLowerCase().includes(selectedSensorSearch.toLowerCase()) ||
                           (sensor.sensor_description && sensor.sensor_description.toLowerCase().includes(selectedSensorSearch.toLowerCase())) ||
                           selectedSensor.sensor_location.toLowerCase().includes(selectedSensorSearch.toLowerCase());
      
      const matchesType = selectedSensorTypeFilter === 'all' || sensor.sensor_type_id === parseInt(selectedSensorTypeFilter);
      
      return matchesSearch && matchesType;
    });
  };

  const handleMachineSelect = async (machine) => {
    setSelectedMachine(machine);
    
    if (isEditing && testId) {
      try {
        setAutoSaving(true);
        // Just update the machine_id on the test
        await testsAPI.update(testId, {
          machine_id: machine?.id
        });
      } catch (error) {
        console.error('Error auto-saving machine selection:', error);
        alert('Error updating machine selection. Please try again.');
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleSelectSensor = async (sensor) => {
    const newSensorRelation = {
      sensor_id: sensor.id,
      sensor_location: '',
      sensor: sensor
      // No test_relation_id yet - this is a new relation
    };
    
    setSelectedSensors(prev => [...prev, newSensorRelation]);
    
    if (isEditing && testId) {
      try {
        setAutoSaving(true);
        // Only add the new sensor relation
        const newRelations = [{
          test_id: parseInt(testId),
          sensor_id: sensor.id,
          sensor_location: ''
        }];
        
        const response = await testRelationsAPI.create(newRelations);
        
        // Update the new relation with the ID returned from backend
        if (response.data && response.data.length > 0) {
          const createdRelation = response.data[0];
          setSelectedSensors(prev => 
            prev.map(s => 
              s.sensor_id === sensor.id && !s.test_relation_id
                ? { ...s, test_relation_id: createdRelation.id }
                : s
            )
          );
        }
      } catch (error) {
        console.error('Error auto-saving sensor relation:', error);
        setSelectedSensors(prev => prev.filter(s => s.sensor_id !== sensor.id));
        alert('Error adding sensor. Please try again.');
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleRemoveSensor = async (sensorId) => {
    const sensorToRemove = selectedSensors.find(s => s.sensor_id === sensorId);
    
    if (!sensorToRemove) {
      console.error('Sensor not found:', sensorId);
      return;
    }
    
    const originalSensors = selectedSensors;
    
    // If we're editing and the sensor has a test_relation_id, check for measurements
    if (isEditing && testId && sensorToRemove.test_relation_id) {
      try {
        console.log('Checking measurements for test_relation_id:', sensorToRemove.test_relation_id);
        
        // Check if this relation has measurements
        const checkResponse = await testRelationsAPI.checkMeasurements(sensorToRemove.test_relation_id);
        console.log('Measurement check response:', checkResponse.data);
        
        const { has_measurements, measurement_count } = checkResponse.data;
        
        if (has_measurements) {
          const confirmMessage = 
            `⚠️ WARNING: This sensor has ${measurement_count} measurements stored!\n\n` +
            `Sensor: ${sensorToRemove.sensor.sensor_name}\n` +
            `Location: ${sensorToRemove.sensor_location || 'N/A'}\n\n` +
            `Removing this sensor will PERMANENTLY DELETE:\n` +
            `• ${measurement_count} raw measurements\n` +
            `• All aggregated data\n\n` +
            `This action CANNOT be undone!\n\n` +
            `Do you want to proceed?`;
          
          if (!window.confirm(confirmMessage)) {
            console.log('User cancelled removal');
            return; // User cancelled
          }
        } else {
          // No measurements, just confirm removal
          if (!window.confirm(`Remove sensor "${sensorToRemove.sensor.sensor_name}" from this test?`)) {
            console.log('User cancelled removal');
            return;
          }
        }
        
        setAutoSaving(true);
        
        // Delete the test relation (force=true if has measurements)
        console.log('Deleting test relation with force=', has_measurements);
        await testRelationsAPI.deleteSingle(sensorToRemove.test_relation_id, has_measurements);
        
        setSelectedSensors(prev => prev.filter(s => s.sensor_id !== sensorId));
        console.log('Sensor removed successfully');
        
      } catch (error) {
        console.error('Error removing sensor relation:', error);
        console.error('Error details:', error.response?.data);
        setSelectedSensors(originalSensors);
        alert(`Error removing sensor:\n${error.response?.data?.detail || error.message}`);
      } finally {
        setAutoSaving(false);
      }
    } else {
      // Not editing or no test_relation_id (new relation not saved yet)
      console.log('Removing sensor without database check (no test_relation_id or not editing)');
      
      // Simple confirmation for non-saved sensors
      if (!window.confirm(`Remove sensor "${sensorToRemove.sensor.sensor_name}" from this test?`)) {
        return;
      }
      
      setSelectedSensors(prev => prev.filter(s => s.sensor_id !== sensorId));
    }
  };

  const handleUpdateSensorLocation = async (sensorId, location) => {
    const originalSensors = selectedSensors;
    const sensorToUpdate = selectedSensors.find(s => s.sensor_id === sensorId);
    
    setSelectedSensors(prev => 
      prev.map(s => 
        s.sensor_id === sensorId 
          ? { ...s, sensor_location: location }
          : s
      )
    );
    
    if (isEditing && testId && sensorToUpdate?.test_relation_id) {
      try {
        setAutoSaving(true);
        // Update only this specific relation
        await testRelationsAPI.update(sensorToUpdate.test_relation_id, {
          sensor_location: location
        });
      } catch (error) {
        console.error('Error auto-saving sensor location:', error);
        setSelectedSensors(originalSensors);
        alert('Error updating sensor location. Please try again.');
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const getSensorTypeName = (sensor_type_id) => {
    const sensorType = sensorTypes.find(type => type.id === sensor_type_id);
    return sensorType ? sensorType.sensor_type_name : 'Unknown';
  };

  const getMachineTypeName = (machine_type_id) => {
    const machineType = machineTypes.find(type => type.id === machine_type_id);
    return machineType ? machineType.machine_type_name : 'Unknown';
  };

  const handleIdentifySensor = async (sensor) => {
    try {
      console.log(`Identifying sensor: ${sensor.sensor_name} (${sensor.sensor_mqtt_topic}/cmd/identify)`);
      await sensorsAPI.identify(sensor.sensor_mqtt_topic);
      alert(`✅ Identify command sent to sensor:\n${sensor.sensor_name}\n\nThe sensor LED should blink now.`);
    } catch (error) {
      console.error('Error sending identify command:', error);
      alert(`❌ Failed to send identify command:\n${error.response?.data?.detail || error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="flex-center" style={{ height: '200px' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="page-header">
        <h1>{isEditing ? 'Edit Test' : 'Create New Test'}</h1>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={saving || autoSaving}
          >
            {saving ? 'Saving...' : (isEditing ? 'Update Test' : 'Create Test')}
          </button>
          {autoSaving && isEditing && (
            <span className="auto-save-indicator">Auto-saving...</span>
          )}
        </div>
      </div>

      {/* Test Information and Machine Selection */}
      <div className="grid-2-col">
        {/* Test Information Form */}
        <div className="card no-padding">
          <div className="card-header">
            <h2>Test Information</h2>
          </div>
          <div className="card-body">
            <div className="test-form-container">
            <div className="form-group">
              <label htmlFor="test_name">Test Name *</label>
              <input
                type="text"
                id="test_name"
                name="test_name"
                value={testForm.test_name}
                onChange={(e) => setTestForm({...testForm, test_name: e.target.value})}
                className={`form-control ${errors.test_name ? 'error' : ''}`}
                placeholder="Enter test name"
              />
              {errors.test_name && <div className="error-message">{errors.test_name}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="test_description">Description</label>
              <textarea
                id="test_description"
                name="test_description"
                value={testForm.test_description}
                onChange={(e) => setTestForm({...testForm, test_description: e.target.value})}
                className="form-control"
                rows="3"
                placeholder="Optional description of the test"
              />
            </div>

            <div className="form-group">
              <label htmlFor="test_notes">Notes</label>
              <textarea
                id="test_notes"
                name="test_notes"
                value={testForm.test_notes}
                onChange={(e) => setTestForm({...testForm, test_notes: e.target.value})}
                className="form-control"
                rows="3"
                placeholder="Optional notes or comments"
              />
            </div>
            </div>
          </div>
        </div>

        {/* Machine Selection */}
        <div className="card no-padding">
        <div className="card-header">
          <h2>Select Machine *</h2>
        </div>
        <div className="card-body">
          <div className="machine-selection-container">
          {errors.machine && <div className="error-message">{errors.machine}</div>}

          {/* Machine Search and Filters */}
          <div className="filter-section">
            <div className="form-group">
              <input
                type="text"
                placeholder="Search machines..."
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <select
                value={machineTypeFilter}
                onChange={(e) => setMachineTypeFilter(e.target.value)}
                className="form-control"
              >
                <option value="all">All Types</option>
                {machineTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.machine_type_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Machine */}
          {selectedMachine && (
            <div className="selected-item">
              <h3>Selected Machine:</h3>
              <div className="selected-machine-card selected">
                <div className="machine-info">
                  <h4>{selectedMachine.machine_name}</h4>
                  <p>Type: {getMachineTypeName(selectedMachine.machine_type_id)}</p>
                  {selectedMachine.machine_description && (
                    <p>Description: {selectedMachine.machine_description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleMachineSelect(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Available Machines */}
          {!selectedMachine && (
            <div className="table-full-height">
              <h3>Available Machines ({getFilteredMachines().length}):</h3>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Machine Details</th>
                      <th>Machine Type</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredMachines().map((machine, index) => (
                      <tr key={`machine-${machine.id}-${index}`}>
                        <td>
                          <div className="machine-card">
                            <div className="machine-icon">
                              <Activity size={20} />
                            </div>
                            <div className="machine-content">
                              <div className="machine-name">
                                {machine.machine_name}
                              </div>
                              <div className="machine-description">
                                {machine.machine_description || "No description"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge">
                            {getMachineTypeName(machine.machine_type_id)}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              onClick={() => handleMachineSelect(machine)}
                              className="btn btn-primary btn-sm"
                            >
                              Select
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {getFilteredMachines().length === 0 && (
                <div className="table-empty">
                  <div className="table-empty-icon">🏭</div>
                  No machines match the current filters.
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
      </div>

      {/* Sensor Selection */}
      <div className="card no-padding">
        <div className="card-header">
          <h2>Select Sensors *</h2>
        </div>
        <div className="card-body">
          {errors.sensors && <div className="error-message">{errors.sensors}</div>}

          {/* Horizontal Layout for Selected and Available Sensors */}
          <div className="sensor-tables-wrapper">
            
            {/* Left Side - Available Sensors */}
            <div className="sensor-table-section">
              <h3>Available Sensors ({getFilteredAvailableSensors().length}):</h3>

              {/* Available Sensors Filters */}
              <div className="filter-section">
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Search available sensors..."
                    value={availableSensorSearch}
                    onChange={(e) => setAvailableSensorSearch(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <select
                    value={availableSensorTypeFilter}
                    onChange={(e) => setAvailableSensorTypeFilter(e.target.value)}
                    className="form-control"
                  >
                    <option value="all">All Types</option>
                    {sensorTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.sensor_type_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <select
                    value={availableSensorStatusFilter}
                    onChange={(e) => setAvailableSensorStatusFilter(e.target.value)}
                    className="form-control"
                  >
                    <option value="all">All Statuses</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAvailableSensors().map((sensor, index) => (
                      <tr key={`available-sensor-${sensor.id}-${index}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {sensor.sensor_is_online ? (
                              <Wifi size={14} className="status-online" />
                            ) : (
                              <WifiOff size={14} className="status-offline" />
                            )}
                            <div>
                              <strong>{sensor.sensor_name}</strong>
                              <div className="sensor-id">{sensor.sensor_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge">
                            {getSensorTypeName(sensor.sensor_type_id)}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              onClick={() => handleIdentifySensor(sensor)}
                              disabled={!sensor.sensor_is_online || sensor.sensor_is_active}
                              className="btn btn-primary btn-sm"
                              title={
                                sensor.sensor_is_active 
                                  ? "Sensor is active in a running test" 
                                  : sensor.sensor_is_online 
                                    ? "Identify sensor (blink LED)" 
                                    : "Sensor offline"
                              }
                            >
                              <Crosshair size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectSensor(sensor)}
                              className="btn btn-primary btn-sm"
                              disabled={testStatus === 'running'}
                              title={testStatus === 'running' ? 'Cannot add sensors - test is running' : 'Add sensor to test'}
                            >
                              Add
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {getFilteredAvailableSensors().length === 0 && (
                <div className="table-empty">
                  <div className="table-empty-icon">📡</div>
                  {selectedSensors.length === sensors.length ? 
                    'All sensors have been selected.' : 
                    'No sensors match the current filters.'
                  }
                </div>
              )}
            </div>

            {/* Right Side - Selected Sensors */}
            <div className="sensor-table-section">
              <h3>Selected Sensors ({selectedSensors.length}):</h3>

              {selectedSensors.length > 0 ? (
                <>
                  {/* Selected Sensors Filters */}
                  <div className="filter-section">
                    <div className="form-group">
                      <input
                        type="text"
                        placeholder="Search selected sensors..."
                        value={selectedSensorSearch}
                        onChange={(e) => setSelectedSensorSearch(e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <select
                        value={selectedSensorTypeFilter}
                        onChange={(e) => setSelectedSensorTypeFilter(e.target.value)}
                        className="form-control"
                      >
                        <option value="all">All Types</option>
                        {sensorTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.sensor_type_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Test Location</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredSelectedSensors().map((item, index) => (
                          <tr key={`selected-sensor-${item.sensor_id}-${index}`}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {item.sensor.sensor_is_online ? (
                                  <Wifi size={14} className="status-online" />
                                ) : (
                                  <WifiOff size={14} className="status-offline" />
                                )}
                                <div>
                                  <strong>{item.sensor.sensor_name}</strong>
                                  <div className="sensor-id">{item.sensor.sensor_id}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge">
                                {getSensorTypeName(item.sensor.sensor_type_id)}
                              </span>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={item.sensor_location}
                                onChange={(e) => handleUpdateSensorLocation(item.sensor_id, e.target.value)}
                                className="form-control form-control-sm"
                                placeholder="Specify location for this test"
                              />
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  type="button"
                                  onClick={() => handleIdentifySensor(item.sensor)}
                                  disabled={!item.sensor.sensor_is_online || item.sensor.sensor_is_active}
                                  className="btn btn-primary btn-sm"
                                  title={
                                    item.sensor.sensor_is_active 
                                      ? "Sensor is active in a running test" 
                                      : item.sensor.sensor_is_online 
                                        ? "Identify sensor (blink LED)" 
                                        : "Sensor offline"
                                  }
                                >
                                  <Crosshair size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSensor(item.sensor_id)}
                                  className="btn btn-secondary btn-sm"
                                  disabled={testStatus === 'running'}
                                  title={testStatus === 'running' ? 'Cannot remove sensors - test is running' : 'Remove sensor from test'}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="table-empty">
                  <div className="table-empty-icon">📋</div>
                  No sensors selected yet. Choose sensors from the available list.
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTest;