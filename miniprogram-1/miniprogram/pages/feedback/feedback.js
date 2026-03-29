Page({
  data: {
    content: '',
    contact: ''
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value });
  },

  submitFeedback() {
    const { content, contact } = this.data;
    if (!content.trim()) {
      wx.showToast({ title: '请先填写反馈内容', icon: 'none' });
      return;
    }

    const list = wx.getStorageSync('feedbackList') || [];
    list.unshift({
      id: String(Date.now()),
      content: content.trim(),
      contact: contact.trim(),
      createdAt: new Date().toLocaleString()
    });

    wx.setStorageSync('feedbackList', list);
    wx.showToast({ title: '提交成功，感谢反馈', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 700);
  }
});
