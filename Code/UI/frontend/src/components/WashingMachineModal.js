import React, { useState, useEffect } from "react";
import { washingMachinesAPI} from "../api";
import { X } from "lucide-react";

const WashingMachineModal = ({ machine, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    machine_name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);


useEffect(() => {
  if (machine) {
    setFormData({
      machine_name: machine.machine_name || "",
      description: machine.description || "",
    });
  } else {
    setFormData({
      machine_name: "",
      description: "",
    });
  }
}, [machine]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let machineName;
      if (machine) {
        // Update existing machine
        await washingMachinesAPI.update(machine.machine_name, {
          description: formData.description,
        });
        machineName = machine.machine_name;
      } else {
        // Create new machine
        const res = await washingMachinesAPI.create(formData);
        machineName = formData.machine_name;
      }
      onSave();
    } catch (error) {
      console.error("Error saving washing machine:", error);
      alert("Error saving washing machine. Please check if Name already exists.");
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
