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
  getTypes: () => api.get('/api/sensor-types'),
};

// Tests API
export const testsAPI = {
  getAll: () => api.get('/api/tests'),
  getById: (id) => api.get(`/api/tests/${id}`),
  create: (test) => api.post('/api/tests', test),
  createWithRelations: (testData) => api.post('/api/tests/create-with-relations', testData),
  getWithRelations: (id) => api.get(`/api/tests/${id}/with-relations`),
  update: (id, test) => api.put(`/api/tests/${id}`, test),
  updateRelations: (id, relationsData) => api.put(`/api/tests/${id}/relations`, relationsData),
  start: (id) => api.post(`/api/tests/${id}/start`),
  stop: (id) => api.post(`/api/tests/${id}/stop`),
  delete: (id) => api.delete(`/api/tests/${id}`),
  getData: (id, params = {}) => api.get(`/api/tests/${id}/data`, { params }),
  getSummary: (id) => api.get(`/api/tests/${id}/summary`),
  
  // Relations
  getRelations: (id) => api.get(`/api/tests/${id}/relations`),
  addRelation: (id, relation) => api.post(`/api/tests/${id}/relations`, relation),
  deleteRelation: (testId, relationId) => api.delete(`/api/tests/${testId}/relations/${relationId}`),
};

// Washing machines API
export const washingMachinesAPI = {
  getAll: () => api.get('/api/machines'),
  getById: (name) => api.get(`/api/machines/${name}`),
  create: (machine) => api.post('/api/machines', machine),
  update: (name, machine) => api.put(`/api/machines/${name}`, machine),
  delete: (name) => api.delete(`/api/machines/${name}`),
  getTypes: () => api.get('/api/machine-types'),
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
  // MQTT Configuration (Single config)
  getMqttConfig: () => api.get('/api/settings/mqtt-config'),
  createMqttConfig: (config) => api.post('/api/settings/mqtt-config', config),
  updateMqttConfig: (config) => api.put('/api/settings/mqtt-config', config),
  
  // Sensor Types
  getSensorTypes: () => api.get('/api/settings/sensor-types'),
  createSensorType: (sensorType) => api.post('/api/settings/sensor-types', sensorType),
  updateSensorType: (id, sensorType) => api.put(`/api/settings/sensor-types/${id}`, sensorType),
  deleteSensorType: (id) => api.delete(`/api/settings/sensor-types/${id}`),
  
  // Machine Types
  getMachineTypes: () => api.get('/api/settings/machine-types'),
  createMachineType: (machineType) => api.post('/api/settings/machine-types', machineType),
  updateMachineType: (id, machineType) => api.put(`/api/settings/machine-types/${id}`, machineType),
  deleteMachineType: (id) => api.delete(`/api/settings/machine-types/${id}`),
};

export default api;
