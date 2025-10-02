import React, { useState } from "react";
import { Wifi, Cpu, Edit, Trash2, Plus, X, Check } from "lucide-react";

const Settings1 = () => {
  // ---- State za MQTT ----
  const [mqttForm, setMqttForm] = useState({
    ip: "192.168.1.100",
    port: "1883",
  });
  const [showMqttModal, setShowMqttModal] = useState(false);

  // ---- State za Sensor Types ----
  const [sensorTypes, setSensorTypes] = useState([
    { name: "infrared", display_name: "Infrared Sensor", default_topic: "infrared", unit: "RPM", description: "Detects presence or position using infrared" },
    { name: "water_flow", display_name: "Water Flow Sensor", default_topic: "water_flow", unit: "L/min", description: "Measures water flow rate" },
    { name: "current", display_name: "Current Sensor", default_topic: "current", unit: "A", description: "Measures electrical current consumption" },
    { name: "distance", display_name: "Distance/Ultrasonic Sensor", default_topic: "distance", unit: "cm", description: "Measures distance or water level" },
    { name: "temperature", display_name: "Temperature Sensor", default_topic: "temperature", unit: "°C", description: "Measures temperature of water or ambient" },
    { name: "acceleration", display_name: "Accelerometer", default_topic: "acceleration", unit: "g", description: "Measures vibration and movement acceleration" },
  ]);

  const [showSensorModal, setShowSensorModal] = useState(false);
  const [sensorForm, setSensorForm] = useState({ name: "", display_name: "", default_topic: "", unit: "", description: "" });
  const [editingSensor, setEditingSensor] = useState(null);

  // ---- Handlers ----
  const handleEditMqtt = () => setShowMqttModal(true);

  const handleSaveMqtt = () => {
    setShowMqttModal(false);
    // Tu lahko dodamo logiko za shranjevanje MQTT
  };

  const handleAddSensor = () => {
    setSensorForm({ name: "", display_name: "", default_topic: "", unit: "", description: "" });
    setEditingSensor(null);
    setShowSensorModal(true);
  };

  const handleEditSensor = (sensor) => {
    setSensorForm({ ...sensor });
    setEditingSensor(sensor.name);
    setShowSensorModal(true);
  };

  const handleSaveSensor = () => {
    if (editingSensor) {
      setSensorTypes(sensorTypes.map(s => s.name === editingSensor ? sensorForm : s));
    } else {
      setSensorTypes([...sensorTypes, sensorForm]);
    }
    setShowSensorModal(false);
  };

  const handleDeleteSensor = (name) => {
    setSensorTypes(sensorTypes.filter(s => s.name !== name));
  };

  return (
    <div style={{ padding: "30px" }}>
      {/* --- Glavni naslov --- */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "10px", fontSize: "28px", fontWeight: "bold" }}>
          System Settings
        </h1>
        <p style={{ color: "#6b7280", fontSize: "16px", fontWeight: "500" }}>
          Configure MQTT connections and sensor types
        </p>
      </div>

      {/* --- MQTT Config Kvadratek --- */}
      <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 8px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <Wifi size={32} color="#667eea" />
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>MQTT Configurations</h2>
              <p style={{ color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>Manage MQTT broker connections and topics</p>
            </div>
          </div>
          <button onClick={handleEditMqtt} style={{ background: "#e0e7ff", borderRadius: "6px", border: "none", cursor: "pointer", padding: "6px" }}>
            <Edit size={18} color="#667eea" />
          </button>
        </div>

        <hr style={{ margin: "15px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

        <div style={{ display: "flex", gap: "10px" }}>
          <span style={{ fontWeight: "500", minWidth: "100px" }}>IP Address:</span>
          <span style={{ color: "#374151" }}>{mqttForm.ip}</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <span style={{ fontWeight: "500", minWidth: "100px" }}>Port:</span>
          <span style={{ color: "#374151" }}>{mqttForm.port}</span>
        </div>
      </div>

      {/* --- Sensor Types Kvadratek --- */}
      <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <Cpu size={32} color="#764ba2" />
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Sensor Types</h2>
              <p style={{ color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>Define custom sensor types and configurations</p>
            </div>
          </div>
          <button onClick={handleAddSensor} style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", fontSize: "14px" }}>
            <Plus size={18} /> Add New
          </button>
        </div>

        <div style={{ marginTop: "15px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "12px" }}>Type Name</th>
                <th style={{ padding: "12px" }}>Display Name</th>
                <th style={{ padding: "12px" }}>Default Topic</th>
                <th style={{ padding: "12px" }}>Unit</th>
                <th style={{ padding: "12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sensorTypes.map(sensor => (
                <tr key={sensor.name} style={{ borderBottom: "1px solid #e5e7eb", height: "70px", backgroundColor: "#f9f9ff" }}>
                  <td style={{ padding: "12px" }}>
                    <strong>{sensor.name}</strong>
                    <div style={{ fontSize: "12px", color: "#666" }}>{sensor.description}</div>
                  </td>
                  <td style={{ padding: "12px" }}>{sensor.display_name}</td>
                  <td style={{ padding: "12px" }}>{sensor.default_topic}</td>
                  <td style={{ padding: "12px" }}>{sensor.unit}</td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button onClick={() => handleEditSensor(sensor)} style={{ background: "#e0e7ff", borderRadius: "6px", border: "none", cursor: "pointer", padding: "6px" }}>
                        <Edit size={18} color="#667eea" />
                      </button>
                      <button onClick={() => handleDeleteSensor(sensor.name)} style={{ background: "#fee2e2", borderRadius: "6px", border: "none", cursor: "pointer", padding: "6px" }}>
                        <Trash2 size={18} color="red" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MQTT Modal --- */}
      {showMqttModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "30px", width: "400px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <h3>Edit MQTT Config</h3>
            <label>IP Address:</label>
            <input type="text" value={mqttForm.ip} onChange={e => setMqttForm({...mqttForm, ip: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <label>Port:</label>
            <input type="number" value={mqttForm.port} onChange={e => setMqttForm({...mqttForm, port: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button onClick={() => setShowMqttModal(false)} style={{ background: "#fee2e2", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>Cancel <X size={16} /></button>
              <button onClick={handleSaveMqtt} style={{ background: "#667eea", color: "white", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>Save <Check size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* --- Sensor Modal --- */}
      {showSensorModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "30px", width: "500px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <h3>{editingSensor ? "Edit Sensor" : "Add Sensor"}</h3>
            <label>Type Name:</label>
            <input type="text" value={sensorForm.name} onChange={e => setSensorForm({...sensorForm, name: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <label>Display Name:</label>
            <input type="text" value={sensorForm.display_name} onChange={e => setSensorForm({...sensorForm, display_name: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <label>Default Topic:</label>
            <input type="text" value={sensorForm.default_topic} onChange={e => setSensorForm({...sensorForm, default_topic: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <label>Unit:</label>
            <input type="text" value={sensorForm.unit} onChange={e => setSensorForm({...sensorForm, unit: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <label>Description:</label>
            <textarea value={sensorForm.description} onChange={e => setSensorForm({...sensorForm, description: e.target.value})} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", minHeight: "60px" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button onClick={() => setShowSensorModal(false)} style={{ background: "#fee2e2", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>Cancel <X size={16} /></button>
              <button onClick={handleSaveSensor} style={{ background: "#667eea", color: "white", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>Save <Check size={16} /></button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings1;
