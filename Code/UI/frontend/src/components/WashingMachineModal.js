import React, { useState, useEffect } from "react";
import { washingMachinesAPI } from "../api";
import { X } from "lucide-react";

const WashingMachineModal = ({ machine, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (machine) {
      setFormData({
        id: machine.id || "",
        name: machine.name || "",
        description: machine.description || "",
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
      if (machine) {
        // Update existing machine
        await washingMachinesAPI.update(machine.id, {
          name: formData.name,
          description: formData.description,
        });
      } else {
        // Create new machine
        await washingMachinesAPI.create(formData);
      }
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
              name="id"
              value={formData.id}
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
