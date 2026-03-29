function pad2(num) {
  return String(num).padStart(2, '0');
}

function getTodayDate() {
  return formatDate(new Date());
}

function getCurrentTime() {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function formatDate(input) {
  const date = input instanceof Date ? input : new Date(input);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateDisplay(dateStr) {
  const date = new Date(dateStr.replace(/-/g, '/'));
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getStartOfWeek(baseDate) {
  const date = new Date(baseDate || new Date());
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(baseDate) {
  const start = getStartOfWeek(baseDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfMonth(baseDate) {
  const date = new Date(baseDate || new Date());
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getEndOfMonth(baseDate) {
  const date = new Date(baseDate || new Date());
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function toDateTime(dateStr, timeStr) {
  return new Date(`${dateStr} ${timeStr || '00:00'}`);
}

function addDays(dateInput, days) {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  date.setDate(date.getDate() + days);
  return date;
}

module.exports = {
  addDays,
  formatDate,
  formatDateDisplay,
  getCurrentTime,
  getEndOfMonth,
  getEndOfWeek,
  getStartOfMonth,
  getStartOfWeek,
  getTodayDate,
  pad2,
  toDateTime,
};
