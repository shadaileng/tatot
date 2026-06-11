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

/** 按宽度估算中文字符换行（每行约 28 个 22px 字体） */
function estimateLines(text: string, charsPerLine: number = 28): number {
  return Math.ceil(text.length / charsPerLine)
}

/** 生成海报 HTML — 使用正常文档流 flex 布局，避免 absolute 定位导致的压缩问题 */
function buildPosterHTML(data: PosterData, cards: PosterCard[]): string {
  const summaryText = extractSummary(data.interpretation || '')
  const cardCount = cards.length

  // 动态网格参数
  const cols = Math.min(cardCount, 3)
  const cardGap = 16
  const rowGap = 24
  const sideMargin = 60
  const availableW = POSTER_W - sideMargin * 2
  const cardW = Math.min(300, Math.max(180, (availableW - (cols - 1) * cardGap) / cols))
  const cardH = Math.max(160, cardW * 1.45)

  // 卡片 HTML — 使用 flex 文档流，不用 absolute
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
        overflow:hidden;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        flex-shrink:0;
      ">
        <!-- 占位符区域 -->
        <div style="
          background:rgba(0,0,0,0.15); border-radius:8px;
          margin:12px 15% 0;
          flex:1;
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          min-height:0;
        ">
          <div style="font-size:${Math.floor(cardW * 0.18)}px; color:rgba(201,169,110,0.7); font-weight:bold; font-family:Georgia,serif; line-height:1;">
            ${escapeHtml(numDisplay)}
          </div>
          <div style="font-size:${Math.floor(cardW * 0.16)}px; color:rgba(201,169,110,0.4); margin-top:4px; line-height:1;">
            ${style.symbol}
          </div>
          ${isReversed ? `<div style="font-size:${Math.floor(cardW * 0.13)}px; color:rgba(220,100,80,0.8); margin-top:4px; font-weight:bold; line-height:1;">▼ 逆位</div>` : ''}
        </div>
        <!-- 底部信息 -->
        <div style="
          padding:12px 16px;
          background:rgba(0,0,0,0.3);
          flex-shrink:0;
        ">
          <div style="font-size:18px; color:#c9a96e; font-weight:bold; line-height:1.3;">${escapeHtml(card.position)}</div>
          <div style="font-size:24px; color:#e8d5b7; font-weight:bold; margin-top:4px; line-height:1.3;">${escapeHtml(card.name)}</div>
          <div style="font-size:16px; color:#c9a96e; margin-top:2px; line-height:1.3;">${escapeHtml(card.keywords.slice(0, 2).join(' · '))}</div>
          <div style="font-size:20px; color:#a89b8c; margin-top:4px; line-height:1.4;">${escapeHtml(meaning)}</div>
        </div>
      </div>
    `
  }

  // 综合解读 HTML
  const summaryHtml = summaryText
    ? `
    <div style="
      width:100%;
      background:${COLORS.summaryBg};
      border-radius:8px;
      padding:32px;
      border-left:4px solid ${COLORS.gold};
      box-sizing:border-box;
      margin-top:40px;
    ">
      <div style="font-size:26px; color:#c9a96e; font-weight:bold; margin-bottom:16px; line-height:1.3;">✨ 综合解读</div>
      <div style="font-size:22px; color:#c4b8a8; line-height:2; word-break:break-all;">
        ${escapeHtml(summaryText.slice(0, 800))}${summaryText.length > 800 ? '...' : ''}
      </div>
    </div>
    `
    : ''

  return `
  <div id="poster-html-container" style="
    width:${POSTER_W}px;
    background:${COLORS.bg};
    font-family:sans-serif;
    box-sizing:border-box;
    padding:80px 60px 40px;
    color:#fff;
  ">
    <!-- 顶部装饰线 -->
    <div style="
      width:100%; height:2px;
      background:${COLORS.gold};
      margin-bottom:28px;
    "></div>
    <!-- 标题 -->
    <div style="
      text-align:center;
      font-size:44px; font-weight:bold; color:${COLORS.gold};
      line-height:1.3;
      margin-bottom:8px;
    ">🔮 塔罗牌占卜</div>
    <!-- 牌阵名称 -->
    <div style="
      text-align:center;
      font-size:28px; color:${COLORS.textSecondary};
      line-height:1.3;
      margin-bottom:16px;
    ">${escapeHtml(data.spreadName)}</div>
    <!-- 问题 -->
    ${data.question ? `
    <div style="
      text-align:center;
      font-size:24px; color:${COLORS.textMuted}; line-height:1.5;
      word-break:break-all;
      margin-bottom:24px;
    ">${escapeHtml(data.question)}</div>` : ''}
    <!-- 卡片网格 -->
    <div style="
      display:flex;
      flex-wrap:wrap;
      justify-content:center;
      gap:${rowGap}px ${cardGap}px;
      margin-top:8px;
    ">
      ${cardsHtml}
    </div>
    <!-- 综合解读 -->
    ${summaryHtml}
    <!-- 底部装饰 -->
    <div style="
      width:100%; height:2px;
      background:${COLORS.gold};
      margin-top:40px;
      margin-bottom:20px;
    "></div>
    <div style="
      text-align:center;
      font-size:22px; color:${COLORS.textMuted};
      line-height:1.5;
    ">命运之轮 · 塔罗占卜</div>
    <div style="
      text-align:center;
      font-size:22px; color:${COLORS.textMuted};
      line-height:1.5;
      margin-top:4px;
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

  // 创建临时容器 — 放在可视区域内但透明，确保 html2canvas 能正确计算布局
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -9999;
    opacity: 0.001;
    pointer-events: none;
    overflow: auto;
  `
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)

  try {
    const element = wrapper.querySelector('#poster-html-container') as HTMLElement
    if (!element) {
      throw new Error('Failed to create poster element')
    }

    // 等待字体和布局稳定
    await new Promise(resolve => setTimeout(resolve, 300))

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      // 显式传入宽高，确保截图区域覆盖整个元素
      x: 0,
      y: 0,
      width: element.scrollWidth,
      height: element.scrollHeight,
    })

    const url = canvas.toDataURL('image/png', 0.95)

    return {
      url,
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    // 清理临时 DOM
    document.body.removeChild(wrapper)
  }
}
