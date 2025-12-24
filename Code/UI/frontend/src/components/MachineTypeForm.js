import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { machineTypesAPI, sensorTypesAPI } from '../api';
import { ArrowLeft, Save, Settings as SettingsIcon, Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';

const MachineTypeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [formData, setFormData] = useState({
    machine_type_name: '',
    machine_type_description: ''
  });
  
  // Sensor templates state
  const [sensorTemplates, setSensorTemplates] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [newTemplate, setNewTemplate] = useState({
    sensor_type_id: '',
    location: '',
    is_required: true
  });

  useEffect(() => {
    loadSensorTypes();
    if (isEditMode) {
      loadMachineType();
      loadSensorTemplates();
    }
  }, [id]);

  const loadSensorTypes = async () => {
    try {
      const response = await sensorTypesAPI.getAll();
      setSensorTypes(response.data || []);
    } catch (error) {
      console.error('Error loading sensor types:', error);
    }
  };

  const loadSensorTemplates = async () => {
    try {
      const response = await machineTypesAPI.getTemplates(id);
      setSensorTemplates(response.data || []);
    } catch (error) {
      console.error('Error loading sensor templates:', error);
    }
  };

  const loadMachineType = async () => {
    try {
      setLoading(true);
      const response = await machineTypesAPI.getById(id);
      setFormData({
        machine_type_name: response.data.machine_type_name,
        machine_type_description: response.data.machine_type_description || ''
      });
    } catch (error) {
      console.error('Error loading machine type:', error);
      alert('Error loading machine type. Redirecting back...');
      navigate('/settings');
    } finally {
      setLoading(false);
    }
  };

  // Sensor template handlers
  const handleAddTemplate = async () => {
    if (!newTemplate.sensor_type_id || !newTemplate.location.trim()) {
      alert('Please select a sensor type and enter a location');
      return;
    }

    if (!isEditMode) {
      // For new machine types, add to local state
      const sensorType = sensorTypes.find(st => st.id === parseInt(newTemplate.sensor_type_id));
      setSensorTemplates([...sensorTemplates, {
        ...newTemplate,
        sensor_type_name: sensorType?.sensor_type_name || '',
        sensor_type_unit: sensorType?.sensor_type_unit || '',
        display_order: sensorTemplates.length,
        isNew: true // Flag for unsaved templates
      }]);
      setNewTemplate({ sensor_type_id: '', location: '', is_required: true });
      return;
    }

    // For existing machine types, save to backend
    try {
      const templateData = {
        ...newTemplate,
        sensor_type_id: parseInt(newTemplate.sensor_type_id),
        display_order: sensorTemplates.length
      };
      const response = await machineTypesAPI.createTemplate(id, templateData);
      await loadSensorTemplates();
      setNewTemplate({ sensor_type_id: '', location: '', is_required: true });
    } catch (error) {
      console.error('Error adding sensor template:', error);
      let errorMessage = 'Error adding sensor template. This combination may already exist.';
      
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.detail) {
          errorMessage = JSON.stringify(error.response.data.detail);
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const handleDeleteTemplate = async (template, index) => {
    if (!window.confirm(`Remove ${template.sensor_type_name} at ${template.location}?`)) {
      return;
    }

    if (template.isNew || !isEditMode) {
      // Remove from local state
      setSensorTemplates(sensorTemplates.filter((_, i) => i !== index));
      return;
    }

    try {
      await machineTypesAPI.deleteTemplate(template.id);
      await loadSensorTemplates();
    } catch (error) {
      console.error('Error deleting sensor template:', error);
      alert('Error deleting sensor template');
    }
  };

  const handleToggleRequired = async (template, index) => {
    if (template.isNew || !isEditMode) {
      // Update local state
      const updated = [...sensorTemplates];
      updated[index] = { ...updated[index], is_required: !updated[index].is_required };
      setSensorTemplates(updated);
      return;
    }

    try {
      await machineTypesAPI.updateTemplate(template.id, {
        is_required: !template.is_required
      });
      await loadSensorTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Error updating template');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const reordered = Array.from(sensorTemplates);
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, removed);

    // Update display_order
    const updated = reordered.map((template, index) => ({
      ...template,
      display_order: index
    }));

    setSensorTemplates(updated);
    setDraggedIndex(null);

    // Save order if in edit mode
    if (isEditMode && !updated.some(t => t.isNew)) {
      try {
        const orderUpdates = updated.map(t => ({
          id: t.id,
          display_order: t.display_order
        }));
        await machineTypesAPI.reorderTemplates(id, orderUpdates);
      } catch (error) {
        console.error('Error saving template order:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.machine_type_name.trim()) {
      alert('Please enter a machine type name');
      return;
    }

    try {
      setSaving(true);
      
      if (isEditMode) {
        await machineTypesAPI.update(id, formData);
      } else {
        // Create machine type first
        const response = await machineTypesAPI.create(formData);
        const newMachineTypeId = response.data.machine_type.id;
        
        // Then create all sensor templates
        for (const template of sensorTemplates) {
          try {
            await machineTypesAPI.createTemplate(newMachineTypeId, {
              sensor_type_id: parseInt(template.sensor_type_id),
              location: template.location,
              is_required: template.is_required,
              display_order: template.display_order
            });
          } catch (error) {
            console.error('Error creating template:', error);
          }
        }
      }
      
      navigate('/settings');
    } catch (error) {
      console.error('Error saving machine type:', error);
      alert('Error saving machine type. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading machine type...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={handleCancel}
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">
              {isEditMode ? 'Edit Machine Type' : 'Add New Machine Type'}
            </h1>
            <p className="page-subtitle">
              {isEditMode 
                ? 'Update the machine type details' 
                : 'Create a new machine type for washing machines'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <SettingsIcon size={28} style={{ color: '#667eea' }} />
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '20px' }}>
                Machine Type Information
              </h2>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Enter the basic information for this machine type
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              
              {/* Machine Type Name */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  Machine Type Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.machine_type_name}
                  onChange={(e) => setFormData({...formData, machine_type_name: e.target.value})}
                  placeholder="e.g., Front Load Washer, Top Load Washer, Commercial Washer"
                  required
                  style={{ fontSize: '14px' }}
                />
                <p style={{ 
                  marginTop: '5px', 
                  fontSize: '13px', 
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  A clear, descriptive name for this type of washing machine
                </p>
              </div>

              {/* Description */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  Description
                </label>
                <textarea
                  className="form-control"
                  value={formData.machine_type_description}
                  onChange={(e) => setFormData({...formData, machine_type_description: e.target.value})}
                  rows="6"
                  placeholder="Describe the characteristics, features, and specifications of this machine type..."
                  style={{ fontSize: '14px', resize: 'vertical' }}
                />
                <p style={{ 
                  marginTop: '5px', 
                  fontSize: '13px', 
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  Optional: Provide details about the machine type's capabilities, capacity, or typical use cases
                </p>
              </div>

              {/* Future: Sensor Type Associations */}
              <div style={{
                marginTop: '30px',
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <h3 style={{ 
                  margin: '0 0 10px 0', 
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Sensor Configuration Template
                </h3>
                <p style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '14px', 
                  color: '#6b7280'
                }}>
                  Define which sensor types should be used for this machine type and where they should be placed.
                </p>

                {/* Add New Template Form */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto auto auto',
                  gap: '10px',
                  alignItems: 'end',
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '5px', 
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Sensor Type *
                    </label>
                    <select
                      className="form-control"
                      value={newTemplate.sensor_type_id}
                      onChange={(e) => setNewTemplate({...newTemplate, sensor_type_id: e.target.value})}
                      style={{ fontSize: '14px' }}
                    >
                      <option value="">Select sensor type...</option>
                      {sensorTypes.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.sensor_type_name} {st.sensor_type_unit && `(${st.sensor_type_unit})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '5px', 
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Location *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTemplate.location}
                      onChange={(e) => setNewTemplate({...newTemplate, location: e.target.value})}
                      placeholder="e.g., Drum, Motor, Water Inlet"
                      style={{ fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ paddingTop: '20px' }}>
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={newTemplate.is_required}
                        onChange={(e) => setNewTemplate({...newTemplate, is_required: e.target.checked})}
                      />
                      Required
                    </label>
                  </div>

                  <div style={{ paddingTop: '20px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleAddTemplate}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Plus size={16} />
                      Add Sensor
                    </button>
                  </div>
                </div>

                {/* Sensor Templates Table */}
                {sensorTemplates.length > 0 ? (
                  <div style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', width: '40px' }}>
                            Order
                          </th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>
                            Sensor Type
                          </th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>
                            Location
                          </th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', width: '100px' }}>
                            Required
                          </th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#6b7280', width: '80px' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sensorTemplates.map((template, index) => (
                          <tr
                            key={template.id || index}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(index)}
                            style={{
                              borderBottom: '1px solid #e5e7eb',
                              cursor: 'move',
                              backgroundColor: draggedIndex === index ? '#f3f4f6' : 'white'
                            }}
                          >
                            <td style={{ padding: '12px', fontSize: '14px' }}>
                              <GripVertical size={16} style={{ color: '#9ca3af' }} />
                            </td>
                            <td style={{ padding: '12px', fontSize: '14px' }}>
                              <strong>{template.sensor_type_name}</strong>
                              {template.sensor_type_unit && (
                                <span style={{ color: '#6b7280', marginLeft: '5px' }}>
                                  ({template.sensor_type_unit})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                              {template.location}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={template.is_required}
                                onChange={() => handleToggleRequired(template, index)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteTemplate(template, index)}
                                style={{ padding: '5px 8px' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px dashed #d1d5db',
                    color: '#6b7280'
                  }}>
                    <AlertCircle size={24} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      No sensors configured yet. Add sensor types above to create a template.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Form Actions */}
          <div style={{
            padding: '20px 30px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !formData.machine_type_name.trim()}
            >
              <Save size={16} />
              {saving ? 'Saving...' : (isEditMode ? 'Update Machine Type' : 'Create Machine Type')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MachineTypeForm;
