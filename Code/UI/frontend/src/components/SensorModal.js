import React, { useState, useEffect } from 'react';
import { sensorsAPI, sensorTypesAPI } from '../api';
import { X } from 'lucide-react';

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

  useEffect(() => {
    loadSensorTypes();
  }, []);

  useEffect(() => {
    if (sensor) {
      setFormData({
        sensor_mqtt_topic: sensor.sensor_mqtt_topic || '',
        sensor_name: sensor.sensor_name || '',
        sensor_type_id: sensor.sensor_type_id || '',
        sensor_description: sensor.sensor_description || ''
      });
    } else if (sensorTypes.length > 0) {
      setFormData(prev => ({
        ...prev,
        sensor_type_id: prev.sensor_type_id || sensorTypes[0].id
      }));
    }
  }, [sensor, sensorTypes]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (sensor) {
        // Update existing sensor - include sensor type in update
        await sensorsAPI.update(sensor.id, {
          sensor_name: formData.sensor_name,
          sensor_type_id: parseInt(formData.sensor_type_id),
          sensor_description: formData.sensor_description
        });
      } else {
        // Create new sensor - include all required fields
        const sensorData = {
          sensor_mqtt_topic: formData.sensor_mqtt_topic,
          sensor_name: formData.sensor_name,
          sensor_type_id: parseInt(formData.sensor_type_id),
          sensor_description: formData.sensor_description,
          sensor_is_online: false
        };
        await sensorsAPI.create(sensorData);
      }
      onSave();
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
              placeholder="e.g., sensors/acceleration/1, sensors/temperature/kitchen"
            />
            <small className="form-text text-muted">
              Unique MQTT topic for this sensor
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
                disabled={loadingTypes} // Disable editing type for existing sensors or while loading
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
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (sensor ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SensorModal;
