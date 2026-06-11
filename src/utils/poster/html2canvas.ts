// ========== 海报生成 - H5 端 (html2canvas) ==========

import html2canvas from 'html2canvas'
import type { PosterData, PosterResult, PosterCard } from './types'

/** 海报宽度 (设计稿 px) */
const POSTER_W = 750

/** 颜色常量 */
const COLORS = {
  bg: '#0f0f23',
  gold: '#c9a96e',
  textSecondary: '#a89b8c',
  textMuted: '#6b5e53',
  textLight: '#e8d5b7',
  textBody: '#c4b8a8',
  summaryBg: '#1a1a3e',
  cardMajor: '#3a1c61',
  cardWands: '#6b3a1f',
  cardCups: '#1e4d7b',
  cardSwords: '#4a5568',
  cardPentacles: '#1e5c3a',
  cardMajorEnd: '#1a0a3e',
  cardWandsEnd: '#2e1508',
  cardCupsEnd: '#0a1a3a',
  cardSwordsEnd: '#1a202c',
  cardPentaclesEnd: '#0a1f12',
}

/** 花色样式映射 */
const SUIT_STYLES: Record<string, { gradient: string; border: string; symbol: string }> = {
  major: {
    gradient: `linear-gradient(135deg, ${COLORS.cardMajor}, ${COLORS.cardMajorEnd})`,
    border: 'rgba(201,169,110,0.25)',
    symbol: '★',
  },
  wands: {
    gradient: `linear-gradient(135deg, ${COLORS.cardWands}, ${COLORS.cardWandsEnd})`,
    border: 'rgba(230,126,34,0.25)',
    symbol: '🪄',
  },
  cups: {
    gradient: `linear-gradient(135deg, ${COLORS.cardCups}, ${COLORS.cardCupsEnd})`,
    border: 'rgba(52,152,219,0.25)',
    symbol: '🏆',
  },
  swords: {
    gradient: `linear-gradient(135deg, ${COLORS.cardSwords}, ${COLORS.cardSwordsEnd})`,
    border: 'rgba(160,174,192,0.25)',
    symbol: '⚔️',
  },
  pentacles: {
    gradient: `linear-gradient(135deg, ${COLORS.cardPentacles}, ${COLORS.cardPentaclesEnd})`,
    border: 'rgba(46,204,113,0.25)',
    symbol: '🪙',
  },
}

/** 罗马数字 */
const ROMAN_NUMERALS = [
  '0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
]

/** 提取综合解读 */
function extractSummary(text: string): string {
  if (!text) return ''
  const patterns = [
    /✨\s*\**\s*综合解读\**/,
    /[*#]*\s*综合解读\s*[*#]*/,
    /【综合解读】/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const idx = match.index!
      const afterMarker = text.slice(idx + match[0].length)
      return afterMarker.replace(/^[：:\s\n]+/, '').trim()
    }
  }
  return ''
}

/** 转义 HTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 生成海报 HTML */
function buildPosterHTML(data: PosterData, cards: PosterCard[]): string {
  const summaryText = extractSummary(data.interpretation || '')
  const cardCount = cards.length

  // 动态网格
  const cols = Math.min(cardCount, 3)
  const cardGap = 16
  const rowGap = 24
  const sideMargin = 60
  const availableW = POSTER_W - sideMargin * 2
  const cardW = Math.min(300, Math.max(180, (availableW - (cols - 1) * cardGap) / cols))
  const cardH = Math.max(160, cardW * 1.45)

  // 问题区高度
  const questionLines = data.question ? Math.ceil(data.question.length / 30) : 0
  const questionH = questionLines > 0 ? questionLines * 30 + 40 : 0

  // 综合解读
  const summaryH = summaryText ? Math.min(summaryText.length, 800) / 20 * 36 + 120 : 0
  const rows = Math.ceil(cardCount / cols)
  const totalW = cols * cardW + (cols - 1) * cardGap

  // 卡片 HTML
  let cardsHtml = ''
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const isReversed = card.orientation === 'reversed'
    const style = SUIT_STYLES[card.type] || SUIT_STYLES.major
    const numDisplay = card.type === 'major'
      ? (ROMAN_NUMERALS[card.number] || '')
      : ((card.name.match(/(\d+)$/) || [])[1] || card.name.slice(-1))
    const meaning = card.meaning.length > 30 ? card.meaning.slice(0, 30) + '...' : card.meaning

    cardsHtml += `
      <div style="
        width:${cardW}px; height:${cardH}px;
        background:${style.gradient};
        border:2px solid ${style.border};
        border-radius:12px;
        position:absolute;
        left:${(POSTER_W - totalW) / 2 + (i % cols) * (cardW + cardGap)}px;
        top:${320 + questionH + Math.floor(i / cols) * (cardH + rowGap)}px;
        overflow:hidden;
        box-sizing:border-box;
      ">
        <!-- 占位符 -->
        <div style="
          background:rgba(0,0,0,0.15); border-radius:8px;
          position:absolute; left:15%; top:${cardH * 0.3 - 20}px;
          width:70%; height:${cardH * 0.35 + 40}px;
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
        ">
          <div style="font-size:${Math.floor(cardW * 0.18)}px; color:rgba(201,169,110,0.7); font-weight:bold; font-family:Georgia,serif;">
            ${escapeHtml(numDisplay)}
          </div>
          <div style="font-size:${Math.floor(cardW * 0.16)}px; color:rgba(201,169,110,0.4); margin-top:4px;">
            ${style.symbol}
          </div>
          ${isReversed ? `<div style="font-size:${Math.floor(cardW * 0.13)}px; color:rgba(220,100,80,0.8); margin-top:4px; font-weight:bold;">▼ 逆位</div>` : ''}
        </div>
        <!-- 底部信息 -->
        <div style="
          position:absolute; bottom:0; left:0; right:0;
          padding:12px 16px;
          background:rgba(0,0,0,0.3);
        ">
          <div style="font-size:18px; color:#c9a96e; font-weight:bold;">${escapeHtml(card.position)}</div>
          <div style="font-size:24px; color:#e8d5b7; font-weight:bold; margin-top:4px;">${escapeHtml(card.name)}</div>
          <div style="font-size:16px; color:#c9a96e; margin-top:2px;">${escapeHtml(card.keywords.slice(0, 2).join(' · '))}</div>
          <div style="font-size:20px; color:#a89b8c; margin-top:4px; line-height:1.4;">${escapeHtml(meaning)}</div>
        </div>
      </div>
    `
  }

  // 综合解读 HTML
  const summaryHtml = summaryText
    ? `
    <div style="
      position:absolute;
      left:50px; top:${320 + questionH + rows * (cardH + rowGap) - rowGap + 40}px;
      width:${POSTER_W - 100}px;
      background:${COLORS.summaryBg};
      border-radius:8px;
      padding:32px;
      border-left:4px solid ${COLORS.gold};
      box-sizing:border-box;
    ">
      <div style="font-size:26px; color:#c9a96e; font-weight:bold; margin-bottom:16px;">✨ 综合解读</div>
      <div style="font-size:22px; color:#c4b8a8; line-height:2; word-break:break-all;">
        ${escapeHtml(summaryText.slice(0, 800))}${summaryText.length > 800 ? '...' : ''}
      </div>
    </div>
    `
    : ''

  const footerTop = 320 + questionH + rows * (cardH + rowGap) - rowGap + 40 + summaryH + 20
  const posterH = footerTop + 120

  return `
  <div id="poster-html-container" style="
    position:fixed; left:-9999px; top:0;
    width:${POSTER_W}px; height:${posterH}px;
    background:${COLORS.bg};
    font-family:sans-serif;
    overflow:hidden;
    box-sizing:border-box;
  ">
    <!-- 顶部装饰线 -->
    <div style="
      position:absolute; left:60px; top:80px;
      width:${POSTER_W - 120}px; height:2px;
      background:${COLORS.gold};
    "></div>
    <!-- 标题 -->
    <div style="
      position:absolute; left:0; right:0; top:110px;
      text-align:center;
      font-size:44px; font-weight:bold; color:${COLORS.gold};
    ">🔮 塔罗牌占卜</div>
    <!-- 牌阵名称 -->
    <div style="
      position:absolute; left:0; right:0; top:180px;
      text-align:center;
      font-size:28px; color:${COLORS.textSecondary};
    ">${escapeHtml(data.spreadName)}</div>
    <!-- 问题 -->
    ${data.question ? `
    <div style="
      position:absolute; left:60px; right:60px; top:240px;
      text-align:center;
      font-size:24px; color:${COLORS.textMuted}; line-height:1.5;
      word-break:break-all;
    ">${escapeHtml(data.question)}</div>` : ''}
    <!-- 卡片 -->
    ${cardsHtml}
    <!-- 综合解读 -->
    ${summaryHtml}
    <!-- 底部装饰 -->
    <div style="
      position:absolute; left:60px; top:${footerTop}px;
      width:${POSTER_W - 120}px; height:2px;
      background:${COLORS.gold};
    "></div>
    <div style="
      position:absolute; left:0; right:0; top:${footerTop + 40}px;
      text-align:center;
      font-size:22px; color:${COLORS.textMuted};
    ">命运之轮 · 塔罗占卜</div>
    <div style="
      position:absolute; left:0; right:0; top:${footerTop + 70}px;
      text-align:center;
      font-size:22px; color:${COLORS.textMuted};
    ">${escapeHtml(data.date)}</div>
  </div>
  `
}

/** 生成 H5 海报 */
export async function generateH5Poster(data: PosterData): Promise<PosterResult> {
  const cards: PosterCard[] = data.cards.map((item) => ({
    name: item.card.name,
    image: item.card.image,
    position: item.position,
    orientation: item.orientation,
    meaning: item.orientation === 'reversed'
      ? item.card.reversedMeaning
      : item.card.uprightMeaning,
    keywords: item.card.keywords,
    type: item.card.type,
    number: item.card.number,
  }))

  const html = buildPosterHTML(data, cards)

  // 创建临时容器
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const element = container.querySelector('#poster-html-container') as HTMLElement
    if (!element) {
      throw new Error('Failed to create poster element')
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    })

    const url = canvas.toDataURL('image/png', 0.95)

    return {
      url,
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    // 清理临时 DOM
    document.body.removeChild(container)
  }
}
