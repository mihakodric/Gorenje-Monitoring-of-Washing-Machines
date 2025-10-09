import React, { useState, useEffect } from 'react';
import { sensorsAPI } from '../api';
import { X } from 'lucide-react';

const SensorModal = ({ sensor, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    sensor_id: '', // This will be the MQTT ID that user defines
    sensor_name: '',
    sensor_type: '',
    description: ''
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
        sensor_id: sensor.sensor_id || '',
        sensor_name: sensor.sensor_name || '',
        sensor_type: sensor.sensor_type || (sensorTypes.length > 0 ? sensorTypes[0].mqtt_topic : ''),
        description: sensor.description || ''
      });
    } else if (sensorTypes.length > 0 && !formData.sensor_type) {
      setFormData(prev => ({
        ...prev,
        sensor_type: sensorTypes[0].mqtt_topic
      }));
    }
  }, [sensor, sensorTypes]);

  const loadSensorTypes = async () => {
    try {
      const response = await sensorsAPI.getTypes();
      setSensorTypes(response.data);
    } catch (error) {
      console.error('Error loading sensor types:', error);
      // Fallback to hardcoded types if API fails
      setSensorTypes([
        { mqtt_topic: 'acceleration', display_name: 'Acceleration' },
        { mqtt_topic: 'temperature', display_name: 'Temperature' },
        { mqtt_topic: 'distance', display_name: 'Distance' },
        { mqtt_topic: 'current', display_name: 'Current' },
        { mqtt_topic: 'water_flow', display_name: 'Water Flow' },
        { mqtt_topic: 'infrared', display_name: 'Infrared' }
      ]);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (sensor) {
        // Update existing sensor (only allow updating name and description)
        await sensorsAPI.update(sensor.sensor_id, {
          sensor_name: formData.sensor_name,
          description: formData.description
        });
      } else {
        // Create new sensor - backend will handle auto-generated fields
        const sensorData = {
          sensor_id: formData.sensor_id,
          sensor_name: formData.sensor_name,
          sensor_type: formData.sensor_type,
          description: formData.description
        };
        await sensorsAPI.create(sensorData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving sensor:', error);
      alert('Error saving sensor. Please check if MQTT ID already exists or all required fields are filled.');
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
            <label className="form-label">MQTT ID *</label>
            <input
              type="text"
              name="sensor_id"
              value={formData.sensor_id}
              onChange={handleChange}
              className="form-control"
              required
              disabled={!!sensor} // Disable editing sensor_id for existing sensors
              placeholder="e.g., acc1, temp2, dist1"
            />
            <small className="form-text text-muted">
              Unique identifier used in MQTT communication
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
                name="sensor_type"
                value={formData.sensor_type}
                onChange={handleChange}
                className="form-control"
                required
                disabled={!!sensor || loadingTypes} // Disable editing type for existing sensors or while loading
              >
                <option value="">Select sensor type...</option>
                {loadingTypes ? (
                  <option value="">Loading sensor types...</option>
                ) : (
                  sensorTypes.map(type => (
                    <option key={type.mqtt_topic} value={type.mqtt_topic}>
                      {type.display_name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              value={formData.description}
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
