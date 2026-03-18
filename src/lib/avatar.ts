/**
 * Dynamic Avatar Color System
 * Provides a palette of 50 consistent colors for users without profile pictures.
 * Colors are HSL-based to ensure a vibrant, premium look with good contrast for white text.
 */

const AVATAR_COLORS = [
  '#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE',
  '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40', '#D32F2F', '#C2185B', '#7B1FA2', '#512DA8',
  '#303F9F', '#1976D2', '#0288D1', '#0097A7', '#00796B', '#388E3C', '#689F38', '#AFB42B', '#FBC02D', '#FFA000',
  '#F57C00', '#E64A19', '#5D4037', '#616161', '#455A64', '#FF8A80', '#FF80AB', '#EA80FC', '#B388FF', '#8C9EFF',
  '#82B1FF', '#80D8FF', '#84FFFF', '#A7FFEB', '#B9F6CA', '#CCFF90', '#F4FF81', '#FFE57F', '#FFD180', '#FF9E80'
];

/**
 * Deterministically gets a color from the 50-color palette based on a string ID.
 */
export function getUserColor(id: string | undefined): string {
  if (!id) return AVATAR_COLORS[0];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Return color based on hash modulo 50
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
