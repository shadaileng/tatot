// AI 解读服务 - 调用 Cloudflare Worker API，失败时降级到本地规则

import type { DrawnCard } from '@/types'

// 从环境变量读取 Worker API 地址（Vite 构建时注入）
const API_URL = import.meta.env.VITE_API_URL || ''

export interface AIReadingResult {
  /** AI 生成的完整解读文本 */
  reading: string
  /** 是否为 AI 生成（false 表示本地降级） */
  isAI: boolean
  /** AI 解读格式不完整，综合解读部分由本地补偿 */
  isPartialAI: boolean
}

/**
 * 调用 AI 接口获取个性化解读
 */
export async function fetchAIReading(question: string, cards: DrawnCard[]): Promise<AIReadingResult> {
  try {
    const res = await uni.request({
      url: API_URL,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        question,
        cards: cards.map((c) => ({
          position: c.position,
          name: c.card.name,
          isUpright: c.orientation === 'upright',
          uprightMeaning: c.card.uprightMeaning,
          reversedMeaning: c.card.reversedMeaning,
          keywords: c.card.keywords,
        })),
      },
      timeout: 10000,
    })

    if (res.statusCode !== 200) {
      throw new Error(`API error: ${res.statusCode}`)
    }

    const data = res.data as { reading?: string; incomplete?: boolean }
    if (data.reading) {
      if (data.incomplete && !data.reading.includes('✨ 综合解读')) {
        const summary = generateSummaryOnly(question, cards)
        const compensated = data.reading + summary
        return { reading: compensated, isAI: true, isPartialAI: true }
      }
      return { reading: data.reading, isAI: true, isPartialAI: false }
    }
    throw new Error('Empty reading')
  } catch {
    return { reading: generateLocalReading(question, cards), isAI: false, isPartialAI: false }
  }
}

/**
 * 本地降级：基于规则拼接与问题关联的解读
 */
export function generateLocalReading(question: string, cards: DrawnCard[]): string {
  const category = detectCategory(question)

  const parts = cards.map((c) => {
    const isUpright = c.orientation === 'upright'
    const meaning = isUpright ? c.card.uprightMeaning : c.card.reversedMeaning
    const orientation = isUpright ? '正位' : '逆位'
    const keyword = c.card.keywords[isUpright ? 0 : c.card.keywords.length - 1] || c.card.keywords[0]

    let contextHint = ''
    if (category === 'love') {
      contextHint = isUpright
        ? `在感情方面，${c.card.name}正位暗示着${keyword}的能量将正面影响你的关系。`
        : `在感情方面，${c.card.name}逆位提醒你注意${keyword}的问题，可能需要更多沟通与理解。`
    } else if (category === 'career') {
      contextHint = isUpright
        ? `在事业方面，${c.card.name}正位预示着${keyword}的机遇正在到来。`
        : `在事业方面，${c.card.name}逆位暗示你可能面临${keyword}的挑战，需要调整策略。`
    } else if (category === 'study') {
      contextHint = isUpright
        ? `在学业方面，${c.card.name}正位说明${keyword}将助你取得进步。`
        : `在学业方面，${c.card.name}逆位提醒你${keyword}可能成为阻碍，需要更多耐心。`
    } else {
      contextHint = isUpright
        ? `${c.card.name}正位带来${keyword}的积极能量。`
        : `${c.card.name}逆位暗示${keyword}的挑战需要面对。`
    }

    return `📍 位置：${c.position} — ${c.card.name}（${orientation}）\n${contextHint}\n牌面含义：${meaning}`
  })

  const summary = generateSummary(question, cards, category)

  return `${parts.join('\n\n')}\n\n✨ 综合解读\n${summary}`
}

/**
 * 仅生成本地综合解读（用于补偿 AI 缺失的综合解读部分），并标注「（本地补充）」
 */
function generateSummaryOnly(question: string, cards: DrawnCard[]): string {
  const category = detectCategory(question)
  const uprightCount = cards.filter((c) => c.orientation === 'upright').length
  const reversedCount = cards.length - uprightCount
  const dominant = uprightCount >= reversedCount ? '积极' : '挑战'

  const mainCard = cards[cards.length - 1]
  const mainKeyword = mainCard.card.keywords[0]

  let summaryBody = ''
  if (category === 'love') {
    summaryBody = `关于你的感情问题「${question}」，从牌面整体来看，${dominant}的能量占主导。${
      uprightCount >= reversedCount
        ? '整体趋势向好，建议你保持开放和真诚的态度。'
        : '虽然面临一些挑战，但逆位牌也暗示着成长的机会，勇敢面对问题才能突破。'
    }${mainCard.card.name}作为关键牌，提醒你关注「${mainKeyword}」的力量。`
  } else if (category === 'career') {
    summaryBody = `关于你的事业问题「${question}」，牌面呈现${dominant}的态势。${
      uprightCount >= reversedCount
        ? '发展方向是积极的，抓住机遇，脚踏实地前行。'
        : '前路有阻碍，但这也是审视自身策略的好时机，调整方向后更能走稳。'
    }关键在于「${mainKeyword}」——${mainCard.card.name}给你的启示。`
  } else if (category === 'study') {
    summaryBody = `关于你的学业问题「${question}」，整体牌面${dominant}。${
      uprightCount >= reversedCount
        ? '学习状态良好，持续努力会有回报。'
        : '可能遇到瓶颈，不妨换个方法或寻求帮助，逆位牌暗示突破需要新的视角。'
    }记住「${mainKeyword}」的力量——这是${mainCard.card.name}给你的指引。`
  } else {
    summaryBody = `关于「${question}」，牌面整体呈现${dominant}的能量。${
      uprightCount >= reversedCount
        ? '积极的力量引导你前行，保持信心和行动力。'
        : '挑战虽然存在，但每张逆位牌都在提醒你需要调整的方面，勇敢面对才能转逆为顺。'
    }让「${mainKeyword}」成为你的指引——这是${mainCard.card.name}给你的启示。`
  }

  return `\n\n✨ 综合解读（本地补充）\n${summaryBody}`
}

/**
 * 生成综合总结
 */
function generateSummary(question: string, cards: DrawnCard[], category: string): string {
  const uprightCount = cards.filter((c) => c.orientation === 'upright').length
  const reversedCount = cards.length - uprightCount
  const dominant = uprightCount >= reversedCount ? '积极' : '挑战'

  const mainCard = cards[cards.length - 1] // 最后一张通常是"结果"或"未来"
  const mainKeyword = mainCard.card.keywords[0]

  if (category === 'love') {
    return `关于你的感情问题「${question}」，从牌面整体来看，${dominant}的能量占主导。${
      uprightCount >= reversedCount
        ? '整体趋势向好，建议你保持开放和真诚的态度。'
        : '虽然面临一些挑战，但逆位牌也暗示着成长的机会，勇敢面对问题才能突破。'
    }${mainCard.card.name}作为关键牌，提醒你关注「${mainKeyword}」的力量。`
  } else if (category === 'career') {
    return `关于你的事业问题「${question}」，牌面呈现${dominant}的态势。${
      uprightCount >= reversedCount
        ? '发展方向是积极的，抓住机遇，脚踏实地前行。'
        : '前路有阻碍，但这也是审视自身策略的好时机，调整方向后更能走稳。'
    }关键在于「${mainKeyword}」——${mainCard.card.name}给你的启示。`
  } else if (category === 'study') {
    return `关于你的学业问题「${question}」，整体牌面${dominant}。${
      uprightCount >= reversedCount
        ? '学习状态良好，持续努力会有回报。'
        : '可能遇到瓶颈，不妨换个方法或寻求帮助，逆位牌暗示突破需要新的视角。'
    }记住「${mainKeyword}」的力量——这是${mainCard.card.name}给你的指引。`
  } else {
    return `关于「${question}」，牌面整体呈现${dominant}的能量。${
      uprightCount >= reversedCount
        ? '积极的力量引导你前行，保持信心和行动力。'
        : '挑战虽然存在，但每张逆位牌都在提醒你需要调整的方面，勇敢面对才能转逆为顺。'
    }让「${mainKeyword}」成为你的指引——这是${mainCard.card.name}给你的启示。`
  }
}

/**
 * 后端分层健康状态
 */
export interface BackendStatus {
  /** 整体状态: ok | degraded | error */
  status: 'checking' | 'ok' | 'degraded' | 'error'
  /** Worker 是否可用 */
  worker: 'up' | 'down'
  /** Gemini 是否可用 */
  gemini: 'up' | 'down' | 'unconfigured' | 'unknown'
}

/**
 * 检测后台服务分层健康状态
 * 请求 GET /health 端点，返回 worker 和 gemini 各自的可用性
 */
export async function checkBackendHealth(): Promise<BackendStatus> {
  if (!API_URL) {
    return { status: 'error', worker: 'down', gemini: 'unknown' }
  }

  try {
    const res = await uni.request({
      url: `${API_URL}/health`,
      method: 'GET',
      timeout: 5000,
    })

    if (res.statusCode !== 200) {
      return { status: 'error', worker: 'up', gemini: 'unconfigured' }
    }

    const data = res.data as { status?: string; worker?: string; gemini?: string }
    return {
      status: data.status || 'error',
      worker: data.worker || 'down',
      gemini: data.gemini || 'unknown',
    }
  } catch {
    return { status: 'error', worker: 'down', gemini: 'unknown' }
  }
}

/**
 * 根据问题关键词检测问题类别
 */
function detectCategory(question: string): 'love' | 'career' | 'study' | 'general' {
  const loveKeywords = ['感情', '爱情', '恋爱', '恋人', '对象', '男朋友', '女朋友', '老公', '老婆', '复合', '分手', '暗恋', '暧昧', '婚姻', '结婚', '桃花', '姻缘']
  const careerKeywords = ['事业', '工作', '职场', '升职', '跳槽', '面试', '创业', '薪资', '老板', '同事', '项目', '合作']
  const studyKeywords = ['学业', '考试', '学习', '考研', '高考', '考公', '留学', '成绩', '复习', '升学']

  if (loveKeywords.some((k) => question.includes(k))) return 'love'
  if (careerKeywords.some((k) => question.includes(k))) return 'career'
  if (studyKeywords.some((k) => question.includes(k))) return 'study'
  return 'general'
}
