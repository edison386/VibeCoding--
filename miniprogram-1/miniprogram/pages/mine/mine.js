const { getTodayDate } = require('../../utils/date');
const recordService = require('../../utils/recordService');
const reminderService = require('../../utils/reminderService');
const { exportRecordsPdf } = require('../../utils/pdfExporter');

const PROFILE_KEY = 'userProfile';
const FIRST_USE_KEY = 'firstUseDate';

Page({
  data: {
    userInfo: {
      avatarUrl: '/images/avatar.png',
      nickName: '肠道日记用户',
      registerDays: 1,
    },
    cloudUser: null,
    syncStatus: '未连接云端',
    syncing: false,
    reminderSettings: reminderService.DEFAULT_SETTINGS,
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.initPage();
  },

  initPage() {
    this.initUserInfo();
    this.loadReminderSettings();
    this.refreshSyncStatus();
  },

  initUserInfo() {
    const today = getTodayDate();
    let firstUseDate = wx.getStorageSync(FIRST_USE_KEY);
    if (!firstUseDate) {
      firstUseDate = today;
      wx.setStorageSync(FIRST_USE_KEY, firstUseDate);
    }

    const start = new Date(firstUseDate.replace(/-/g, '/'));
    const now = new Date();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;

    const profile = wx.getStorageSync(PROFILE_KEY) || {};
    this.setData({
      userInfo: {
        avatarUrl: profile.avatarUrl || '/images/avatar.png',
        nickName: profile.nickName || '肠道日记用户',
        registerDays: Math.max(diff, 1),
      },
    });
  },

  loadReminderSettings() {
    this.setData({
      reminderSettings: reminderService.getReminderSettings(),
    });
  },

  refreshSyncStatus() {
    const cloudUser = recordService.getCloudUser();
    this.setData({
      cloudUser,
      syncStatus: cloudUser ? '已连接云端，支持自动备份' : '未连接云端，仅本地存储',
    });
  },

  authorizeProfile() {
    wx.getUserProfile({
      desc: '用于展示头像和昵称',
      success: (res) => {
        const info = res.userInfo || {};
        const profile = {
          avatarUrl: info.avatarUrl || '/images/avatar.png',
          nickName: info.nickName || '肠道日记用户',
        };
        wx.setStorageSync(PROFILE_KEY, profile);
        this.initUserInfo();
        wx.showToast({ title: '授权成功', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '未授权，已使用默认信息', icon: 'none' });
      },
    });
  },

  async syncCloudData() {
    if (this.data.syncing) return;

    this.setData({ syncing: true });
    wx.showLoading({ title: '同步中...' });

    try {
      await recordService.loginAndSync();
      this.refreshSyncStatus();
      wx.showToast({ title: '同步完成', icon: 'success' });
    } catch (error) {
      console.error('syncCloudData failed:', error);
      wx.showToast({ title: '同步失败，请检查云开发配置', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ syncing: false });
    }
  },

  toggleReminder(e) {
    const settings = reminderService.saveReminderSettings({
      enabled: e.detail.value,
    });
    this.setData({ reminderSettings: settings });
  },

  changeReminderTime(e) {
    const settings = reminderService.saveReminderSettings({
      time: e.detail.value,
    });
    this.setData({ reminderSettings: settings });
  },

  toggleNightReminder(e) {
    const settings = reminderService.saveReminderSettings({
      nightReminderEnabled: e.detail.value,
    });
    this.setData({ reminderSettings: settings });
  },

  changeNightTime(e) {
    const settings = reminderService.saveReminderSettings({
      nightTime: e.detail.value,
    });
    this.setData({ reminderSettings: settings });
  },

  requestNotificationPermission() {
    wx.showModal({
      title: '通知权限说明',
      content: '提醒依赖微信通知权限，请在系统设置中开启小程序通知，确保按时收到提醒。',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({});
        }
      },
    });
  },

  async exportData() {
    const records = recordService.getLocalRecords();
    if (!records.length) {
      wx.showToast({ title: '暂无可导出的数据', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成 PDF...' });
    try {
      const filePath = await exportRecordsPdf(records);
      wx.hideLoading();
      wx.openDocument({
        filePath,
        showMenu: true,
        fileType: 'pdf',
      });
    } catch (error) {
      wx.hideLoading();
      console.error('exportData failed:', error);
      wx.showToast({ title: '导出失败，请重试', icon: 'none' });
    }
  },

  clearData() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地记录吗？此操作不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await recordService.setLocalRecords([]);
          wx.showToast({ title: '本地数据已清除', icon: 'success' });
        } catch (error) {
          console.error('clearData failed:', error);
          wx.showToast({ title: '清除失败，请重试', icon: 'none' });
        }
      },
    });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' });
  },
});
