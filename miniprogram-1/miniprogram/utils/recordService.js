const dateUtils = require('./date');

const RECORDS_KEY = 'records';
const CLOUD_USER_KEY = 'gutCloudUser';
const CLOUD_COLLECTION = 'gut_records';

function getStorageSafe(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value === undefined || value === null || value === '' ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function setStorageSafe(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    console.warn('setStorageSafe failed:', key, error);
  }
}

function normalizeRecord(record = {}) {
  const now = Date.now();
  const id = record.id ? String(record.id) : String(now);
  const createdAt = Number(record.createdAt || now);
  const updatedAt = Number(record.updatedAt || now);

  return {
    id,
    date: record.date || dateUtils.getTodayDate(),
    time: record.time || dateUtils.getCurrentTime(),
    type: Number(record.type || 0),
    color: record.color || 'brown',
    duration: Number(record.duration || 0),
    feelings: Array.isArray(record.feelings) ? record.feelings : [],
    note: record.note || '',
    createdAt,
    updatedAt,
  };
}

function toTimestamp(record) {
  if (!record || !record.date) return 0;
  return dateUtils.toDateTime(record.date, record.time).getTime();
}

function sortRecordsDesc(records) {
  return [...records].sort((a, b) => {
    const diff = toTimestamp(b) - toTimestamp(a);
    if (diff !== 0) return diff;
    return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
  });
}

function getLocalRecords() {
  const raw = getStorageSafe(RECORDS_KEY, []);
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((item) => normalizeRecord(item))
    .filter((item) => item.id && item.date);
  const sorted = sortRecordsDesc(normalized);
  setLocalRecords(sorted);
  return sorted;
}

function setLocalRecords(records) {
  const normalized = sortRecordsDesc((records || []).map((item) => normalizeRecord(item)));
  setStorageSafe(RECORDS_KEY, normalized);
  return normalized;
}

function getRecordById(id) {
  if (!id) return null;
  const records = getLocalRecords();
  return records.find((record) => record.id === String(id)) || null;
}

function cloudAvailable() {
  return !!(wx && wx.cloud && typeof wx.cloud.database === 'function');
}

function getCloudUser() {
  return getStorageSafe(CLOUD_USER_KEY, null);
}

function setCloudUser(user) {
  if (user) {
    setStorageSafe(CLOUD_USER_KEY, user);
  } else {
    try {
      wx.removeStorageSync(CLOUD_USER_KEY);
    } catch (error) {
      console.warn('remove cloud user failed', error);
    }
  }
}

function callCloudFunction(params) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: params,
      success: resolve,
      fail: reject,
    });
  });
}

async function ensureCloudCollection() {
  if (!cloudAvailable()) return false;
  try {
    await callCloudFunction({ type: "createGutRecordsCollection" });
    return true;
  } catch (error) {
    console.warn("ensureCloudCollection failed:", error);
    return false;
  }
}

function dbGet(query) {
  return new Promise((resolve, reject) => {
    query.get({
      success: resolve,
      fail: reject,
    });
  });
}

function dbAdd(collection, data) {
  return new Promise((resolve, reject) => {
    collection.add({
      data,
      success: resolve,
      fail: reject,
    });
  });
}

function dbUpdate(docRef, data) {
  return new Promise((resolve, reject) => {
    docRef.update({
      data,
      success: resolve,
      fail: reject,
    });
  });
}

async function ensureCloudUser(forceRefresh = false) {
  const cached = getCloudUser();
  if (cached && !forceRefresh) return cached;
  if (!cloudAvailable()) return null;

  try {
    const result = await callCloudFunction({ type: 'getOpenId' });
    const openid = result && result.result && result.result.openid;
    if (!openid) return null;

    const user = {
      openid,
      syncedAt: Date.now(),
    };
    setCloudUser(user);
    return user;
  } catch (error) {
    console.warn('ensureCloudUser failed:', error);
    return null;
  }
}

async function fetchCloudDocs(openid) {
  if (!openid || !cloudAvailable()) return [];
  const collection = wx.cloud.database().collection(CLOUD_COLLECTION);
  const pageSize = 100;
  const all = [];
  let skip = 0;

  while (true) {
    const res = await dbGet(collection.where({ userId: openid }).skip(skip).limit(pageSize));
    const list = (res && res.data) || [];
    all.push(...list);
    if (list.length < pageSize || skip > 5000) {
      break;
    }
    skip += pageSize;
  }

  return all;
}

function cloudDocToLocal(doc) {
  if (!doc || !doc.recordId) return null;
  return normalizeRecord({
    id: String(doc.recordId),
    date: doc.date,
    time: doc.time,
    type: Number(doc.type || 0),
    color: doc.color || 'brown',
    duration: Number(doc.duration || 0),
    feelings: Array.isArray(doc.feelings) ? doc.feelings : [],
    note: doc.note || '',
    createdAt: Number(doc.createdAt || doc.updatedAt || Date.now()),
    updatedAt: Number(doc.updatedAt || Date.now()),
  });
}

function mergeLocalAndCloud(localRecords, cloudDocs) {
  const mergedMap = {};

  localRecords.forEach((record) => {
    mergedMap[record.id] = normalizeRecord(record);
  });

  cloudDocs.forEach((doc) => {
    if (!doc || !doc.recordId) return;

    const id = String(doc.recordId);
    const cloudUpdatedAt = Number(doc.updatedAt || 0);
    const local = mergedMap[id];
    const localUpdatedAt = local ? Number(local.updatedAt || 0) : 0;

    if (doc.deleted) {
      if (!local || cloudUpdatedAt >= localUpdatedAt) {
        delete mergedMap[id];
      }
      return;
    }

    const cloudRecord = cloudDocToLocal(doc);
    if (!cloudRecord) return;

    if (!local || cloudUpdatedAt >= localUpdatedAt) {
      mergedMap[id] = cloudRecord;
    }
  });

  return sortRecordsDesc(Object.values(mergedMap));
}

async function upsertCloudDoc(record) {
  const user = getCloudUser();
  if (!user || !user.openid || !cloudAvailable()) return;

  const collection = wx.cloud.database().collection(CLOUD_COLLECTION);
  const query = await dbGet(collection.where({ userId: user.openid, recordId: record.id }).limit(1));
  const doc = query && query.data && query.data[0];

  const data = {
    userId: user.openid,
    recordId: record.id,
    date: record.date,
    time: record.time,
    type: Number(record.type || 0),
    color: record.color || 'brown',
    duration: Number(record.duration || 0),
    feelings: Array.isArray(record.feelings) ? record.feelings : [],
    note: record.note || '',
    createdAt: Number(record.createdAt || Date.now()),
    updatedAt: Number(record.updatedAt || Date.now()),
    deleted: false,
  };

  if (doc && doc._id) {
    await dbUpdate(collection.doc(doc._id), data);
  } else {
    await dbAdd(collection, data);
  }
}

async function upsertCloudDelete(id, updatedAt) {
  const user = getCloudUser();
  if (!user || !user.openid || !cloudAvailable()) return;

  const collection = wx.cloud.database().collection(CLOUD_COLLECTION);
  const query = await dbGet(collection.where({ userId: user.openid, recordId: String(id) }).limit(1));
  const doc = query && query.data && query.data[0];
  const tombstone = {
    userId: user.openid,
    recordId: String(id),
    deleted: true,
    updatedAt: Number(updatedAt || Date.now()),
  };

  if (doc && doc._id) {
    await dbUpdate(collection.doc(doc._id), tombstone);
  } else {
    await dbAdd(collection, tombstone);
  }
}

async function syncFromCloud() {
  const local = getLocalRecords();
  const user = getCloudUser();
  if (!user || !user.openid) return local;

  try {
    const docs = await fetchCloudDocs(user.openid);
    const merged = mergeLocalAndCloud(local, docs);
    setLocalRecords(merged);
    return merged;
  } catch (error) {
    console.warn('syncFromCloud failed:', error);
    return local;
  }
}

async function syncAllToCloud(records) {
  const user = getCloudUser();
  if (!user || !user.openid) return;

  const list = records || getLocalRecords();
  for (let i = 0; i < list.length; i += 1) {
    await upsertCloudDoc(list[i]);
  }
}

async function loginAndSync() {
  const user = await ensureCloudUser(true);
  if (!user) {
    throw new Error('登录失败，请检查云开发配置');
  }

  await ensureCloudCollection();
  const merged = await syncFromCloud();
  await syncAllToCloud(merged);
  return {
    user,
    records: merged,
  };
}

async function upsertRecord(record) {
  const normalized = normalizeRecord(record);
  const now = Date.now();
  const records = getLocalRecords();
  const index = records.findIndex((item) => item.id === normalized.id);

  if (index > -1) {
    const existing = records[index];
    const nextRecord = {
      ...existing,
      ...normalized,
      id: existing.id,
      createdAt: existing.createdAt || normalized.createdAt || now,
      updatedAt: now,
    };
    records[index] = nextRecord;
  } else {
    records.unshift({
      ...normalized,
      createdAt: normalized.createdAt || now,
      updatedAt: now,
    });
  }

  const nextRecords = setLocalRecords(records);
  const saved = nextRecords.find((item) => item.id === normalized.id || (!record.id && item.createdAt === normalized.createdAt)) || nextRecords[0];

  try {
    await upsertCloudDoc(saved);
  } catch (error) {
    console.warn('upsertCloudDoc failed:', error);
  }

  return saved;
}

async function deleteRecord(recordId) {
  const id = String(recordId);
  const records = getLocalRecords();
  const nextRecords = records.filter((item) => item.id !== id);
  setLocalRecords(nextRecords);

  try {
    await upsertCloudDelete(id, Date.now());
  } catch (error) {
    console.warn('upsertCloudDelete failed:', error);
  }

  return nextRecords;
}

module.exports = {
  CLOUD_COLLECTION,
  deleteRecord,
  ensureCloudUser,
  getCloudUser,
  getLocalRecords,
  getRecordById,
  loginAndSync,
  setCloudUser,
  setLocalRecords,
  sortRecordsDesc,
  syncAllToCloud,
  syncFromCloud,
  upsertRecord,
};
