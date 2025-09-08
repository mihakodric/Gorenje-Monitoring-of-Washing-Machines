import React, { useState, useEffect } from 'react';
import { testsAPI } from '../api';
import { X } from 'lucide-react';

const TestModal = ({ test, machines, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    test_name: '',
    description: '',
    status: 'running',
    created_by: 'user',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (test) {
      setFormData({
        test_name: test.test_name || '',
        description: test.description || '',
        status: test.status || 'running',
        created_by: test.created_by || 'user',
        notes: test.notes || ''
      });
    }
  }, [test]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (test) {
        // Update existing test
        await testsAPI.update(test.test_name, {
          description: formData.description,
          machine_name: formData.machine_name,
          status: formData.status,
          notes: formData.notes,
          end_time: formData.status === 'completed' ? new Date().toISOString() : null
        });
      } else {
        // Create new test
        await testsAPI.create(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Error saving test. Please check if test name already exists.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {test ? 'Edit Test' : 'Create New Test'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Test Name *</label>
            <input
              type="text"
              name="test_name"
              value={formData.test_name}
              onChange={handleChange}
              className="form-control"
              required
              disabled={!!test} // Disable editing test name for existing tests
              placeholder="e.g., wash_cycle_test_1"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Machine name</label>
              <select
                name="machine_name"
                value={formData.machine_name}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="">Select machine...</option>
                {machines.map(machine => (
                  <option key={machine.machine_name} value={machine.machine_name}>
                    {machine.machine_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="form-control"
              >
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Describe what this test is measuring..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Additional notes or observations..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Created By</label>
            <input
              type="text"
              name="created_by"
              value={formData.created_by}
              onChange={handleChange}
              className="form-control"
              placeholder="user"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (test ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestModal;
