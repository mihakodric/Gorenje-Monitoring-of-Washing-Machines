import { sensorsAPI } from '../api';

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
    alert(`✅ Identify command sent to sensor:\n${sensor.sensor_name}\n\nThe sensor LED should blink now.`);
    return true;
  } catch (error) {
    console.error('Error sending identify command:', error);
    alert(`❌ Failed to send identify command:\n${error.response?.data?.detail || error.message}`);
    return false;
  }
};
