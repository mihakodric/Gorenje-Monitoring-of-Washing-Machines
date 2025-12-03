import React, { useState, useEffect } from 'react';
import { sensorsAPI, sensorTypesAPI } from '../api';
import { X, RefreshCw } from 'lucide-react';

const SensorModal = ({ sensor, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    sensor_mqtt_topic: '', // This will be the MQTT topic that user defines
    sensor_name: '',
    sensor_type_id: '',
    sensor_description: ''
  });
  const [loading, setLoading] = useState(false);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [sensorSettings, setSensorSettings] = useState({});
  const [isActive, setIsActive] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [settingsError, setSettingsError] = useState(null);

  useEffect(() => {
    loadSensorTypes();
    if (sensor) {
      loadSensorData();
    }
  }, []);

  useEffect(() => {
    if (sensor) {
      setFormData({
        sensor_mqtt_topic: sensor.sensor_mqtt_topic || '',
        sensor_name: sensor.sensor_name || '',
        sensor_type_id: sensor.sensor_type_id || '',
        sensor_description: sensor.sensor_description || ''
      });
      setSensorSettings(sensor.sensor_settings || {});
      // Set isActive from sensor data (can be either is_active or sensor_is_active)
      setIsActive(sensor.is_active || sensor.sensor_is_active || false);
    } else if (sensorTypes.length > 0) {
      setFormData(prev => ({
        ...prev,
        sensor_type_id: prev.sensor_type_id || sensorTypes[0].id
      }));
    }
  }, [sensor, sensorTypes]);

  const loadSensorData = async () => {
    if (!sensor?.id) return;
    
    try {
      // Fetch fresh sensor data to get latest is_active status
      const sensorResponse = await sensorsAPI.getById(sensor.id);
      setIsActive(sensorResponse.data.sensor_is_active || false);
    } catch (error) {
      console.error('Error loading sensor active status:', error);
    }
  };

  const loadSensorTypes = async () => {
    try {
      const response = await sensorTypesAPI.getAll();
      setSensorTypes(response.data);
    } catch (error) {
      console.error('Error loading sensor types:', error);
      // Fallback to empty array if API fails
      setSensorTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'sensor_type_id' ? value : value
    }));
  };

  const handleSettingChange = (key, value) => {
    setSensorSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRequestConfig = async () => {
    if (!sensor?.id) return;
    
    setLoadingConfig(true);
    setSettingsError(null);
    
    try {
      await sensorsAPI.requestConfig(sensor.id);
      
      // Wait a bit for the config to be received and stored
      setTimeout(async () => {
        try {
          const response = await sensorsAPI.getById(sensor.id);
          setSensorSettings(response.data.sensor_settings || {});
          setSettingsError(null);
        } catch (error) {
          setSettingsError('Config received but failed to fetch updated settings');
        } finally {
          setLoadingConfig(false);
        }
      }, 2000);
    } catch (error) {
      setSettingsError(error.response?.data?.detail || 'Failed to request config');
      setLoadingConfig(false);
    }
  };

  const detectSettingType = (value) => {
    if (Number.isInteger(value)) return 'int';
    if (typeof value === 'number') return 'float';
    return 'text';
  };

  const parseSettingValue = (value, type) => {
    if (type === 'int') return parseInt(value, 10);
    if (type === 'float') return parseFloat(value);
    return value;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSettingsError(null);

    try {
      if (sensor) {
        // Check if settings changed and sensor is online
        const settingsChanged = JSON.stringify(sensor.sensor_settings) !== JSON.stringify(sensorSettings);
        const hasSettings = Object.keys(sensorSettings).length > 0;
        
        // Update existing sensor - include sensor type and settings
        await sensorsAPI.update(sensor.id, {
          sensor_name: formData.sensor_name,
          sensor_type_id: parseInt(formData.sensor_type_id),
          sensor_description: formData.sensor_description,
          sensor_settings: sensorSettings
        });
        
        // If settings changed and sensor is online, send update to device
        if (settingsChanged && hasSettings && sensor.sensor_is_online) {
          try {
            await sensorsAPI.updateConfig(sensor.id, sensorSettings, true);
            
            // Wait for device to process and publish config
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Request config to verify update
            await sensorsAPI.requestConfig(sensor.id);
            
            // Wait for config to be received and stored
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fetch and verify the updated settings
            const verifyResponse = await sensorsAPI.getById(sensor.id);
            const updatedSettings = verifyResponse.data.sensor_settings;
            
            // Check if settings match
            const settingsMatch = JSON.stringify(sensorSettings) === JSON.stringify(updatedSettings);
            
            if (!settingsMatch) {
              setSettingsError('Warning: Settings saved to database but device may not have applied all changes. Please verify device configuration.');
            }
          } catch (mqttError) {
            console.error('Error sending config to device:', mqttError);
            setSettingsError('Settings saved to database but failed to send to device: ' + (mqttError.response?.data?.detail || mqttError.message));
            // Still consider it a partial success since DB was updated
          }
        }
        
        if (!settingsError) {
          onSave();
        }
      } else {
        // Create new sensor - include all required fields
        const sensorData = {
          sensor_mqtt_topic: formData.sensor_mqtt_topic,
          sensor_name: formData.sensor_name,
          sensor_type_id: parseInt(formData.sensor_type_id),
          sensor_description: formData.sensor_description,
          sensor_is_online: false,
          sensor_settings: sensorSettings
        };
        await sensorsAPI.create(sensorData);
        onSave();
      }
    } catch (error) {
      console.error('Error saving sensor:', error);
      alert('Error saving sensor. Please check if MQTT topic already exists or all required fields are filled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {sensor ? 'Edit Sensor' : 'Add New Sensor'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">MQTT Topic *</label>
            <input
              type="text"
              name="sensor_mqtt_topic"
              value={formData.sensor_mqtt_topic}
              onChange={handleChange}
              className="form-control"
              required
              disabled={sensor ? true : false}
              placeholder="e.g., infra_1, temp_2, accel_3"
            />
            <small className="form-text text-muted">
              Unique MQTT topic for this sensor {sensor ? '(cannot be changed)' : ''}
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sensor Name *</label>
              <input
                type="text"
                name="sensor_name"
                value={formData.sensor_name}
                onChange={handleChange}
                className="form-control"
                required
                disabled={isActive}
                placeholder="e.g., Main Accelerometer"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sensor Type *</label>
              <select
                name="sensor_type_id"
                value={formData.sensor_type_id}
                onChange={handleChange}
                className="form-control"
                required
                disabled={loadingTypes || isActive}
              >
                <option value="">Select sensor type...</option>
                {loadingTypes ? (
                  <option value="">Loading sensor types...</option>
                ) : (
                  sensorTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.sensor_type_name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="sensor_description"
              value={formData.sensor_description}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Enter sensor description..."
              disabled={isActive}
            />
          </div>

          {sensor && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label className="form-label">Sensor Settings</label>
                {sensor.sensor_is_online && (
                  <button
                    type="button"
                    onClick={handleRequestConfig}
                    disabled={loadingConfig || isActive}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={14} className={loadingConfig ? 'spinning' : ''} />
                    {loadingConfig ? 'Requesting...' : 'Request Config'}
                  </button>
                )}
              </div>
              
              {settingsError && (
                <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '10px' }}>
                  {settingsError}
                </div>
              )}
              
              {!sensor.sensor_is_online && (
                <div style={{ padding: '10px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '10px' }}>
                  Sensor is offline. Settings cannot be loaded or edited.
                </div>
              )}
              
              {isActive && (
                <div style={{ padding: '10px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '10px' }}>
                  Sensor is active in a test. Settings cannot be edited.
                </div>
              )}
              
              {Object.keys(sensorSettings).length === 0 ? (
                <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px', color: '#6c757d', textAlign: 'center' }}>
                  No settings available. {sensor.sensor_is_online && !isActive ? 'Click "Request Config" to load settings from the sensor.' : ''}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {Object.entries(sensorSettings).map(([key, value]) => {
                    const settingType = detectSettingType(value);
                    return (
                      <div key={key} className="form-group" style={{ marginBottom: '0' }}>
                        <label className="form-label" style={{ fontSize: '0.9em', marginBottom: '5px' }}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        <input
                          type="number"
                          step={settingType === 'float' ? 'any' : '1'}
                          value={value}
                          onChange={(e) => handleSettingChange(key, parseSettingValue(e.target.value, settingType))}
                          className="form-control"
                          disabled={!sensor.sensor_is_online || isActive}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || isActive}>
              {loading ? 'Saving...' : (sensor ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SensorModal;
