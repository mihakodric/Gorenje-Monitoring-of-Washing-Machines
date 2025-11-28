import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { testsAPI, machinesAPI, machineTypesAPI } from '../api';
import { Plus, Edit, Square, Eye, Play, Search, Filter, X, Calendar, Clock, Trash2 } from 'lucide-react';

const Tests = () => {
  const [tests, setTests] = useState([]);
  const [filteredTests, setFilteredTests] = useState([]);
  const [machines, setMachines] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, running, completed
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [machineFilter, setMachineFilter] = useState('all'); // all, specific machine name
  const [machineTypeFilter, setMachineTypeFilter] = useState('all'); // all, specific machine type
  const [sortField, setSortField] = useState('test_created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [testsResponse, machinesResponse, machineTypesResponse] = await Promise.all([
        testsAPI.getAll(),
        machinesAPI.getAll(),
        machineTypesAPI.getAll()
      ]);
      
      setTests(testsResponse.data);
      setFilteredTests(testsResponse.data);
      setMachines(machinesResponse.data);
      setMachineTypes(machineTypesResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };



  // Filter and sort function
  const filterAndSortTests = () => {
    let filtered = tests.filter(test => {
      const matchesSearch = searchTerm === '' || 
        test.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.test_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.machine_type_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.id.toString().includes(searchTerm);
      
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = test.test_status === statusFilter;
      }

      let matchesDate = true;
      if (dateFilter !== 'all' && test.test_created_at) {
        const testDate = new Date(test.test_created_at);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateFilter === 'today') {
          matchesDate = testDate >= today;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = testDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
          matchesDate = testDate >= monthAgo;
        }
      }

      let matchesMachine = true;
      if (machineFilter !== 'all') {
        matchesMachine = test.machine_name === machineFilter;
      }

      let matchesMachineType = true;
      if (machineTypeFilter !== 'all') {
        matchesMachineType = test.machine_type_name === machineTypeFilter;
      }

      return matchesSearch && matchesStatus && matchesDate && matchesMachine && matchesMachineType;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle dates
      if (sortField === 'test_created_at' || sortField === 'test_last_modified_at') {
        aValue = aValue ? new Date(aValue) : new Date(0);
        bValue = bValue ? new Date(bValue) : new Date(0);
      }
      
      // Handle strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      // Handle numbers
      if (sortField === 'test_sensor_count' || sortField === 'test_data_points') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }
      
      let result = 0;
      if (aValue < bValue) result = -1;
      if (aValue > bValue) result = 1;
      
      return sortDirection === 'desc' ? -result : result;
    });

    setFilteredTests(filtered);
  };

  // Apply filters when dependencies change
  useEffect(() => {
    filterAndSortTests();
  }, [tests, searchTerm, statusFilter, dateFilter, machineFilter, machineTypeFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setMachineFilter('all');
    setMachineTypeFilter('all');
    setSortField('test_created_at');
    setSortDirection('desc');
  };

  // Remove the old modal-based edit functionality
  // const handleEditTest = (test) => {
  //   setEditingTest(test);
  //   setShowModal(true);
  // };

  const handleStopTest = async (testId) => {
    if (window.confirm('Are you sure you want to stop this test?')) {
      try {
        await testsAPI.update(testId, { test_status: 'idle' });
        loadData();
      } catch (error) {
        console.error('Error stopping test:', error);
        alert('Failed to stop test');
      }
    }
  };

  const handleDeleteTest = async (testId, testName, testStatus) => {
    if (testStatus !== 'idle') {
      alert(`Cannot delete test "${testName}":\nTest must be in idle status.\nCurrent status: ${testStatus}`);
      return;
    }

    const confirmMessage = `⚠️ DELETE TEST: "${testName}"\n\n` +
      `This will permanently delete:\n` +
      `• The test and all its configuration\n` +
      `• All test relations (sensor assignments)\n` +
      `• All test runs\n` +
      `• All measurement data (raw and aggregated)\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type the test name to confirm deletion:`;

    const userInput = window.prompt(confirmMessage);
    
    if (userInput === null) {
      return; // User cancelled
    }

    if (userInput.trim() !== testName) {
      alert('Test name does not match. Deletion cancelled.');
      return;
    }

    try {
      await testsAPI.delete(testId);
      alert(`✅ Test "${testName}" and all related data deleted successfully.`);
      loadData();
    } catch (error) {
      console.error('Error deleting test:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`❌ Failed to delete test:\n${errorMessage}`);
    }
  };



  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'idle': return 'status-inactive';
      case 'failed': return 'status-error';
      default: return 'status-inactive';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span className="loading-text">Loading tests...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Test Management
          </h1>
          <p className="page-subtitle">
            Monitor and manage your washing machine tests
          </p>
        </div>
        <Link to="/tests/new" className="btn btn-primary">
          <Plus size={16} />
          Create New Test
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex-center gap-15">
            <Play size={28} style={{ color: '#667eea' }} />
            <div>
              <h2 className="card-title">Test Sessions</h2>
              <p className="card-subtitle">
                {filteredTests.filter(t => t.test_status === 'running').length} running tests
                {tests.length !== filteredTests.length && ` (${tests.length} total)`}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="filter-section">
          {/* Search */}
          <div className="form-group">
            <div className="search-container">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search tests, machines..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="form-group">
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="idle">Idle</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Machine Type Filter */}
          <div className="form-group">
            <select
              className="form-control"
              value={machineTypeFilter}
              onChange={(e) => setMachineTypeFilter(e.target.value)}
            >
              <option value="all">All Machine Types</option>
              {machineTypes.map((type) => (
                <option key={type.id} value={type.machine_type_name}>
                  {type.machine_type_name}
                </option>
              ))}
            </select>
          </div>

          {/* Machine Filter */}
          <div className="form-group">
            <select
              className="form-control"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
            >
              <option value="all">All Machines</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.machine_name}>
                  {machine.machine_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="form-group">
            <select
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all' || machineFilter !== 'all' || machineTypeFilter !== 'all') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear
            </button>
          )}

          {/* Results count */}
          <div className="filter-count">
            Showing {filteredTests.length} of {tests.length} tests
          </div>
        </div>

        {tests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Square size={48} />
            </div>
            <p>No tests found. Create your first test to get started.</p>
            <Link to="/tests/new" className="btn btn-primary">
              <Plus size={16} />
              Create First Test
            </Link>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Filter size={48} />
            </div>
            <p>No tests match your current filters.</p>
            <button onClick={clearFilters} className="btn btn-secondary">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('test_name')}
                    className={`sortable ${sortField === 'test_name' ? 'sorted' : ''}`}
                  >
                    Test Name
                    {sortField === 'test_name' && (
                      <span className={`sort-indicator ${sortDirection}`}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th 
                    onClick={() => handleSort('machine_name')}
                    className={`sortable ${sortField === 'machine_name' ? 'sorted' : ''}`}
                  >
                    Machine
                    {sortField === 'machine_name' && (
                      <span className={`sort-indicator ${sortDirection}`}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th 
                    onClick={() => handleSort('machine_type_name')}
                    className={`sortable ${sortField === 'machine_type_name' ? 'sorted' : ''}`}
                  >
                    Machine Type
                    {sortField === 'machine_type_name' && (
                      <span className={`sort-indicator ${sortDirection}`}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th 
                    onClick={() => handleSort('test_status')}
                    className={`sortable ${sortField === 'test_status' ? 'sorted' : ''}`}
                  >
                    Status
                    {sortField === 'test_status' && (
                      <span className={`sort-indicator ${sortDirection}`}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th 
                    onClick={() => handleSort('test_created_at')}
                    className={`sortable ${sortField === 'test_created_at' ? 'sorted' : ''}`}
                  >
                    Created
                    {sortField === 'test_created_at' && (
                      <span className={`sort-indicator ${sortDirection}`}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th 
                    onClick={() => handleSort('test_sensor_count')}
                    className={`sortable ${sortField === 'test_sensor_count' ? 'sorted' : ''}`}
                  >
                    Sensors
                    {sortField === 'test_sensor_count' && (
                      <span className={`sort-indicator ${sortDirection}`}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test) => (
                  <tr key={test.id}>
                    <td>
                      <strong>{test.test_name}</strong>
                      {test.test_description && (
                        <div className="text-small text-secondary">
                          {test.test_description}
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{test.machine_name || 'N/A'}</strong>
                      {test.machine_description && (
                        <div className="text-small text-secondary">
                          {test.machine_description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-secondary">
                        {test.machine_type_name || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-card ${getStatusColor(test.test_status)}`}>
                        {test.test_status === 'running' ? <Play size={12} /> : null}
                        {test.test_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {new Date(test.test_created_at).toLocaleString()}
                    </td>
                    <td>
                      <strong>{test.test_sensor_count || 0}</strong>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Link
                          to={`/tests/overview/${test.id}`}
                          className="btn btn-primary btn-sm"
                          title="View Test Overview"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          to={`/tests/edit/${test.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Edit Test"
                        >
                          <Edit size={14} />
                        </Link>
                        {test.test_status === 'running' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleStopTest(test.id)}
                            title="Stop Test"
                          >
                            <Square size={14} />
                          </button>
                        )}
                        <button
                          className={`btn btn-sm ${test.test_status === 'idle' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleDeleteTest(test.id, test.test_name, test.test_status)}
                          disabled={test.test_status !== 'idle'}
                          title={test.test_status === 'idle' ? 'Delete Test' : `Cannot delete - test is ${test.test_status}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Tests;