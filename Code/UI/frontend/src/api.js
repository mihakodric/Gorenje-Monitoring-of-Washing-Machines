import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Sensors API
export const sensorsAPI = {
  getAll: () => api.get('/api/sensors'),
  getById: (id) => api.get(`/api/sensors/${id}`),
  create: (sensor) => api.post('/api/sensors', sensor),
  update: (id, sensor) => api.put(`/api/sensors/${id}`, sensor),
  delete: (id) => api.delete(`/api/sensors/${id}`),
};

// Tests API
export const testsAPI = {
  getAll: () => api.get('/api/tests'),
  getById: (name) => api.get(`/api/tests/${name}`),
  create: (test) => api.post('/api/tests', test),
  update: (name, test) => api.put(`/api/tests/${name}`, test),
  stop: (name) => api.post(`/api/tests/${name}/stop`),
  getData: (name, params = {}) => api.get(`/api/tests/${name}/data`, { params }),
  getSummary: (name) => api.get(`/api/tests/${name}/summary`),
};

// Washing machines API
export const washingMachinesAPI = {
  getAll: () => api.get('/api/machines'),
  getById: (name) => api.get(`/api/machines/${name}`),
  create: (machine) => api.post('/api/machines', machine),
  update: (name, machine) => api.put(`/api/machines/${name}`, machine),
  delete: (name) => api.delete(`/api/machines/${name}`),
};

// MQTT API
export const mqttAPI = {
  start: () => api.post('/api/mqtt/start'),
  stop: () => api.post('/api/mqtt/stop'),
  status: () => api.get('/api/mqtt/status'),
};

// System API
export const systemAPI = {
  status: () => api.get('/api/status'),
};

// Settings API
export const settingsAPI = {
  // MQTT Configurations
  getMqttConfigs: () => api.get('/api/settings/mqtt-configs'),
  createMqttConfig: (config) => api.post('/api/settings/mqtt-configs', config),
  updateMqttConfig: (id, config) => api.put(`/api/settings/mqtt-configs/${id}`, config),
  deleteMqttConfig: (id) => api.delete(`/api/settings/mqtt-configs/${id}`),
  
  // Sensor Types
  getSensorTypes: () => api.get('/api/settings/sensor-types'),
  createSensorType: (sensorType) => api.post('/api/settings/sensor-types', sensorType),
  updateSensorType: (id, sensorType) => api.put(`/api/settings/sensor-types/${id}`, sensorType),
  deleteSensorType: (id) => api.delete(`/api/settings/sensor-types/${id}`),
};

export default api;
