const SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'rating', 'name'];
const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

function toInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function toPrice(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toSort(value) {
  return SORT_OPTIONS.includes(value) ? value : 'relevance';
}

function toSlug(value) {
  return typeof value === 'string' && SLUG_PATTERN.test(value) ? value : null;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

module.exports = { toInt, toPrice, toSort, toSlug, cleanText };
