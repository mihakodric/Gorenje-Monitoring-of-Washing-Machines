import React, { useState, useEffect } from 'react';
import { sensorsAPI } from '../api';
import { X } from 'lucide-react';

const SensorModal = ({ sensor, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    sensor_id: '',
    sensor_name: '',
    sensor_type: 'acceleration',
    description: '',
    location: '',
    mqtt_topic: '',
    is_online: true
  });
  const [loading, setLoading] = useState(false);

  const sensorTypes = [
    'acceleration',
    'temperature',
    'distance',
    'current',
    'water_flow',
    'infrared'
  ];

  const mqttTopics = [
    'acceleration',
    'temperature',
    'distance',
    'current',
    'water_flow',
    'infrared'
  ];

  useEffect(() => {
    if (sensor) {
      setFormData({
        sensor_id: sensor.sensor_id || '',
        sensor_name: sensor.sensor_name || '',
        sensor_type: sensor.sensor_type || 'acceleration',
        description: sensor.description || '',
        location: sensor.location || '',
        mqtt_topic: sensor.mqtt_topic || '',
        is_online: sensor.is_online !== undefined ? sensor.is_online : true
      });
    }
  }, [sensor]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (sensor) {
        // Update existing sensor
        await sensorsAPI.update(sensor.sensor_id, {
          sensor_name: formData.sensor_name,
          description: formData.description,
          location: formData.location,
          is_online: formData.is_online
        });
      } else {
        // Create new sensor
        await sensorsAPI.create(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving sensor:', error);
      alert('Error saving sensor. Please check if sensor ID already exists.');
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
            <label className="form-label">Sensor ID *</label>
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name *</label>
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
                disabled={!!sensor} // Disable editing type for existing sensors
              >
                {sensorTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g., Machine body, Water inlet"
              />
            </div>

            <div className="form-group">
              <label className="form-label">MQTT Topic *</label>
              <select
                name="mqtt_topic"
                value={formData.mqtt_topic}
                onChange={handleChange}
                className="form-control"
                required
                disabled={!!sensor} // Disable editing topic for existing sensors
              >
                {mqttTopics.map(topic => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
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

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                name="is_online"
                checked={formData.is_online}
                onChange={handleChange}
                style={{ marginRight: '8px' }}
              />
              Online
            </label>
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
