import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Laptop, Wifi, WifiOff, Crosshair, Eye, Copy, Plus, Trash2 } from 'lucide-react';
import { testsAPI, sensorsAPI, machinesAPI, machineTypesAPI, sensorTypesAPI, testRelationsAPI } from '../api';
import SensorModal from './SensorModal';
import { toast } from '../utils/toast';

const NewTest = () => {
  const navigate = useNavigate();
  const { id: testId } = useParams();
  const isEditing = Boolean(testId);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  
  // Available data
  const [machines, setMachines] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [machineTypeTemplates, setMachineTypeTemplates] = useState([]);
  
  // Form data
  const [testForm, setTestForm] = useState({
    test_name: '',
    test_description: '',
    test_notes: ''
  });
  
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [testStatus, setTestStatus] = useState('idle');
  
  // Sensor modal
  const [showSensorModal, setShowSensorModal] = useState(false);
  const [modalSensorType, setModalSensorType] = useState(null);
  const [modalTemplateIndex, setModalTemplateIndex] = useState(null);
  
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
      
      // Set selected machine and load templates
      if (testData.machine_id) {
        const machine = machines.find(m => m.id === testData.machine_id);
        setSelectedMachine(machine);
        
        // Load machine type templates
        if (machine && machine.machine_type_id) {
          try {
            const response = await machineTypesAPI.getTemplates(machine.machine_type_id);
            setMachineTypeTemplates(response.data || []);
          } catch (error) {
            console.error('Error loading machine type templates:', error);
            setMachineTypeTemplates([]);
          }
        }
      }
      
      // Set selected sensors with locations, test_relation_id, AND measurement info
      if (testRelationsData && testRelationsData.length > 0) {
        const selectedSensorsData = testRelationsData.map(relation => {
          const sensor = sensors.find(s => s.id === relation.sensor_id);
          return {
            test_relation_id: relation.id, // Keep the existing relation ID
            sensor_id: relation.sensor_id,
            sensor_location: relation.sensor_location || '',
            sensor: sensor,
            has_measurements: relation.sensor_has_data || false, // Track if sensor has data
            measurement_count: relation.measurement_count || 0
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

  const handleDuplicate = async () => {
    if (!isEditing || !testId) return;
    
    try {
      setDuplicating(true);
      
      // Prepare sensor data from selected sensors
      const sensorData = selectedSensors.map(s => ({
        sensor_id: s.sensor_id,
        sensor_location: s.sensor_location
      }));

      // Create new test with " - Copy" appended to name
      const payload = {
        test: {
          test_name: testForm.test_name + ' - Copy',
          test_description: testForm.test_description,
          test_notes: testForm.test_notes
        },
        machine_id: selectedMachine?.id,
        sensors: sensorData
      };

      const response = await testsAPI.createWithRelations(payload);
      const newTestId = response.data.id;
      
      // Navigate to edit the newly created duplicate test
      navigate(`/tests/edit/${newTestId}`);
    } catch (error) {
      console.error('Error duplicating test:', error);
      alert(`Error duplicating test: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDuplicating(false);
    }
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
    
    // Load machine type templates if machine has a type
    if (machine && machine.machine_type_id) {
      try {
        const response = await machineTypesAPI.getTemplates(machine.machine_type_id);
        setMachineTypeTemplates(response.data || []);
      } catch (error) {
        console.error('Error loading machine type templates:', error);
        setMachineTypeTemplates([]);
      }
    } else {
      setMachineTypeTemplates([]);
    }
    
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
      toast.success(`Identify command sent to sensor: ${sensor.sensor_name}. LED should blink now.`, 4000);
    } catch (error) {
      console.error('Error sending identify command:', error);
      toast.error(`Failed to send identify command: ${error.response?.data?.detail || error.message}`, 5000);
    }
  };

  // Template-based sensor management
  const handleOpenSensorModal = (sensorTypeId, templateIndex = null) => {
    setModalSensorType(sensorTypeId);
    setModalTemplateIndex(templateIndex);
    setShowSensorModal(true);
  };

  const handleSensorModalSave = async (savedSensor) => {
    // Reload sensors
    try {
      const sensorsResponse = await sensorsAPI.getAll();
      setSensors(sensorsResponse.data || []);
      
      // Auto-select if sensor type matches
      if (modalSensorType && savedSensor.sensor_type_id === modalSensorType) {
        // Find the template row this was for
        const template = modalTemplateIndex !== null ? 
          (machineTypeTemplates[modalTemplateIndex] || null) : null;
        
        const newSensorRelation = {
          sensor_id: savedSensor.id,
          sensor_location: template?.location || '',
          sensor: savedSensor
        };
        
        setSelectedSensors(prev => [...prev, newSensorRelation]);
        
        if (isEditing && testId) {
          try {
            setAutoSaving(true);
            const response = await testRelationsAPI.create([{
              test_id: parseInt(testId),
              sensor_id: savedSensor.id,
              sensor_location: template?.location || ''
            }]);
            
            // Update with returned test_relation_id
            if (response.data && response.data.length > 0) {
              const createdRelation = response.data[0];
              setSelectedSensors(prev => 
                prev.map(s => 
                  s.sensor_id === savedSensor.id && !s.test_relation_id
                    ? { ...s, test_relation_id: createdRelation.id }
                    : s
                )
              );
            }
          } catch (error) {
            console.error('Error auto-saving sensor:', error);
            setSelectedSensors(prev => prev.filter(s => s.sensor_id !== savedSensor.id));
            alert('Error adding sensor. Please try again.');
          } finally {
            setAutoSaving(false);
          }
        }
      }
    } catch (error) {
      console.error('Error reloading sensors:', error);
    }
    
    setShowSensorModal(false);
    setModalSensorType(null);
    setModalTemplateIndex(null);
  };

  const getAvailableSensorsForType = (sensorTypeId) => {
    return sensors.filter(sensor => 
      sensor.sensor_type_id === sensorTypeId &&
      !selectedSensors.some(s => s.sensor_id === sensor.id)
    );
  };

  const getAvailableOtherSensors = () => {
    return sensors.filter(sensor => 
      !selectedSensors.some(s => s.sensor_id === sensor.id)
    );
  };

  const handleSelectOtherSensor = async (sensorId) => {
    if (!sensorId) return;
    
    const sensor = sensors.find(s => s.id === parseInt(sensorId));
    if (!sensor) return;
    
    const newSensorRelation = {
      sensor_id: sensor.id,
      sensor_location: '',
      sensor: sensor
    };
    
    setSelectedSensors(prev => [...prev, newSensorRelation]);
    
    if (isEditing && testId) {
      try {
        setAutoSaving(true);
        const response = await testRelationsAPI.create([{
          test_id: parseInt(testId),
          sensor_id: sensor.id,
          sensor_location: ''
        }]);
        
        // Update with returned test_relation_id
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
        console.error('Error auto-saving sensor:', error);
        setSelectedSensors(prev => prev.filter(s => s.sensor_id !== sensor.id));
        alert('Error adding sensor. Please try again.');
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const handleTemplateSelectSensor = async (template, sensorId) => {
    if (!sensorId) return;
    
    const sensor = sensors.find(s => s.id === parseInt(sensorId));
    if (!sensor) return;
    
    const newSensorRelation = {
      sensor_id: sensor.id,
      sensor_location: template.location,
      sensor: sensor
    };
    
    setSelectedSensors(prev => [...prev, newSensorRelation]);
    
    if (isEditing && testId) {
      try {
        setAutoSaving(true);
        const response = await testRelationsAPI.create([{
          test_id: parseInt(testId),
          sensor_id: sensor.id,
          sensor_location: template.location
        }]);
        
        // Update with returned test_relation_id
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
        console.error('Error auto-saving sensor:', error);
        setSelectedSensors(prev => prev.filter(s => s.sensor_id !== sensor.id));
        alert('Error adding sensor. Please try again.');
      } finally {
        setAutoSaving(false);
      }
    }
  };

  const getGroupedSensors = () => {
    const required = [];
    const optional = [];
    const other = [];
    
    // Track which sensors are assigned to templates
    const assignedSensorIds = new Set();
    
    // Group by templates (match by sensor_type_id only, not location)
    machineTypeTemplates.forEach(template => {
      const selectedSensor = selectedSensors.find(s => 
        s.sensor?.sensor_type_id === template.sensor_type_id &&
        !assignedSensorIds.has(s.sensor_id)
      );
      
      if (selectedSensor) {
        assignedSensorIds.add(selectedSensor.sensor_id);
      }
      
      const templateRow = {
        ...template,
        selectedSensor: selectedSensor || null
      };
      
      if (template.is_required) {
        required.push(templateRow);
      } else {
        optional.push(templateRow);
      }
    });
    
    // Find sensors not in templates (by sensor_id)
    selectedSensors.forEach(selected => {
      if (!assignedSensorIds.has(selected.sensor_id)) {
        other.push(selected);
      }
    });
    
    return { required, optional, other };
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
          {isEditing && (
            <>
              <button 
                className="btn btn-secondary btn-icon" 
                onClick={() => navigate(`/tests/overview/${testId}`)}
                title="View Test Overview"
              >
                <Eye size={16} />
                Overview
              </button>
              <button 
                className="btn btn-secondary btn-icon" 
                onClick={handleDuplicate}
                disabled={duplicating || saving || autoSaving}
                title="Duplicate Test"
              >
                <Copy size={16} />
                {duplicating ? 'Duplicating...' : 'Duplicate'}
              </button>
            </>
          )}
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
                  disabled={testStatus === 'running' || (isEditing && selectedSensors.length > 0)}
                  className="btn btn-secondary btn-sm"
                  title={testStatus === 'running' ? 'Cannot change machine while test is running' : isEditing && selectedSensors.length > 0 ? 'Cannot change machine - test already has sensor data' : 'Remove'}
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
                <table className="table table-striped compact-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Machine Details</th>
                      <th style={{ width: '35%' }}>Machine Type</th>
                      <th style={{ width: '20%', position: 'sticky', right: 0, background: 'inherit' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredMachines().map((machine, index) => (
                      <tr key={`machine-${machine.id}-${index}`}>
                        <td style={{ width: '45%' }}>
                          <div className="machine-card">
                            <div className="machine-icon">
                              <Laptop size={18} />
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
                        <td style={{ width: '35%' }}>
                          <span className="badge">
                            {getMachineTypeName(machine.machine_type_id)}
                          </span>
                        </td>
                        <td style={{ width: '20%', position: 'sticky', right: 0, background: 'white' }}>
                          <div className="action-buttons">
                            <button
                              type="button"
                              onClick={() => handleMachineSelect(machine)}
                              disabled={testStatus === 'running' || (isEditing && selectedSensors.length > 0)}
                              className="btn btn-primary btn-sm"
                              title={testStatus === 'running' ? 'Cannot change machine while test is running' : isEditing && selectedSensors.length > 0 ? 'Cannot change machine - test already has sensor data' : 'Select machine'}
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

          {selectedMachine && machineTypeTemplates.length > 0 ? (
            <>
              {/* Template-based sensor selection */}
              {(() => {
                const { required, optional, other } = getGroupedSensors();
                
                return (
                  <>
                    {/* Required Sensors */}
                    {required.length > 0 && (
                      <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ color: '#dc2626', marginBottom: '15px', fontSize: '18px' }}>
                          Required Sensors
                        </h3>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th style={{ width: '20%' }}>Sensor Type</th>
                                <th style={{ width: '20%' }}>Location</th>
                                <th style={{ width: '40%' }}>Select Sensor</th>
                                <th style={{ width: '20%', position: 'sticky', right: 0, background: 'inherit' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {required.map((template, idx) => (
                                <tr key={`req-${template.id}-${idx}`}>
                                  <td style={{ width: '20%' }}><strong>{template.sensor_type_name}</strong></td>
                                  <td style={{ width: '20%' }}>
                                    {template.selectedSensor ? (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={template.selectedSensor.sensor_location}
                                        onChange={(e) => handleUpdateSensorLocation(template.selectedSensor.sensor_id, e.target.value)}
                                        placeholder="Location"
                                      />
                                    ) : (
                                      <span style={{ color: '#6b7280' }}>{template.location}</span>
                                    )}
                                  </td>
                                  <td style={{ width: '40%' }}>
                                    {template.selectedSensor ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {template.selectedSensor.sensor.sensor_is_online ? (
                                          <Wifi size={14} className="status-online" />
                                        ) : (
                                          <WifiOff size={14} className="status-offline" />
                                        )}
                                        <span style={{ color: '#059669', fontWeight: '600' }}>
                                          ✓ {template.selectedSensor.sensor.sensor_name}
                                        </span>
                                      </div>
                                    ) : (
                                      <select
                                        className="form-control form-control-sm"
                                        onChange={(e) => handleTemplateSelectSensor(template, e.target.value)}
                                        value=""
                                      >
                                        <option value="">Select sensor...</option>
                                        {getAvailableSensorsForType(template.sensor_type_id).map(sensor => (
                                          <option key={sensor.id} value={sensor.id}>
                                            {sensor.sensor_name} {!sensor.sensor_is_online && '(offline)'}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                  <td style={{ width: '20%', position: 'sticky', right: 0, background: 'white' }}>
                                    <div className="action-buttons">
                                      {template.selectedSensor ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleIdentifySensor(template.selectedSensor.sensor)}
                                            disabled={!template.selectedSensor.sensor.sensor_is_online || testStatus === 'running'}
                                            className="btn btn-primary btn-sm"
                                            title={testStatus === 'running' ? 'Cannot identify while test is running' : 'Identify sensor'}
                                          >
                                            <Crosshair size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSensor(template.selectedSensor.sensor_id)}
                                            disabled={testStatus === 'running' || template.selectedSensor.has_measurements}
                                            className="btn btn-danger btn-sm"
                                            title={template.selectedSensor.has_measurements ? 'Cannot remove sensor with measurements' : testStatus === 'running' ? 'Cannot remove sensor while test is running' : 'Remove'}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSensorModal(template.sensor_type_id, idx)}
                                          disabled={testStatus === 'running'}
                                          className="btn btn-secondary btn-sm"
                                          title={testStatus === 'running' ? 'Cannot create sensor while test is running' : 'Create new sensor'}
                                        >
                                          <Plus size={14} /> New
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Optional Sensors */}
                    {optional.length > 0 && (
                      <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ color: '#2563eb', marginBottom: '15px', fontSize: '18px' }}>
                          Optional Sensors
                        </h3>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th style={{ width: '20%' }}>Sensor Type</th>
                                <th style={{ width: '20%' }}>Location</th>
                                <th style={{ width: '40%' }}>Select Sensor</th>
                                <th style={{ width: '20%', position: 'sticky', right: 0, background: 'inherit' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {optional.map((template, idx) => (
                                <tr key={`opt-${template.id}-${idx}`}>
                                  <td style={{ width: '20%' }}><strong>{template.sensor_type_name}</strong></td>
                                  <td style={{ width: '20%' }}>
                                    {template.selectedSensor ? (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={template.selectedSensor.sensor_location}
                                        onChange={(e) => handleUpdateSensorLocation(template.selectedSensor.sensor_id, e.target.value)}
                                        placeholder="Location"
                                      />
                                    ) : (
                                      <span style={{ color: '#6b7280' }}>{template.location}</span>
                                    )}
                                  </td>
                                  <td style={{ width: '40%' }}>
                                    {template.selectedSensor ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {template.selectedSensor.sensor.sensor_is_online ? (
                                          <Wifi size={14} className="status-online" />
                                        ) : (
                                          <WifiOff size={14} className="status-offline" />
                                        )}
                                        <span style={{ color: '#059669', fontWeight: '600' }}>
                                          ✓ {template.selectedSensor.sensor.sensor_name}
                                        </span>
                                      </div>
                                    ) : (
                                      <select
                                        className="form-control form-control-sm"
                                        onChange={(e) => handleTemplateSelectSensor(template, e.target.value)}
                                        value=""
                                      >
                                        <option value="">Select sensor...</option>
                                        {getAvailableSensorsForType(template.sensor_type_id).map(sensor => (
                                          <option key={sensor.id} value={sensor.id}>
                                            {sensor.sensor_name} {!sensor.sensor_is_online && '(offline)'}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                  <td style={{ width: '20%', position: 'sticky', right: 0, background: 'white' }}>
                                    <div className="action-buttons">
                                      {template.selectedSensor ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleIdentifySensor(template.selectedSensor.sensor)}
                                            disabled={!template.selectedSensor.sensor.sensor_is_online || testStatus === 'running'}
                                            className="btn btn-primary btn-sm"
                                            title={testStatus === 'running' ? 'Cannot identify while test is running' : 'Identify sensor'}
                                          >
                                            <Crosshair size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSensor(template.selectedSensor.sensor_id)}
                                            disabled={testStatus === 'running' || template.selectedSensor.has_measurements}
                                            className="btn btn-danger btn-sm"
                                            title={template.selectedSensor.has_measurements ? 'Cannot remove sensor with measurements' : testStatus === 'running' ? 'Cannot remove sensor while test is running' : 'Remove'}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSensorModal(template.sensor_type_id, idx + required.length)}
                                          disabled={testStatus === 'running'}
                                          className="btn btn-secondary btn-sm"
                                          title={testStatus === 'running' ? 'Cannot create sensor while test is running' : 'Create new sensor'}
                                        >
                                          <Plus size={14} /> New
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Other Sensors */}
                    <div>
                      <h3 style={{ color: '#6b7280', marginBottom: '15px', fontSize: '18px' }}>
                        Other Sensors (Not in Template)
                      </h3>
                      {other.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th style={{ width: '20%' }}>Type</th>
                                <th style={{ width: '20%' }}>Location</th>
                                <th style={{ width: '40%' }}>Sensor Name</th>
                                <th style={{ width: '20%', position: 'sticky', right: 0, background: 'inherit' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {other.map((item) => (
                                <tr key={item.sensor_id}>
                                  <td style={{ width: '20%' }}>{getSensorTypeName(item.sensor.sensor_type_id)}</td>
                                  <td style={{ width: '20%' }}>
                                    <input
                                      type="text"
                                      value={item.sensor_location}
                                      onChange={(e) => handleUpdateSensorLocation(item.sensor_id, e.target.value)}
                                      className="form-control form-control-sm"
                                      placeholder="Specify location"
                                    />
                                  </td>
                                  <td style={{ width: '40%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {item.sensor.sensor_is_online ? (
                                        <Wifi size={14} className="status-online" />
                                      ) : (
                                        <WifiOff size={14} className="status-offline" />
                                      )}
                                      <strong>{item.sensor.sensor_name}</strong>
                                      {item.has_measurements && (
                                        <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500', marginLeft: '8px' }}>
                                          (Has {item.measurement_count} measurements)
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ width: '20%', position: 'sticky', right: 0, background: 'white' }}>
                                    <div className="action-buttons">
                                      <button
                                        type="button"
                                        onClick={() => handleIdentifySensor(item.sensor)}
                                        disabled={!item.sensor.sensor_is_online || testStatus === 'running'}
                                        className="btn btn-primary btn-sm"
                                        title={testStatus === 'running' ? 'Cannot identify while test is running' : 'Identify'}
                                      >
                                        <Crosshair size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSensor(item.sensor_id)}
                                        disabled={testStatus === 'running' || item.has_measurements}
                                        className="btn btn-danger btn-sm"
                                        title={item.has_measurements ? 'Cannot remove sensor with measurements' : testStatus === 'running' ? 'Cannot remove sensor while test is running' : 'Remove'}
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
                      ) : (
                        <div className="table-empty">
                          <div className="table-empty-icon">📋</div>
                          No additional sensors selected.
                        </div>
                      )}
                      
                      {/* Add other sensor controls */}
                      <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                            Add Existing Sensor:
                          </label>
                          <select
                            className="form-control"
                            onChange={(e) => {
                              handleSelectOtherSensor(e.target.value);
                              e.target.value = ''; // Reset dropdown
                            }}
                            disabled={testStatus === 'running'}
                            value=""
                            title={testStatus === 'running' ? 'Cannot add sensors while test is running' : ''}
                          >
                            <option value="">Select a sensor...</option>
                            {getAvailableOtherSensors().map(sensor => (
                              <option key={sensor.id} value={sensor.id}>
                                {sensor.sensor_name} ({getSensorTypeName(sensor.sensor_type_id)}) {!sensor.sensor_is_online && '- Offline'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenSensorModal(null, null)}
                          className="btn btn-secondary"
                          title="Create a new sensor"
                        >
                          <Plus size={16} /> New Sensor
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          ) : selectedMachine ? (
            <>
              {/* No templates - show simple list with ability to add sensors manually */}
              <p style={{ color: '#6b7280', marginBottom: '15px' }}>
                No sensor template defined for this machine type. Add sensors manually.
              </p>
              {selectedSensors.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th style={{ width: '20%' }}>Type</th>
                        <th style={{ width: '20%' }}>Location</th>
                        <th style={{ width: '40%' }}>Sensor Name</th>
                        <th style={{ width: '20%', position: 'sticky', right: 0, background: 'inherit' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSensors.map((item) => (
                        <tr key={item.sensor_id}>
                          <td style={{ width: '20%' }}>{getSensorTypeName(item.sensor.sensor_type_id)}</td>
                          <td style={{ width: '20%' }}>
                            <input
                              type="text"
                              value={item.sensor_location}
                              onChange={(e) => handleUpdateSensorLocation(item.sensor_id, e.target.value)}
                              className="form-control form-control-sm"
                              placeholder="Specify location"
                            />
                          </td>
                          <td style={{ width: '40%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.sensor.sensor_is_online ? (
                                <Wifi size={14} className="status-online" />
                              ) : (
                                <WifiOff size={14} className="status-offline" />
                              )}
                              <strong>{item.sensor.sensor_name}</strong>
                              {item.has_measurements && (
                                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500', marginLeft: '8px' }}>
                                  (Has {item.measurement_count} measurements)
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ width: '20%', position: 'sticky', right: 0, background: 'white' }}>
                            <div className="action-buttons">
                              <button
                                type="button"
                                onClick={() => handleIdentifySensor(item.sensor)}
                                disabled={!item.sensor.sensor_is_online || testStatus === 'running'}
                                className="btn btn-primary btn-sm"
                                title={testStatus === 'running' ? 'Cannot identify while test is running' : 'Identify'}
                              >
                                <Crosshair size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSensor(item.sensor_id)}
                                disabled={testStatus === 'running' || item.has_measurements}
                                className="btn btn-danger btn-sm"
                                title={item.has_measurements ? 'Cannot remove sensor with measurements' : testStatus === 'running' ? 'Cannot remove sensor while test is running' : 'Remove'}
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
              ) : (
                <div className="table-empty">
                  <div className="table-empty-icon">📋</div>
                  No sensors selected yet.
                </div>
              )}
              
              {/* Add sensor controls - both existing and new */}
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                    Add Existing Sensor:
                  </label>
                  <select
                    className="form-control"
                    onChange={(e) => {
                      handleSelectOtherSensor(e.target.value);
                      e.target.value = ''; // Reset dropdown
                    }}
                    disabled={testStatus === 'running'}
                    value=""
                    title={testStatus === 'running' ? 'Cannot add sensors while test is running' : ''}
                  >
                    <option value="">Select a sensor...</option>
                    {getAvailableOtherSensors().map(sensor => (
                      <option key={sensor.id} value={sensor.id}>
                        {sensor.sensor_name} ({getSensorTypeName(sensor.sensor_type_id)}) {!sensor.sensor_is_online && '- Offline'}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenSensorModal(null, null)}
                  disabled={testStatus === 'running'}
                  className="btn btn-secondary"
                  title={testStatus === 'running' ? 'Cannot add sensors while test is running' : 'Create a new sensor'}
                >
                  <Plus size={16} /> New Sensor
                </button>
              </div>
            </>
          ) : (
            <div className="table-empty">
              <div className="table-empty-icon">🏭</div>
              Please select a machine first.
            </div>
          )}
        </div>
      </div>

      {/* Sensor Modal */}
      {showSensorModal && (
        <SensorModal
          sensor={null}
          onClose={() => {
            setShowSensorModal(false);
            setModalSensorType(null);
            setModalTemplateIndex(null);
          }}
          onSave={handleSensorModalSave}
        />
      )}
    </div>
  );
};

export default NewTest;