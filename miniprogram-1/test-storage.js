// 测试本地存储
const records = wx.getStorageSync('records') || [];
console.log('Records in storage:', records);
console.log('Records count:', records.length);

// 尝试添加一条测试记录
if (records.length === 0) {
  const testRecord = {
    id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    type: '4',
    color: 'brown',
    feelings: ['顺畅']
  };
  records.push(testRecord);
  wx.setStorageSync('records', records);
  console.log('Added test record:', testRecord);
  console.log('Updated records count:', records.length);
}
