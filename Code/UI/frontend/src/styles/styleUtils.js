// =================================
// STYLE UTILITIES
// =================================

/**
 * Common style objects that can be reused across components
 */

// Layout Styles
export const layoutStyles = {
  container: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  
  containerSmall: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  
  flexCenter: {
    display: 'flex',
    alignItems: 'center'
  },
  
  flexBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  
  flexColumn: {
    display: 'flex',
    flexDirection: 'column'
  },
  
  grid2Col: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '30px'
  }
};

// Button Styles
export const buttonStyles = {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  
  primary: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },
  
  secondary: {
    backgroundColor: '#6b7280',
    color: 'white'
  },
  
  small: {
    padding: '6px 12px',
    fontSize: '12px'
  }
};

// Form Styles
export const formStyles = {
  group: {
    marginBottom: '20px'
  },
  
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#374151'
  },
  
  control: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginTop: '5px',
    fontSize: '12px',
    color: '#ef4444'
  }
};

// Card Styles
export const cardStyles = {
  base: {
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },
  
  header: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb'
  },
  
  body: {
    padding: '20px'
  },
  
  selection: {
    background: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    padding: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  
  selectionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff'
  }
};

// Header Styles
export const headerStyles = {
  page: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e5e7eb'
  },
  
  title: {
    margin: 0,
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '24px',
    fontWeight: '600'
  },
  
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #e5e7eb'
  }
};

// Animation Styles
export const animationStyles = {
  spinner: {
    width: '12px',
    height: '12px',
    border: '2px solid #f3f3f3',
    borderTop: '2px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  
  autoSaveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: '#666',
    fontSize: '14px',
    fontStyle: 'italic'
  }
};

// Status Styles
export const statusStyles = {
  online: {
    backgroundColor: '#dcfdf7',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  
  offline: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  }
};

/**
 * Utility functions for style manipulation
 */

// Combine multiple style objects
export const combineStyles = (...styles) => {
  return Object.assign({}, ...styles);
};

// Create responsive styles
export const createResponsiveStyle = (desktop, mobile) => {
  return window.innerWidth <= 768 ? mobile : desktop;
};

// Add conditional styles
export const conditionalStyle = (condition, trueStyle, falseStyle = {}) => {
  return condition ? trueStyle : falseStyle;
};

// Create hover styles (for styled-components or emotion)
export const createHoverStyle = (baseStyle, hoverStyle) => ({
  ...baseStyle,
  '&:hover': hoverStyle
});

/**
 * Common style combinations
 */
export const commonCombinations = {
  // Button with icon
  buttonWithIcon: combineStyles(buttonStyles.base, buttonStyles.primary, layoutStyles.flexCenter),
  
  // Form group with error
  formGroupWithError: (hasError) => combineStyles(
    formStyles.group,
    hasError ? { marginBottom: '10px' } : {}
  ),
  
  // Card with selection state
  selectableCard: (isSelected) => combineStyles(
    cardStyles.selection,
    isSelected ? cardStyles.selectionSelected : {}
  ),
  
  // Page header with actions
  pageHeaderWithActions: combineStyles(headerStyles.page, layoutStyles.flexBetween)
};

export default {
  layoutStyles,
  buttonStyles,
  formStyles,
  cardStyles,
  headerStyles,
  animationStyles,
  statusStyles,
  combineStyles,
  conditionalStyle,
  commonCombinations
};