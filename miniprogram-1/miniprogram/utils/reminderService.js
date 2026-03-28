const { getTodayDate } = require('./date');

const SETTINGS_KEY = 'reminderSettings';
const NIGHT_SHOWN_KEY = 'nightReminderShownDate';

const DEFAULT_SETTINGS = {
  enabled: true,
  time: '08:00',
  nightReminderEnabled: true,
  nightTime: '21:00',
};

function normalizeTime(value, fallback) {
  if (!value || typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return fallback;
  }
  return value;
}

function getReminderSettings() {
  const settings = wx.getStorageSync(SETTINGS_KEY) || {};
  return {
    enabled: settings.enabled !== undefined ? !!settings.enabled : DEFAULT_SETTINGS.enabled,
    time: normalizeTime(settings.time, DEFAULT_SETTINGS.time),
    nightReminderEnabled: settings.nightReminderEnabled !== undefined
      ? !!settings.nightReminderEnabled
      : DEFAULT_SETTINGS.nightReminderEnabled,
    nightTime: normalizeTime(settings.nightTime, DEFAULT_SETTINGS.nightTime),
  };
}

function saveReminderSettings(settings) {
  const merged = {
    ...getReminderSettings(),
    ...(settings || {}),
  };
  wx.setStorageSync(SETTINGS_KEY, merged);
  return merged;
}

function toMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

function hasRecordToday(records) {
  const today = getTodayDate();
  return (records || []).some((record) => record.date === today);
}

function shouldShowNightReminder(records) {
  const settings = getReminderSettings();
  if (!settings.enabled || !settings.nightReminderEnabled) return false;
  if (hasRecordToday(records)) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < toMinutes(settings.nightTime)) return false;

  const today = getTodayDate();
  const shownDate = wx.getStorageSync(NIGHT_SHOWN_KEY);
  if (shownDate === today) return false;

  return true;
}

function markNightReminderShown() {
  wx.setStorageSync(NIGHT_SHOWN_KEY, getTodayDate());
}

module.exports = {
  DEFAULT_SETTINGS,
  getReminderSettings,
  markNightReminderShown,
  saveReminderSettings,
  shouldShowNightReminder,
};
