// 云函数：扣除积分（兑换商品时调用）
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { points, goodsId, goodsName, remark } = event

  if (!points || points <= 0) {
    return { code: -1, message: '积分无效' }
  }

  // 查会员
  let res = await db.collection('members').where({ _openid: OPENID }).get()
  if (res.data.length === 0) {
    return { code: -1, message: '会员不存在' }
  }
  const member = res.data[0]

  if ((member.points || 0) < points) {
    return { code: -2, message: '积分不足' }
  }

  // 扣积分
  await db.collection('members').doc(member._id).update({
    data: {
      points: _.inc(-points),
      updatedAt: db.serverDate(),
    }
  })

  // 记流水
  await db.collection('pointsLog').add({
    data: {
      _openid: OPENID,
      type: '支出',
      points: points,
      balance: (member.points || 0) - points,
      source: '兑换',
      goodsId: goodsId || '',
      goodsName: goodsName || '',
      remark: remark || `兑换 ${goodsName || '商品'}`,
      createdAt: db.serverDate(),
    }
  })

  return {
    code: 0,
    data: {
      deductedPoints: points,
      totalPoints: (member.points || 0) - points,
    }
  }
}
