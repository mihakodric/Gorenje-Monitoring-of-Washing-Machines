import axios from 'axios';
import { version } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Sensors API
const sensorsAPIprefix = '/api/sensors';
export const sensorsAPI = {
  getAll: () => api.get(sensorsAPIprefix),
  getById: (id) => api.get(`${sensorsAPIprefix}/${id}`),
  create: (sensor) => api.post(sensorsAPIprefix, sensor),
  update: (id, sensor) => api.put(`${sensorsAPIprefix}/${id}`, sensor),
  delete: (id) => api.delete(`${sensorsAPIprefix}/${id}`),
  identify: (sensor_mqtt_topic) => api.post(`${sensorsAPIprefix}/identify`, { sensor_mqtt_topic }),
  requestConfig: (id) => api.post(`${sensorsAPIprefix}/${id}/request-config`),
  updateConfig: (id, config, restart = true) => api.post(`${sensorsAPIprefix}/${id}/update-config`, { config, restart }),
  isActive: (id) => api.get(`${sensorsAPIprefix}/${id}/is-active`),
};

// Sensor Types API
const sensorTypesAPIprefix = '/api/sensor-types';
export const sensorTypesAPI = {
  getAll: () => api.get(sensorTypesAPIprefix),
  getById: (id) => api.get(`${sensorTypesAPIprefix}/${id}`),
  create: (sensorType) => api.post(sensorTypesAPIprefix, sensorType),
  update: (id, sensorType) => api.put(`${sensorTypesAPIprefix}/${id}`, sensorType),
  delete: (id) => api.delete(`${sensorTypesAPIprefix}/${id}`),
};

// Machines API
const machinesAPIprefix = '/api/machines';
export const machinesAPI = {
  getAll: () => api.get(machinesAPIprefix),
  getById: (id) => api.get(`${machinesAPIprefix}/${id}`),
  create: (machine) => api.post(machinesAPIprefix, machine),
  update: (id, machine) => api.put(`${machinesAPIprefix}/${id}`, machine),
  delete: (id) => api.delete(`${machinesAPIprefix}/${id}`),
};

// Machine Types API
const machineTypesAPIprefix = '/api/machine-types';
export const machineTypesAPI = {
  getAll: () => api.get(machineTypesAPIprefix),
  getById: (id) => api.get(`${machineTypesAPIprefix}/${id}`),
  create: (machineType) => api.post(machineTypesAPIprefix, machineType),
  update: (id, machineType) => api.put(`${machineTypesAPIprefix}/${id}`, machineType),
  delete: (id) => api.delete(`${machineTypesAPIprefix}/${id}`),

  // Sensor Templates for Machine Types
  getTemplates: (machineTypeId) => api.get(`${machineTypesAPIprefix}/${machineTypeId}/templates`),
  createTemplate: (machineTypeId, template) => api.post(`${machineTypesAPIprefix}/${machineTypeId}/templates`, template),
  updateTemplate: (templateId, template) => api.put(`${machineTypesAPIprefix}/templates/${templateId}`, template),
  deleteTemplate: (templateId) => api.delete(`${machineTypesAPIprefix}/templates/${templateId}`),
  reorderTemplates: (machineTypeId, orderUpdates) => api.post(`${machineTypesAPIprefix}/${machineTypeId}/templates/reorder`, orderUpdates),
};

// Tests API
const testsAPIprefix = '/api/tests';
export const testsAPI = {
  getAll: () => api.get(testsAPIprefix),
  getById: (id) => api.get(`${testsAPIprefix}/${id}`),
  create: (test) => api.post(testsAPIprefix, test),
  update: (id, test) => api.put(`${testsAPIprefix}/${id}`, test),
  delete: (id) => api.delete(`${testsAPIprefix}/${id}`),

  start: (id) => api.post(`${testsAPIprefix}/${id}/start`),
  stop: (id) => api.post(`${testsAPIprefix}/${id}/stop`),

  // Extended methods for NewTest component
  getWithRelations: async (testId) => {
    const [testResponse, relationsResponse] = await Promise.all([
      api.get(`${testsAPIprefix}/${testId}`),
      testRelationsAPI.getByTestId(testId)
    ]);
    return {
      data: {
        ...testResponse.data,
        relations: relationsResponse.data
      }
    };
  },

  createWithRelations: async (payload) => {
    // Create test with machine_id included, filtering out null/undefined values
    const testData = {};

    // Add test fields, filtering out null/undefined/empty values
    Object.keys(payload.test).forEach(key => {
      const value = payload.test[key];
      if (value !== null && value !== undefined && value !== '') {
        testData[key] = value;
      }
    });

    // Add machine_id
    testData.machine_id = payload.machine_id;

    // Validate required fields
    if (!testData.test_name) {
      throw new Error('Test name is required');
    }

    console.log('Creating test with data:', testData); // Debug log
    const testResponse = await api.post(testsAPIprefix, testData);
    const testId = testResponse.data.id;

    if (payload.sensors && payload.sensors.length > 0) {
      const relations = payload.sensors.map(sensor => ({
        test_id: testId,
        sensor_id: sensor.sensor_id,
        sensor_location: sensor.sensor_location || ''
      }));
      await testRelationsAPI.create(relations);
    }

    return testResponse;
  },

  updateRelations: async (testId, payload) => {
    // Update test with machine_id if provided
    if (payload.machine_id !== undefined) {
      await api.put(`${testsAPIprefix}/${testId}`, { machine_id: payload.machine_id });
    }

    // Delete existing relations
    await testRelationsAPI.deleteAllByTestId(testId);

    // Add new relations
    if (payload.sensors && payload.sensors.length > 0) {
      const relations = payload.sensors.map(sensor => ({
        test_id: testId,
        sensor_id: sensor.sensor_id,
        sensor_location: sensor.sensor_location || ''
      }));
      await testRelationsAPI.create(relations);
    }
  },

  getSummary: (testName) => api.get(`${testsAPIprefix}/${testName}/summary`),
  getData: (testName, params) => api.get(`${testsAPIprefix}/${testName}/data`, { params }),
};

// Test Relations API
const testRelationsAPIprefix = '/api/test-relations';
export const testRelationsAPI = {
  getByTestId: (testId) => api.get(`${testRelationsAPIprefix}/${testId}`),
  create: (relations) => api.post(testRelationsAPIprefix, relations),
  checkMeasurements: (relationId) => api.get(`${testRelationsAPIprefix}/${relationId}/check-measurements`),
  deleteSingle: (id, force = false) => api.delete(`${testRelationsAPIprefix}/${id}`, { params: { force } }),
  deleteAllByTestId: (testId) => api.delete(`${testRelationsAPIprefix}/test/${testId}`),
  update: (relationId, data) => api.put(`${testRelationsAPIprefix}/${relationId}`, data),
};


// Measurements API
const measurementsAPIprefix = '/api/measurements';
export const measurementsAPI = {
  getSensorDataAvg: (testRelationId, params = {}) =>
    api.get(`${measurementsAPIprefix}/avg/${testRelationId}`, { params }),
  getSensorDataRaw: (testRelationId, params = {}) =>
    api.get(`${measurementsAPIprefix}/raw/${testRelationId}`, { params }),
  cropMeasurements: (testId, startTime, endTime) =>
    api.post(`${measurementsAPIprefix}/crop`, {
      test_id: testId,
      start_time: startTime,
      end_time: endTime
    }),
  exportMeasurements: (params) =>
    api.post(`${measurementsAPIprefix}/export`, params),
  getExportStatus: (jobId) =>
    api.get(`${measurementsAPIprefix}/export/status/${jobId}`),
  downloadExport: (jobId) =>
    api.get(`${measurementsAPIprefix}/export/download/${jobId}`, { responseType: 'blob' }),
};

// Test Segments API
const testSegmentsAPIprefix = '/api/test-segments';
export const testSegmentsAPI = {
  getByTestId: (testId) => api.get(`${testSegmentsAPIprefix}/test/${testId}`),
  getById: (segmentId) => api.get(`${testSegmentsAPIprefix}/${segmentId}`),
  create: (segment) => api.post(testSegmentsAPIprefix, segment),
  update: (segmentId, segment) => api.put(`${testSegmentsAPIprefix}/${segmentId}`, segment),
  delete: (segmentId) => api.delete(`${testSegmentsAPIprefix}/${segmentId}`),
};

// MQTT API
const mqttAPIprefix = '/api/mqtt';
export const mqttAPI = {
  config: () => api.get(`${mqttAPIprefix}/config`),
  setConfig: (config) => api.post(`${mqttAPIprefix}/config`, config),
};

// System API
export const systemAPI = {
  status: () => api.get('/api/status'),
  health: () => api.get('/api/health'),
  version: () => api.get('/api/version'),
};

export default api;
