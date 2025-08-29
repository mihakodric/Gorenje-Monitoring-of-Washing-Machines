import React from 'react';

const WashingMachines = () => {
  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '10px'
        }}>
          Washing Machines
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', fontWeight: '500' }}>
          Manage your washing machines
        </p>
        </div>
    </div>
  );
}

export default WashingMachines;