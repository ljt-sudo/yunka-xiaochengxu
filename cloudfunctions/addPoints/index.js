// 云函数：增加积分（消费后调用）
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

// 等级配置
const LEVEL_CONFIG = [
  { level: '普通会员', minConsumption: 0,      pointsRate: 1.0 },
  { level: '银卡会员', minConsumption: 50000,  pointsRate: 1.2 },  // 累计消费500元
  { level: '金卡会员', minConsumption: 200000, pointsRate: 1.5 },  // 累计消费2000元
  { level: '钻石会员', minConsumption: 500000, pointsRate: 2.0 },  // 累计消费5000元
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { amount, orderId, remark } = event  // amount: 消费金额（分）

  if (!amount || amount <= 0) {
    return { code: -1, message: '金额无效' }
  }

  // 查会员
  let res = await db.collection('members').where({ _openid: OPENID }).get()
  if (res.data.length === 0) {
    return { code: -1, message: '会员不存在' }
  }
  const member = res.data[0]

  // 计算积分倍率
  const config = LEVEL_CONFIG.filter(c => member.totalConsumption >= c.minConsumption).pop()
  const rate = config ? config.pointsRate : 1.0
  const points = Math.floor(amount / 100 * rate)  // 1元=1积分 × 倍率

  // 更新会员
  let newLevel = member.level
  const newTotal = (member.totalConsumption || 0) + amount
  for (const c of LEVEL_CONFIG) {
    if (newTotal >= c.minConsumption) {
      newLevel = c.level
    }
  }

  await db.collection('members').doc(member._id).update({
    data: {
      points: _.inc(points),
      totalConsumption: _.inc(amount),
      level: newLevel,
      updatedAt: db.serverDate(),
    }
  })

  // 记录积分流水
  await db.collection('pointsLog').add({
    data: {
      _openid: OPENID,
      type: '收入',
      points: points,
      balance: (member.points || 0) + points,
      source: '消费',
      orderId: orderId || '',
      remark: remark || `消费 ${(amount / 100).toFixed(2)} 元`,
      createdAt: db.serverDate(),
    }
  })

  return {
    code: 0,
    data: {
      addedPoints: points,
      totalPoints: (member.points || 0) + points,
      newLevel: newLevel,
      rate: rate,
    }
  }
}
