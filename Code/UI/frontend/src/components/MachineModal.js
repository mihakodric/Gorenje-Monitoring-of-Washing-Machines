import React, { useState, useEffect } from "react";
import { washingMachinesAPI as machinesAPI } from "../api";
import { X } from "lucide-react";

const MachineModal = ({ machine, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    machine_name: "",
    description: "",
    machine_type_id: 1,
  });
  const [loading, setLoading] = useState(false);
  const [machineTypes, setMachineTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);


useEffect(() => {
  loadMachineTypes();
}, []);

useEffect(() => {
  if (machine) {
    setFormData({
      machine_name: machine.machine_name || "",
      description: machine.description || "",
      machine_type_id: machine.machine_type_id || (machineTypes.length > 0 ? machineTypes[0].id : 1),
    });
  } else if (machineTypes.length > 0) {
    setFormData(prev => ({
      ...prev,
      machine_type_id: machineTypes[0].id
    }));
  }
}, [machine, machineTypes]);

const loadMachineTypes = async () => {
  try {
    const response = await machinesAPI.getTypes();
    setMachineTypes(response.data);
  } catch (error) {
    console.error('Error loading machine types:', error);
    // Fallback to hardcoded types if API fails
    setMachineTypes([
      { id: 1, display_name: 'Washing Machine' },
      { id: 2, display_name: 'Dishwasher' }
    ]);
  } finally {
    setLoadingTypes(false);
  }
};


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'machine_type_id' ? parseInt(value, 10) : value,
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let machineName;
      if (machine) {
        // Update existing machine
        await machinesAPI.update(machine.machine_name, {
          description: formData.description,
          machine_type_id: formData.machine_type_id,
        });
        machineName = machine.machine_name;
      } else {
        // Create new machine
        const res = await machinesAPI.create(formData);
        machineName = formData.machine_name;
      }
      onSave();
    } catch (error) {
      console.error("Error saving washing machine:", error);
      alert("Error saving machine. Please check if Name already exists.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {machine ? "Edit Machine" : "Add New Machine"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Machine Name *</label>
            <input
              type="text"
              name="machine_name"
              value={formData.machine_name}
              onChange={handleChange}
              className="form-control"
              required
              disabled={!!machine} // cannot edit Name once created
              placeholder="e.g., Main Washing Machine, Kitchen Dishwasher"
            />
          </div>

          {/* Machine Type */}
          <div className="form-group">
            <label className="form-label">Machine Type *</label>
            <select
              name="machine_type_id"
              value={formData.machine_type_id}
              onChange={handleChange}
              className="form-control"
              required
              disabled={loadingTypes}
            >
              {loadingTypes ? (
                <option value="">Loading machine types...</option>
              ) : (
                machineTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.display_name}
                  </option>
                ))
              )}
            </select>
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
              placeholder="Enter machine description..."
            />
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

export default MachineModal;
