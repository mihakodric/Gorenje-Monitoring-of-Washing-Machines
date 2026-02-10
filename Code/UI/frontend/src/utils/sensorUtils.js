import { sensorsAPI } from '../api';
import { toast } from './toast';

/**
 * Identify a sensor by sending MQTT command to blink its LED
 * @param {Object} sensor - Sensor object with sensor_name and sensor_mqtt_topic
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export const identifySensor = async (sensor) => {
  if (!sensor?.sensor_mqtt_topic) {
    console.error('Sensor MQTT topic is required');
    return false;
  }
  
  try {
    console.log(`Identifying sensor: ${sensor.sensor_name} (${sensor.sensor_mqtt_topic}/cmd/identify)`);
    await sensorsAPI.identify(sensor.sensor_mqtt_topic);
    toast.success(`Identify command sent to sensor: ${sensor.sensor_name}. LED should blink now.`, 4000);
    return true;
  } catch (error) {
    console.error('Error sending identify command:', error);
    toast.error(`Failed to send identify command: ${error.response?.data?.detail || error.message}`, 5000);
    return false;
  }
};
