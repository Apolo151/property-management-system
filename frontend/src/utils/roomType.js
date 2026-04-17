export const normalizeRootRoomType = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

export const formatRootRoomType = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';

  const trimmed = value.trim();
  const splitCamelCase = trimmed
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim();

  return splitCamelCase
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
