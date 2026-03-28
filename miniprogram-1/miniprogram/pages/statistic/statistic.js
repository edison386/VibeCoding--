const dateUtils = require('../../utils/date');
const recordService = require('../../utils/recordService');

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const STATUS_MAP = {
  normal: { label: '规律', color: '#4CAF7D' },
  less: { label: '偏少', color: '#FFC043' },
  more: { label: '偏多', color: '#FF8A50' },
  attention: { label: '需关注', color: '#F44336' },
};

const BRISTOL_TYPES = [
  { id: 1, desc: '坚硬颗粒状（便秘）', color: '#FFC043' },
  { id: 2, desc: '香肠状有硬块', color: '#FFC043' },
  { id: 3, desc: '香肠状有裂纹（理想偏干）', color: '#4CAF7D' },
  { id: 4, desc: '香肠状光滑（理想）', color: '#4CAF7D' },
  { id: 5, desc: '柔软小块（偏软）', color: '#FF8A50' },
  { id: 6, desc: '糊状（轻度腹泻）', color: '#FF8A50' },
  { id: 7, desc: '水状（腹泻）', color: '#F44336' },
];

Page({
  data: {
    loading: true,
    activeRange: 'week',
    rangeTabs: [
      { key: 'day', label: '日' },
      { key: 'week', label: '周' },
      { key: 'month', label: '月' },
    ],
    frequencyData: [],
    typeDistribution: [],
    regularity: {
      averageTime: '-',
      averageInterval: '-',
      monthTotal: 0,
    },
    healthAssessment: {
      status: 'normal',
      label: '规律',
      color: '#4CAF7D',
      message: '肠道状态良好，继续保持规律作息和健康饮食。',
    },
    abnormalWarning: {
      show: false,
      key: '',
      message: '',
    },
    noData: false,
  },

  onLoad() {
    this.loadStatisticData();
  },

  onShow() {
    this.loadStatisticData();
  },

  async loadStatisticData() {
    this.setData({ loading: true });

    let records = recordService.getLocalRecords();
    try {
      records = await recordService.syncFromCloud();
    } catch (error) {
      console.warn('statistic syncFromCloud failed:', error);
    }

    if (!records.length) {
      this.setData({
        loading: false,
        noData: true,
        frequencyData: [],
        typeDistribution: [],
        regularity: {
          averageTime: '-',
          averageInterval: '-',
          monthTotal: 0,
        },
        healthAssessment: {
          status: 'normal',
          label: '规律',
          color: STATUS_MAP.normal.color,
          message: '暂无记录数据，开始记录后可查看统计分析。',
        },
        abnormalWarning: {
          show: false,
          key: '',
          message: '',
        },
      });
      return;
    }

    const filtered = this.filterRecordsByRange(records, this.data.activeRange);
    const frequencyData = this.calculateFrequencyData(filtered, this.data.activeRange);
    const typeDistribution = this.calculateTypeDistribution(filtered);
    const regularity = this.calculateRegularity(filtered, records);
    const healthAssessment = this.calculateHealthAssessment(filtered);
    const abnormalWarning = this.calculateAbnormalWarning(records);

    this.setData({
      loading: false,
      noData: false,
      frequencyData,
      typeDistribution,
      regularity,
      healthAssessment,
      abnormalWarning,
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeRange) return;
    this.setData({ activeRange: tab });
    this.loadStatisticData();
  },

  filterRecordsByRange(records, range) {
    const today = dateUtils.getTodayDate();

    if (range === 'day') {
      return records.filter((item) => item.date === today);
    }

    if (range === 'week') {
      const start = dateUtils.formatDate(dateUtils.getStartOfWeek(new Date()));
      const end = dateUtils.formatDate(dateUtils.getEndOfWeek(new Date()));
      return records.filter((item) => item.date >= start && item.date <= end);
    }

    const monthStart = dateUtils.formatDate(dateUtils.getStartOfMonth(new Date()));
    const monthEnd = dateUtils.formatDate(dateUtils.getEndOfMonth(new Date()));
    return records.filter((item) => item.date >= monthStart && item.date <= monthEnd);
  },

  calculateFrequencyData(records, range) {
    if (range === 'day') {
      const slots = [
        { label: '00-03', start: 0, end: 3 },
        { label: '04-07', start: 4, end: 7 },
        { label: '08-11', start: 8, end: 11 },
        { label: '12-15', start: 12, end: 15 },
        { label: '16-19', start: 16, end: 19 },
        { label: '20-23', start: 20, end: 23 },
      ];

      return slots.map((slot) => {
        const count = records.filter((item) => {
          const hour = Number((item.time || '00:00').split(':')[0]);
          return hour >= slot.start && hour <= slot.end;
        }).length;

        return {
          label: slot.label,
          count,
          height: count === 0 ? 8 : Math.min(180, count * 36),
        };
      });
    }

    if (range === 'week') {
      const start = dateUtils.getStartOfWeek(new Date());
      const result = [];

      for (let i = 0; i < 7; i += 1) {
        const day = dateUtils.addDays(start, i);
        const dateStr = dateUtils.formatDate(day);
        const count = records.filter((item) => item.date === dateStr).length;
        result.push({
          label: DAY_NAMES[i],
          count,
          height: count === 0 ? 8 : Math.min(180, count * 36),
        });
      }
      return result;
    }

    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const result = [];

    for (let day = 1; day <= days; day += 1) {
      const dateStr = `${now.getFullYear()}-${dateUtils.pad2(now.getMonth() + 1)}-${dateUtils.pad2(day)}`;
      const count = records.filter((item) => item.date === dateStr).length;
      result.push({
        label: `${day}`,
        count,
        height: count === 0 ? 8 : Math.min(180, count * 28),
      });
    }

    return result;
  },

  calculateTypeDistribution(records) {
    const countMap = {};
    records.forEach((item) => {
      const type = Number(item.type || 0);
      if (!countMap[type]) countMap[type] = 0;
      countMap[type] += 1;
    });

    return Object.keys(countMap)
      .map((type) => {
        const id = Number(type);
        const typeObj = BRISTOL_TYPES.find((item) => item.id === id);
        return {
          type: id,
          count: countMap[type],
          typeDesc: typeObj ? typeObj.desc : `Type ${id}`,
          color: typeObj ? typeObj.color : '#8C8C8C',
        };
      })
      .sort((a, b) => a.type - b.type);
  },

  calculateRegularity(filteredRecords, allRecords) {
    const monthStart = dateUtils.formatDate(dateUtils.getStartOfMonth(new Date()));
    const monthEnd = dateUtils.formatDate(dateUtils.getEndOfMonth(new Date()));
    const monthTotal = allRecords.filter((item) => item.date >= monthStart && item.date <= monthEnd).length;

    if (!filteredRecords.length) {
      return {
        averageTime: '-',
        averageInterval: '-',
        monthTotal,
      };
    }

    const hours = filteredRecords.map((item) => {
      const [hour, minute] = (item.time || '00:00').split(':').map(Number);
      return hour + minute / 60;
    });

    const avgHourRaw = hours.reduce((sum, value) => sum + value, 0) / hours.length;
    const avgHour = Math.floor(avgHourRaw);
    const avgMinute = Math.round((avgHourRaw - avgHour) * 60);

    let averageInterval = '暂无数据';
    if (filteredRecords.length > 1) {
      const sorted = [...filteredRecords].sort((a, b) => {
        return dateUtils.toDateTime(a.date, a.time) - dateUtils.toDateTime(b.date, b.time);
      });

      let totalHours = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = dateUtils.toDateTime(sorted[i - 1].date, sorted[i - 1].time);
        const curr = dateUtils.toDateTime(sorted[i].date, sorted[i].time);
        totalHours += (curr - prev) / (1000 * 60 * 60);
      }

      const avgHours = totalHours / (sorted.length - 1);
      if (avgHours < 1) {
        averageInterval = `约 ${Math.round(avgHours * 60)} 分钟`;
      } else {
        const h = Math.floor(avgHours);
        const m = Math.round((avgHours - h) * 60);
        averageInterval = m === 0 ? `约 ${h} 小时` : `约 ${h} 小时 ${m} 分钟`;
      }
    }

    return {
      averageTime: `约 ${dateUtils.pad2(avgHour)}:${dateUtils.pad2(avgMinute)}`,
      averageInterval,
      monthTotal,
    };
  },

  calculateHealthAssessment(records) {
    if (!records.length) {
      return {
        status: 'normal',
        label: STATUS_MAP.normal.label,
        color: STATUS_MAP.normal.color,
        message: '暂无记录数据，开始记录后可查看健康评估。',
      };
    }

    const uniqueDays = new Set(records.map((item) => item.date)).size;
    const avgPerDay = records.length / (uniqueDays || 1);

    const typeCount = {};
    records.forEach((item) => {
      const type = Number(item.type || 0);
      if (!typeCount[type]) typeCount[type] = 0;
      typeCount[type] += 1;
    });

    let status = 'normal';
    let message = '肠道状态良好，继续保持规律作息和健康饮食。';

    if (avgPerDay < 1) {
      status = 'less';
      message = '排便次数偏少，建议增加膳食纤维摄入，多喝水并保持运动。';
    } else if (avgPerDay > 3) {
      status = 'more';
      message = '排便次数偏多，建议留意饮食卫生并减少刺激性食物。';
    }

    const abnormalTypes = [1, 2, 6, 7];
    const abnormalCount = Object.keys(typeCount)
      .filter((type) => abnormalTypes.includes(Number(type)))
      .reduce((sum, type) => sum + typeCount[type], 0);

    if (abnormalCount / records.length >= 0.5) {
      status = 'attention';
      message = '异常形态占比偏高，建议关注饮食作息，必要时咨询医生。';
    }

    return {
      status,
      label: STATUS_MAP[status].label,
      color: STATUS_MAP[status].color,
      message,
    };
  },

  calculateAbnormalWarning(records) {
    const abnormalTypes = [1, 2, 6, 7];
    const dateMap = {};

    records.forEach((item) => {
      if (!dateMap[item.date]) dateMap[item.date] = [];
      dateMap[item.date].push(Number(item.type || 0));
    });

    const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));
    if (!sortedDates.length) {
      return { show: false, key: '', message: '' };
    }

    const latestDate = sortedDates[0];
    let streak = 0;
    let cursor = new Date(latestDate.replace(/-/g, '/'));

    while (true) {
      const cursorDate = dateUtils.formatDate(cursor);
      const dayRecords = dateMap[cursorDate];
      if (!dayRecords || !dayRecords.length) break;

      const allAbnormal = dayRecords.every((type) => abnormalTypes.includes(type));
      if (!allAbnormal) break;

      streak += 1;
      if (streak >= 3) break;

      cursor = dateUtils.addDays(cursor, -1);
    }

    const warningKey = `abnormal-${latestDate}`;
    const ignoredKey = wx.getStorageSync('ignoredAbnormalWarningKey');

    if (streak >= 3 && ignoredKey !== warningKey) {
      return {
        show: true,
        key: warningKey,
        message: '近期连续 3 天记录均为偏干/偏稀异常类型，建议调整饮食并关注身体状态。',
      };
    }

    return { show: false, key: warningKey, message: '' };
  },

  ignoreWarning() {
    const { abnormalWarning } = this.data;
    if (abnormalWarning && abnormalWarning.key) {
      wx.setStorageSync('ignoredAbnormalWarningKey', abnormalWarning.key);
    }

    this.setData({
      'abnormalWarning.show': false,
    });
  },

  showImprovementTips() {
    wx.showModal({
      title: '改善建议',
      showCancel: false,
      content: '1. 增加饮水量和膳食纤维\n2. 规律作息并减少久坐\n3. 若异常持续超过一周，建议及时就医咨询。',
    });
  },
});
