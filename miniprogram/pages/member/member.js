const api = require('../../common/api');
const { dateText } = require('../../common/format');

Page({
  data: {
    // 会员信息
    member: null,
    currentTier: null,
    nextTier: null,
    monthPoints: 0,
    upgradeProgress: null,
    spendDisplay: '0',
    targetDisplay: '0',
    upgradePct: 0,
    // 权益
    benefits: [],
    // 积分流水
    pointsLog: [],
    loading: true
  },

  async onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [profile, benefits, pointsLog] = await Promise.all([
        api.getMemberProfile(),
        api.getMemberBenefits(),
        api.getPointsHistory(10)
      ]);
      // 预计算 WXML 中无法表达的复杂表达式
      let spendDisplay = '0', targetDisplay = '0', upgradePct = 0;
      if (profile.upgradeProgress) {
        spendDisplay = Math.floor(profile.upgradeProgress.currentSpendCents / 100) + '';
        targetDisplay = Math.floor(profile.upgradeProgress.targetSpendCents / 100) + '';
        upgradePct = profile.upgradeProgress.percent || 0;
      }
      this.setData({
        member: profile.member,
        currentTier: profile.currentTier,
        nextTier: profile.nextTier,
        monthPoints: profile.monthPoints || 0,
        upgradeProgress: profile.upgradeProgress,
        spendDisplay,
        targetDisplay,
        upgradePct,
        benefits,
        pointsLog,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载会员信息失败', icon: 'none' });
    }
  },

  // 跳转订单
  goOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  // 跳转优惠券
  goCoupons() {
    wx.navigateTo({ url: '/pages/coupons/coupons' });
  },

  // 跳转积分明细
  goPointsDetail() {
    wx.navigateTo({ url: '/pages/member/points' });
  },

  // 跳转全部权益
  goBenefits() {
    wx.navigateTo({ url: '/pages/member/benefits' });
  },

  // 使用权益
  async useBenefit(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.useBenefit(id);
      wx.showToast({ title: '使用成功！', icon: 'success' });
      this.loadData();
    } catch (e) {
      wx.showToast({ title: e.message || '使用失败', icon: 'none' });
    }
  },

  // 检查升级
  async checkUpgrade() {
    wx.showLoading({ title: '检查中...' });
    try {
      const result = await api.checkAndUpgrade();
      wx.hideLoading();
      if (result.upgraded) {
        wx.showModal({
          title: '🎉 恭喜升级！',
          content: `您已升级为「${result.newTierName}」`,
          showCancel: false
        });
        this.loadData();
      } else if (result.reason === '消费未达标') {
        const current = (result.currentSpendCents / 100).toFixed(0);
        const target = (result.requiredSpendCents / 100).toFixed(0);
        wx.showModal({
          title: '还未达标',
          content: `已消费 ¥${current}，还差 ¥${target - current} 即可升级`,
          showCancel: false
        });
      } else {
        wx.showToast({ title: result.reason, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '检查失败', icon: 'none' });
    }
  },

  // 后台管理
  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' });
  },

  // 隐私政策
  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  // 用户协议
  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  }
});
