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
      <div>
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading machines...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "10px",
          }}
        >
          Machines
        </h1>
        <p style={{ color: "#6b7280", fontSize: "16px", fontWeight: "500" }}>
          Manage all your machines (washing machines, dishwashers, etc.)
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <Activity size={28} style={{ color: "#667eea" }} />
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: "20px" }}>
                Machine List
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#6b7280",
                  fontWeight: "500",
                }}
              >
                {filteredMachines.length} of {machines.length} machines showing
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAddMachine}
            style={{
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            <Plus size={18} />
            Add New Machine
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: "20px",
            borderBottom: "2px solid #f0f2f5",
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            borderRadius: "12px 12px 0 0",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "15px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", minWidth: "250px" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                }}
              />
              <input
                type="text"
                placeholder="Search machines..."
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  paddingLeft: "40px",
                  fontSize: "14px",
                  border: "2px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
            </div>

            {/* Clear Filters */}
            {searchTerm && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={clearFilters}
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <X size={14} />
                Clear Filters
              </button>
            )}

            {/* Results count */}
            <div
              style={{
                marginLeft: "auto",
                fontSize: "14px",
                color: "#6b7280",
                fontWeight: "500",
              }}
            >
              Showing {filteredMachines.length} of {machines.length} machines
            </div>
          </div>
        </div>

        {machines.length === 0 ? (
          <div className="text-center" style={{ padding: "60px 40px" }}>
            <Activity
              size={64}
              style={{ color: "#d1d5db", marginBottom: "20px" }}
            />
            <h3 style={{ color: "#4b5563", marginBottom: "10px" }}>
              No Machines Found
            </h3>
            <p style={{ color: "#9ca3af", marginBottom: "25px" }}>
              Get started by adding your first machine.
            </p>
            <button className="btn btn-primary" onClick={handleAddMachine}>
              <Plus size={18} />
              Add Your First Machine
            </button>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="text-center" style={{ padding: "60px 40px" }}>
            <Filter
              size={64}
              style={{ color: "#d1d5db", marginBottom: "20px" }}
            />
            <h3 style={{ color: "#4b5563", marginBottom: "10px" }}>
              No Matching Machines
            </h3>
            <p style={{ color: "#9ca3af", marginBottom: "25px" }}>
              No machines match your current filters. Try adjusting your
              search criteria.
            </p>
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={18} />
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("name")}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      Machine Details
                      {sortField === "name" && (
                        <span style={{ fontSize: "12px" }}>
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
                      <div>
                        <div
                          style={{
                            fontWeight: "1000",
                            color: "#374151",
                            fontSize: "14px",
                          }}
                        >
                          {machine.machine_name}
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "13px",
                            color: "#6b7280",
                          }}
                        >
                          {machine.machine_description || "No description"}
                        </div>
                      </div>
                    </td>
                    <td>{getMachineTypeName(machine.machine_type_id)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditMachine(machine)}
                          title="Edit machine"
                          style={{
                            padding: "8px 12px",
                            minWidth: "auto",
                          }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteMachine(machine.id)}
                          title="Delete machine"
                          style={{
                            padding: "8px 12px",
                            minWidth: "auto",
                          }}
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
