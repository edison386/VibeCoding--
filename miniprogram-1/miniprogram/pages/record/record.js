const { getCurrentTime, getTodayDate } = require('../../utils/date');
const recordService = require('../../utils/recordService');

Page({
  data: {
    currentStep: 1,
    record: {
      id: '',
      date: getTodayDate(),
      time: getCurrentTime(),
      type: 0,
      color: 'brown',
      duration: 0,
      feelings: [],
      note: '',
      createdAt: 0,
      updatedAt: 0,
    },
    bristolTypes: [
      { id: 1, name: 'Type 1', desc: '坚硬颗粒状（便秘）', color: '#FFC043' },
      { id: 2, name: 'Type 2', desc: '香肠状有硬块', color: '#FFC043' },
      { id: 3, name: 'Type 3', desc: '香肠状有裂纹（理想偏干）', color: '#4CAF7D' },
      { id: 4, name: 'Type 4', desc: '香肠状光滑（理想）', color: '#4CAF7D' },
      { id: 5, name: 'Type 5', desc: '柔软小块（偏软）', color: '#FF8A50' },
      { id: 6, name: 'Type 6', desc: '糊状（轻度腹泻）', color: '#FF8A50' },
      { id: 7, name: 'Type 7', desc: '水状（腹泻）', color: '#F44336' },
    ],
    colors: [
      { name: 'brown', label: '棕色', value: '#8B4513' },
      { name: 'black', label: '黑色', value: '#000000' },
      { name: 'red', label: '红色', value: '#FF0000' },
      { name: 'yellow', label: '黄色', value: '#FFD700' },
      { name: 'green', label: '绿色', value: '#00A86B' },
      { name: 'white', label: '白色', value: '#FFFFFF' },
    ],
    feelings: [
      { name: '顺畅' },
      { name: '费力' },
      { name: '不尽感' },
      { name: '腹痛' },
      { name: '腹胀' },
    ],
  },

  onLoad(options) {
    const id = options && options.id;
    if (id) {
      this.loadRecord(id);
    }
  },

  loadRecord(id) {
    const record = recordService.getRecordById(id);
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    this.setData({
      record: {
        ...record,
        type: Number(record.type || 0),
      },
    });
  },

  nextStep() {
    if (this.data.currentStep < 3) {
      this.setData({ currentStep: this.data.currentStep + 1 });
    }
  },

  prevStep() {
    if (this.data.currentStep > 1) {
      this.setData({ currentStep: this.data.currentStep - 1 });
    }
  },

  bindTimeChange(e) {
    this.setData({ 'record.time': e.detail.value });
  },

  bindDurationChange(e) {
    this.setData({ 'record.duration': Number(e.detail.value || 0) });
  },

  selectType(e) {
    this.setData({ 'record.type': Number(e.currentTarget.dataset.type) });
  },

  selectColor(e) {
    this.setData({ 'record.color': e.currentTarget.dataset.color });
  },

  toggleFeeling(e) {
    const feeling = e.currentTarget.dataset.feeling;
    const list = [...this.data.record.feelings];
    const index = list.indexOf(feeling);

    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(feeling);
    }

    this.setData({ 'record.feelings': list });
  },

  bindNoteInput(e) {
    this.setData({ 'record.note': e.detail.value });
  },

  async saveRecord() {
    const { record } = this.data;

    if (!record.time) {
      wx.showToast({ title: '请选择时间', icon: 'none' });
      return;
    }

    if (!record.type) {
      wx.showToast({ title: '请选择大便形态', icon: 'none' });
      return;
    }

    const payload = {
      ...record,
      type: Number(record.type),
      duration: Number(record.duration || 0),
      feelings: record.feelings || [],
      note: record.note || '',
      date: record.date || getTodayDate(),
    };

    try {
      await recordService.upsertRecord(payload);
      wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '记录成功 ✓', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (error) {
      console.error('saveRecord failed:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
});
