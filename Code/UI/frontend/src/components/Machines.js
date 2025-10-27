import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Activity, Search, X, Filter } from "lucide-react";
import { machinesAPI, machineTypesAPI } from "../api";
import MachineModal from "./MachineModal";

const Machines = () => {
  const [machines, setMachines] = useState([]);
  const [filteredMachines, setFilteredMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);

  const [machineTypes, setMachineTypes] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    loadMachinesAndMachineTypes();
  }, []);

  useEffect(() => {
    filterAndSortMachines();
  }, [machines, searchTerm, sortField, sortDirection]);

  const loadMachinesAndMachineTypes = async () => {

    let machineData = [];
    let machineTypesData = [];
  
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        machinesAPI.getAll(),
        machineTypesAPI.getAll()
      ]);

      machineData = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
      machineTypesData = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];

      setMachines(machineData);
      setMachineTypes(machineTypesData);
      } catch (error) {
      console.error("Error loading machines:", error);
    } finally {
      setLoading(false);

      console.log("Loaded machines:", machineData);
      console.log("Loaded machine types:", machineTypesData);
    }
  };


  const filterAndSortMachines = () => {
    let filtered = machines.filter(machine => {
      // Search filter
      const matchesSearch =
        String(machine.machine_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(machine.machine_description || "").toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue = String(a[sortField] || "").toLowerCase();
      let bValue = String(b[sortField] || "").toLowerCase();

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredMachines(filtered);
  };


  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSortField("name");
    setSortDirection("asc");
  };

  const handleAddMachine = () => {
    setEditingMachine(null);
    setShowModal(true);
  };

  const handleEditMachine = (machine) => {
    setEditingMachine(machine);
    setShowModal(true);
  };

  const handleDeleteMachine = async (machineId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this machine? This action cannot be undone."
      )
    ) {
      try {
        await machinesAPI.delete(machineId);
        loadMachinesAndMachineTypes();
      } catch (error) {
        console.error("Error deleting machine:", error);
        alert("Error deleting machine. Please try again.");
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingMachine(null);
  };

  const handleModalSave = () => {
    setShowModal(false);
    setEditingMachine(null);
    loadMachinesAndMachineTypes();
  };

  const getMachineTypeName = (machineTypeId) => {
    const type = machineTypes.find(type => type.id === machineTypeId);
    return type ? type.machine_type_name : 'Unknown Type';
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading machines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          Machines
        </h1>
        <p className="page-subtitle">
          Manage all your machines (washing machines, dishwashers, etc.)
        </p>
      </div>

      <div className="card no-padding">
        <div className="card-header">
          <div className="card-title">
            <Activity size={28} className="text-primary" />
            <div>
              <h2>Machine List</h2>
              <p className="card-subtitle">
                {filteredMachines.length} of {machines.length} machines showing
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAddMachine}
          >
            <Plus size={18} />
            Add New Machine
          </button>
        </div>

        <div className="card-body">
          {/* Filters */}
          <div className="filter-section">
          {/* Search */}
          <div className="form-group">
            <div className="search-container">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search machines..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {searchTerm && (
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
            Showing {filteredMachines.length} of {machines.length} machines
          </div>
          </div>

          {machines.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon">🏭</div>
            <h3>No Machines Found</h3>
            <p>Get started by adding your first machine.</p>
            <button className="btn btn-primary" onClick={handleAddMachine}>
              <Plus size={18} />
              Add Your First Machine
            </button>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="table-empty">
            <div className="table-empty-icon">🔍</div>
            <h3>No Matching Machines</h3>
            <p>No machines match your current filters. Try adjusting your search criteria.</p>
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={18} />
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th
                    className="sortable"
                    onClick={() => handleSort("name")}
                  >
                    <div className="sort-header">
                      Machine Details
                      {sortField === "name" && (
                        <span className="sort-indicator">
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th>Machine Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMachines.map((machine) => (
                  <tr key={machine.id}>
                    <td>
                      <div className="machine-card">
                        <div className="machine-icon">
                          <Activity size={20} />
                        </div>
                        <div className="machine-content">
                          <div className="machine-name">
                            {machine.machine_name}
                          </div>
                          <div className="machine-description">
                            {machine.machine_description || "No description"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge">
                        {getMachineTypeName(machine.machine_type_id)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditMachine(machine)}
                          title="Edit machine"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteMachine(machine.id)}
                          title="Delete machine"
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

      {showModal && (
        <MachineModal
          machine={editingMachine}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default Machines;
