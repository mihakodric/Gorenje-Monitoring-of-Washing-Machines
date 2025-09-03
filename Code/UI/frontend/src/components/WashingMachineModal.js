import React, { useState, useEffect } from "react";
import { washingMachinesAPI, sensorsAPI } from "../api";
import { X } from "lucide-react";

const WashingMachineModal = ({ machine, sensors, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    machine_id: "",
    name: "",
    description: "",
  });
  const [selectedSensorIds, setSelectedSensorIds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (machine) {
      setFormData({
        machine_id: machine.machine_id || "",
        name: machine.name || "",
        description: machine.description || "",
      });
      // Preselect sensors connected to this machine
      setSelectedSensorIds(
        sensors
          .filter(sensor => sensor.machine_id === machine.machine_id)
          .map(sensor => sensor.sensor_id)
      );
    } else {
      setFormData({
        machine_id: "",
        name: "",
        description: "",
      });
      setSelectedSensorIds([]);
    }
  }, [machine, sensors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSensorSelect = (e) => {
    const options = Array.from(e.target.selectedOptions);
    setSelectedSensorIds(options.map(opt => opt.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let machineId;
      if (machine) {
        // Update existing machine
        await washingMachinesAPI.update(machine.machine_id, {
          name: formData.name,
          description: formData.description,
        });
        machineId = machine.machine_id;
      } else {
        // Create new machine
        const res = await washingMachinesAPI.create(formData);
        machineId = formData.machine_id;
      }
      // Update sensors' machine_id
      await Promise.all(
        sensors.map(sensor => {
          // If sensor is selected, assign to machine; else, clear assignment if it was previously assigned
          if (selectedSensorIds.includes(sensor.sensor_id)) {
            if (sensor.machine_id !== machineId) {
              return sensorsAPI.update(sensor.sensor_id, { ...sensor, machine_id: machineId });
            }
          } else {
            if (sensor.machine_id === machineId) {
              return sensorsAPI.update(sensor.sensor_id, { ...sensor, machine_id: null });
            }
          }
          return null;
        })
      );
      onSave();
    } catch (error) {
      console.error("Error saving washing machine:", error);
      alert("Error saving washing machine. Please check if ID already exists.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {machine ? "Edit Washing Machine" : "Add New Washing Machine"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ID */}
          <div className="form-group">
            <label className="form-label">Machine ID *</label>
            <input
              type="text"
              name="machine_id"
              value={formData.machine_id}
              onChange={handleChange}
              className="form-control"
              required
              disabled={!!machine} // cannot edit ID once created
              placeholder="e.g., wm1, wm2"
            />
          </div>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control"
              required
              placeholder="e.g., Main Washing Machine"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Enter washing machine description..."
            />
          </div>

          {/* Connected Sensors */}
          <div className="form-group">
            <label className="form-label">Connected Sensors</label>
            <select
              multiple
              className="form-control"
              value={selectedSensorIds}
              onChange={handleSensorSelect}
              style={{ minHeight: "120px" }}
            >
              {sensors.map(sensor => (
                <option key={sensor.sensor_id} value={sensor.sensor_id}>
                  {sensor.name} ({sensor.sensor_id})
                </option>
              ))}
            </select>
            <small>Select sensors to connect to this machine.</small>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? "Saving..."
                : machine
                ? "Update"
                : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WashingMachineModal;
