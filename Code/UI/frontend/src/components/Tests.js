import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { testsAPI } from '../api';
import { Plus, Edit, Square, Eye, Play, Search, Filter, X, Calendar, Clock } from 'lucide-react';

const Tests = () => {
  const [tests, setTests] = useState([]);
  const [filteredTests, setFilteredTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, running, completed
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [sortField, setSortField] = useState('test_created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const response = await testsAPI.getAll();
      setTests(response.data);
      setFilteredTests(response.data);
    } catch (error) {
      console.error('Error loading tests:', error);
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

      return matchesSearch && matchesStatus && matchesDate;
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
  }, [tests, searchTerm, statusFilter, dateFilter, sortField, sortDirection]);

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
        await testsAPI.stop(testId);
        loadTests();
      } catch (error) {
        console.error('Error stopping test:', error);
        alert('Error stopping test');
      }
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
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading tests...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '10px'
        }}>
          Test Management
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', fontWeight: '500' }}>
          Monitor and manage your washing machine tests
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Play size={28} style={{ color: '#667eea' }} />
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '20px' }}>
                Test Sessions
              </h2>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                {filteredTests.filter(t => t.test_status === 'running').length} running tests
                {tests.length !== filteredTests.length && ` (${tests.length} total)`}
              </p>
            </div>
          </div>
          <Link 
            to="/tests/new"
            className="btn btn-primary" 
            style={{ 
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none'
            }}
          >
            <Plus size={18} />
            New Test
          </Link>
        </div>

        {/* Filter Controls */}
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: '250px' }}>
              <Search size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="text"
                placeholder="Search tests..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  paddingLeft: '40px',
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="idle">Idle</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                className="form-control"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={clearFilters}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={14} />
                Clear Filters
              </button>
            )}
          </div>
          
          <div style={{
            marginTop: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#6b7280',
            fontWeight: '500'
          }}>
            <Filter size={14} />
            <span>Showing {filteredTests.length} of {tests.length} tests</span>
          </div>
        </div>

        {tests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No tests found. Create your first test to get started.</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No tests match your current filters.</p>
            <button onClick={clearFilters} className="btn btn-secondary">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="table-container">
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
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {test.test_description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status ${getStatusColor(test.test_status)}`}>
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
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <Link
                          to={`/tests/edit/${test.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <Edit size={14} />
                        </Link>
                        {test.test_status === 'running' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleStopTest(test.id)}
                          >
                            <Square size={14} />
                          </button>
                        )}
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