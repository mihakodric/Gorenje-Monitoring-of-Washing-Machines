// Sensor color palette - shared across all visualizations
export const SENSOR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
];

// Segment color palette - used for shaded areas on plots
export const SEGMENT_TRANSPARENCY_FILL = 0.10;
export const SEGMENT_TRANSPARENCY_BORDER = 0.7;
export const SEGMENT_COLORS = [
  `rgba(59, 130, 246, ${SEGMENT_TRANSPARENCY_FILL})`,   // blue
  `rgba(239, 68, 68, ${SEGMENT_TRANSPARENCY_FILL})`,    // red
  `rgba(16, 185, 129, ${SEGMENT_TRANSPARENCY_FILL})`,   // green
  `rgba(245, 158, 11, ${SEGMENT_TRANSPARENCY_FILL})`,   // orange
  `rgba(139, 92, 246, ${SEGMENT_TRANSPARENCY_FILL})`,   // purple
  `rgba(236, 72, 153, ${SEGMENT_TRANSPARENCY_FILL})`,   // pink
];

// Helper function to convert hex to rgba
export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
