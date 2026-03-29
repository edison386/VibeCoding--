const dateUtils = require('../../utils/date');
const recordService = require('../../utils/recordService');

const BRISTOL_TYPES = [
  { id: 1, desc: '坚硬颗粒状（便秘）', color: '#E5A841' },
  { id: 2, desc: '香肠状有硬块', color: '#E5A841' },
  { id: 3, desc: '香肠状有裂纹（理想偏干）', color: '#3AA36E' },
  { id: 4, desc: '香肠状光滑（理想）', color: '#3AA36E' },
  { id: 5, desc: '柔软小块（偏软）', color: '#F09A5A' },
  { id: 6, desc: '糊状（轻度腹泻）', color: '#F09A5A' },
  { id: 7, desc: '水状（腹泻）', color: '#D95A4D' },
];

const COLOR_MAP = {
  brown: { label: '棕色', value: '#8B4513' },
  black: { label: '黑色', value: '#000000' },
  red: { label: '红色', value: '#FF0000' },
  yellow: { label: '黄色', value: '#FFD700' },
  green: { label: '绿色', value: '#00A86B' },
  white: { label: '白色', value: '#FFFFFF' },
};

Page({
  data: {
    selectedDate: dateUtils.getTodayDate(),
    currentYearMonth: '',
    calendarData: [],
    groupedRecords: [],
    scrollTarget: '',
  },

  onLoad() {
    const selectedDate = wx.getStorageSync('selectedDate');
    if (selectedDate) {
      this.setData({ selectedDate });
      wx.removeStorageSync('selectedDate');
    }
    this.refreshData();
  },

  onShow() {
    this.refreshData();
  },

  async refreshData() {
    let records = recordService.getLocalRecords();
    try {
      records = await recordService.syncFromCloud();
    } catch (error) {
      console.warn('history syncFromCloud failed:', error);
    }

    this.initCalendar(records);
    this.loadGroupedRecords(records);
  },

  initCalendar(records) {
    const baseDate = new Date(this.data.selectedDate.replace(/-/g, '/'));
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = dateUtils.getTodayDate();

    const countByDate = {};
    records.forEach((record) => {
      if (!countByDate[record.date]) countByDate[record.date] = 0;
      countByDate[record.date] += 1;
    });

    const calendarData = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${year}-${dateUtils.pad2(month + 1)}-${dateUtils.pad2(day)}`;
      const isFuture = dateStr > today;
      const recordCount = countByDate[dateStr] || 0;

      calendarData.push({
        date: dateStr,
        day,
        hasRecord: !isFuture && recordCount > 0,
        recordCount,
        isFuture,
      });
    }

    this.setData({
      currentYearMonth: `${year}年${month + 1}月`,
      calendarData,
    });
  },

  loadGroupedRecords(records) {
    const grouped = {};

    records.forEach((record) => {
      if (!grouped[record.date]) grouped[record.date] = [];
      const typeObj = BRISTOL_TYPES.find((item) => item.id === Number(record.type));
      const colorObj = COLOR_MAP[record.color] || COLOR_MAP.brown;
      grouped[record.date].push({
        ...record,
        typeDesc: typeObj ? typeObj.desc : '未知',
        typeColor: typeObj ? typeObj.color : '#8C8C8C',
        colorLabel: colorObj.label,
        colorValue: colorObj.value,
      });
    });

    const groupedRecords = Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        anchor: `date-${date.replace(/-/g, '')}`,
        records: grouped[date].sort((a, b) => b.time.localeCompare(a.time)),
      }));

    this.setData({ groupedRecords });
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    const today = dateUtils.getTodayDate();
    if (date > today) return;

    const targetAnchor = `date-${date.replace(/-/g, '')}`;
    this.setData({
      selectedDate: date,
      scrollTarget: targetAnchor,
    });

    // 重新初始化日历，保持标题月份与选中日期一致
    this.initCalendar(recordService.getLocalRecords());
  },

  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record/record?id=${id}`,
    });
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await recordService.deleteRecord(id);
          await this.refreshData();
          wx.showToast({ title: '删除成功', icon: 'success' });
        } catch (error) {
          console.error('deleteRecord failed:', error);
          wx.showToast({ title: '删除失败，请重试', icon: 'none' });
        }
      },
    });
  },
});
