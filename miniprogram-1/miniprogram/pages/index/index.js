const dateUtils = require('../../utils/date');
const recordService = require('../../utils/recordService');
const reminderService = require('../../utils/reminderService');

const BRISTOL_TYPES = [
  { id: 1, desc: '坚硬颗粒状（便秘）' },
  { id: 2, desc: '香肠状有硬块' },
  { id: 3, desc: '香肠状有裂纹（理想偏干）' },
  { id: 4, desc: '香肠状光滑（理想）' },
  { id: 5, desc: '柔软小块（偏软）' },
  { id: 6, desc: '糊状（轻度腹泻）' },
  { id: 7, desc: '水状（腹泻）' },
];

Page({
  data: {
    greeting: '',
    todayDate: '',
    hasRecordToday: false,
    todayRecords: [],
    latestRecord: null,
    consecutiveDays: 0,
    weeklySummary: [],
  },

  onLoad() {
    this.initData();
  },

  onShow() {
    this.initData();
  },

  async initData() {
    this.setGreeting();
    this.setTodayDate();

    let records = recordService.getLocalRecords();
    try {
      records = await recordService.syncFromCloud();
    } catch (error) {
      console.warn('index syncFromCloud failed:', error);
    }

    this.updateTodayRecord(records);
    this.updateConsecutiveDays(records);
    this.updateWeeklySummary(records);
    this.tryShowNightReminder(records);
  },

  setGreeting() {
    const hour = new Date().getHours();
    let greeting = '晚上好';
    if (hour < 12) greeting = '早上好';
    else if (hour < 18) greeting = '下午好';
    this.setData({ greeting });
  },

  setTodayDate() {
    this.setData({
      todayDate: dateUtils.formatDateDisplay(dateUtils.getTodayDate()),
    });
  },

  updateTodayRecord(records) {
    const today = dateUtils.getTodayDate();
    const todayRecords = records
      .filter((record) => record.date === today)
      .sort((a, b) => b.time.localeCompare(a.time))
      .map((record) => {
        const typeObj = BRISTOL_TYPES.find((item) => item.id === Number(record.type));
        return {
          ...record,
          typeDesc: typeObj ? typeObj.desc : '未知',
        };
      });

    this.setData({
      hasRecordToday: todayRecords.length > 0,
      todayRecords,
      latestRecord: todayRecords[0] || null,
    });
  },

  updateConsecutiveDays(records) {
    const dateSet = new Set(records.map((record) => record.date));
    const today = new Date();

    let days = 0;
    while (true) {
      const currentDate = dateUtils.formatDate(dateUtils.addDays(today, -days));
      if (!dateSet.has(currentDate)) break;
      days += 1;
    }

    this.setData({ consecutiveDays: days });
  },

  updateWeeklySummary(records) {
    const start = dateUtils.getStartOfWeek(new Date());
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const weeklySummary = [];
    for (let i = 0; i < 7; i += 1) {
      const current = dateUtils.addDays(start, i);
      const dateStr = dateUtils.formatDate(current);
      const count = records.filter((record) => record.date === dateStr).length;
      weeklySummary.push({ day: dayNames[i], count });
    }

    this.setData({ weeklySummary });
  },

  tryShowNightReminder(records) {
    if (!reminderService.shouldShowNightReminder(records)) return;

    reminderService.markNightReminderShown();
    wx.showModal({
      title: '晚间提醒',
      content: '今天还没有记录排便情况，是否现在去记录？',
      confirmText: '去记录',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          this.goToRecord();
        }
      },
    });
  },

  goToRecord() {
    wx.navigateTo({
      url: '/pages/record/record',
    });
  },

  goToHistory() {
    wx.switchTab({
      url: '/pages/history/history',
    });
  },

  handleStatusCardClick() {
    if (this.data.hasRecordToday) {
      wx.setStorageSync('selectedDate', dateUtils.getTodayDate());
      this.goToHistory();
      return;
    }
    this.goToRecord();
  },
});
