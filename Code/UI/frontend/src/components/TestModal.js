import React, { useState, useEffect } from 'react';
import { testsAPI } from '../api';
import { X } from 'lucide-react';

const TestModal = ({ test, machines, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    test_name: '',
    test_description: '',
    test_notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (test) {
      setFormData({
        test_name: test.test_name || '',
        test_description: test.test_description || '',
        test_notes: test.test_notes || ''
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
        await testsAPI.update(test.id, {
          test_name: formData.test_name,
          test_description: formData.test_description,
          test_notes: formData.test_notes
        });
      } else {
        // Create new test
        await testsAPI.create({
          test_name: formData.test_name,
          test_description: formData.test_description,
          test_notes: formData.test_notes
        });
      }
      onSave();
    } catch (error) {
      console.error('Error saving test:', error);
      if (error.response?.data?.detail) {
        alert(`Error saving test: ${error.response.data.detail}`);
      } else {
        alert('Error saving test. Please check if test name already exists.');
      }
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

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="test_description"
              value={formData.test_description}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Describe what this test is measuring..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="test_notes"
              value={formData.test_notes}
              onChange={handleChange}
              className="form-control"
              rows={3}
              placeholder="Additional notes or observations..."
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
