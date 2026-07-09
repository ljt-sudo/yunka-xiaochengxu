const api = require('../../common/api');
const { money, dateText } = require('../../common/format');

Page({
  data: { coupons: [], claims: [], money, dateText },
  async onShow() {
    const [coupons, claims] = await Promise.all([api.listCoupons(), api.listCouponClaims()]);
    this.setData({ coupons, claims });
  },
  async claim(event) {
    await api.claimCoupon(event.currentTarget.dataset.id);
    await this.onShow();
    wx.showToast({ title: '已领取' });
  },
  hasClaimed(couponId) {
    return this.data.claims.some((claim) => claim.couponId === couponId && claim.status === 'available');
  }
});
