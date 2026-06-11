// ========== 海报生成 - 小程序端 (Canvas 2x 绘制) ==========

import type { PosterData, PosterResult, PosterCard } from './types'

/** 海报基础宽度 (设计稿) */
const POSTER_W = 750
/** 绘制缩放比 (2x 高清) */
const SCALE = 2

/** 颜色常量 */
const COLORS = {
  bg: '#0f0f23',
  gold: '#c9a96e',
  textSecondary: '#a89b8c',
  textMuted: '#6b5e53',
  textLight: '#e8d5b7',
  textBody: '#c4b8a8',
  summaryBg: '#1a1a3e',
}

/** 花色渐变 */
const CARD_GRADIENTS: Record<string, [string, string]> = {
  major: ['#3a1c61', '#1a0a3e'],
  wands: ['#6b3a1f', '#2e1508'],
  cups: ['#1e4d7b', '#0a1a3a'],
  swords: ['#4a5568', '#1a202c'],
  pentacles: ['#1e5c3a', '#0a1f12'],
}

/** 花色边框色 */
const CARD_BORDERS: Record<string, string> = {
  major: 'rgba(201,169,110,0.25)',
  wands: 'rgba(230,126,34,0.25)',
  cups: 'rgba(52,152,219,0.25)',
  swords: 'rgba(160,174,192,0.25)',
  pentacles: 'rgba(46,204,113,0.25)',
}

/** 花色符号 */
const SUIT_SYMBOLS: Record<string, string> = {
  major: '★',
  wands: '🪄',
  cups: '🏆',
  swords: '⚔️',
  pentacles: '🪙',
}

/** 罗马数字 */
const ROMAN_NUMERALS = [
  '0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
]

/** 将 PosterData 转为 PosterCard[] */
function toPosterCards(data: PosterData): PosterCard[] {
  return data.cards.map((item) => ({
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
}

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

/** 文本换行 */
function wrapText(
  ctx: ReturnType<typeof uni.createCanvasContext>,
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i]
    const metrics = (ctx as any).measureText?.(testLine)
    const w = metrics?.width ?? testLine.length * fontSize * 0.6
    if (w > maxWidth && line.length > 0) {
      lines.push(line)
      line = text[i]
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)
  return lines
}

/** 圆角矩形路径 */
function roundRect(
  ctx: ReturnType<typeof uni.createCanvasContext>,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 渐变填充圆角矩形 */
function fillGradient(
  ctx: ReturnType<typeof uni.createCanvasContext>,
  x: number, y: number, w: number, h: number,
  r: number, colors: [string, string],
) {
  ctx.save()
  roundRect(ctx, x, y, w, h, r)
  ctx.clip()
  const gradient = (ctx as any).createLinearGradient?.(x, y, x + w, y + h)
  if (gradient) {
    gradient.addColorStop(0, colors[0])
    gradient.addColorStop(1, colors[1])
    ctx.setFillStyle(gradient)
  } else {
    ctx.setFillStyle(colors[0])
  }
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

/** 计算布局并绘制海报 */
export function generateMiniProgramPoster(
  canvasId: string,
  data: PosterData,
): Promise<PosterResult> {
  return new Promise((resolve, reject) => {
    const ctx = uni.createCanvasContext(canvasId)
    const cards = toPosterCards(data)
    const summaryText = extractSummary(data.interpretation || '')

    // --- 布局计算 ---
    const sideMargin = 60
    const availableW = POSTER_W - sideMargin * 2
    const cardGap = 16
    const rowGap = 24
    const maxCardW = 300
    const minCardW = 180

    // 动态列数
    let cols = Math.min(cards.length, 3)
    let cardW = (availableW - (cols - 1) * cardGap) / cols
    if (cardW < minCardW && cols > 1) {
      cols = 2
      cardW = (availableW - (cols - 1) * cardGap) / cols
    }
    cardW = Math.min(maxCardW, Math.max(minCardW, cardW))
    const cardH = Math.max(160, cardW * 1.45)
    const rows = Math.ceil(cards.length / cols)
    const totalW = cols * cardW + (cols - 1) * cardGap
    const startX = (POSTER_W - totalW) / 2

    // 字体适配
    const isNarrow = cardW < 250
    const nameFontSize = isNarrow ? 24 : 28
    const meaningFontSize = isNarrow ? 20 : 22
    const meaningLineHeight = isNarrow ? 26 : 30

    // 问题区域
    let questionH = 0
    if (data.question) {
      const qLines = wrapText(ctx, data.question, POSTER_W - 120, 24)
      questionH = qLines.length * 36
    }

    // 牌阵卡片起始 Y
    const cardAreaY = 280 + (data.question ? questionH + 40 : 0)
    const cardsBottomY = cardAreaY + rows * (cardH + rowGap) - rowGap

    // 综合解读区域
    let summaryH = 0
    let displaySummaryLines: string[] = []
    if (summaryText) {
      const summaryMaxW = POSTER_W - 100 - 48
      const summaryLines = wrapText(ctx, summaryText, summaryMaxW, 22)
      displaySummaryLines = summaryLines.slice(0, 20)
      summaryH = 32 + 50 + 12 + displaySummaryLines.length * 44 + 32
    }

    // 底部
    const summaryY = cardsBottomY + 40
    const footerY = summaryH > 0 ? summaryY + summaryH + 20 : cardsBottomY
    const actualPosterH = footerY + 120

    // --- 绘制 ---
    // 1. 背景
    ctx.setFillStyle(COLORS.bg)
    ctx.fillRect(0, 0, POSTER_W, actualPosterH)

    // 2. 顶部装饰线
    ctx.setFillStyle(COLORS.gold)
    ctx.fillRect(60, 80, POSTER_W - 120, 2)

    // 3. 标题
    ctx.setFillStyle(COLORS.gold)
    ctx.setFontSize(44)
    ctx.setTextAlign('center')
    ctx.fillText('🔮 塔罗牌占卜', POSTER_W / 2, 170)

    // 4. 牌阵名称
    ctx.setFillStyle(COLORS.textSecondary)
    ctx.setFontSize(28)
    ctx.fillText(data.spreadName, POSTER_W / 2, 220)

    // 5. 问题
    if (data.question) {
      ctx.setFillStyle(COLORS.textMuted)
      ctx.setFontSize(24)
      const qLines = wrapText(ctx, data.question, POSTER_W - 120, 24)
      qLines.forEach((line, i) => {
        ctx.fillText(line, POSTER_W / 2, 280 + i * 36)
      })
    }

    // 6. 牌阵卡片
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = startX + col * (cardW + cardGap)
      const cy = cardAreaY + row * (cardH + rowGap)
      const isReversed = card.orientation === 'reversed'
      const gradient = CARD_GRADIENTS[card.type] || CARD_GRADIENTS.major
      const borderColor = CARD_BORDERS[card.type] || CARD_BORDERS.major

      // 卡片背景
      fillGradient(ctx, cx, cy, cardW, cardH, 12, gradient)

      // 边框
      ctx.setStrokeStyle(borderColor)
      ctx.setLineWidth(2)
      roundRect(ctx, cx, cy, cardW, cardH, 12)
      ctx.stroke()

      // 占位符区域
      const placeholderCY = cy + cardH * 0.3
      const placeholderH = cardH * 0.35
      ctx.setFillStyle('rgba(0,0,0,0.15)')
      roundRect(ctx, cx + cardW * 0.15, placeholderCY - 20, cardW * 0.7, placeholderH + 40, 8)
      ctx.fill()

      // 数字
      ctx.setTextAlign('center')
      if (card.type === 'major') {
        ctx.setFillStyle('rgba(201,169,110,0.7)')
        ctx.setFontSize(Math.floor(cardW * 0.18))
        ctx.fillText(ROMAN_NUMERALS[card.number] || '', cx + cardW / 2, placeholderCY)
      } else {
        ctx.setFillStyle('rgba(232,213,183,0.5)')
        ctx.setFontSize(Math.floor(cardW * 0.22))
        const numMatch = card.name.match(/(\d+)$/)
        ctx.fillText(numMatch ? numMatch[1] : card.name.slice(-1), cx + cardW / 2, placeholderCY)
      }

      // 花色符号
      ctx.setFillStyle('rgba(201,169,110,0.4)')
      ctx.setFontSize(Math.floor(cardW * 0.16))
      ctx.fillText(SUIT_SYMBOLS[card.type] || '✦', cx + cardW / 2, placeholderCY + Math.floor(cardW * 0.14))

      // 逆位标记
      if (isReversed) {
        ctx.setFillStyle('rgba(220,100,80,0.8)')
        ctx.setFontSize(Math.floor(cardW * 0.13))
        ctx.fillText('▼ 逆位', cx + cardW / 2, placeholderCY + placeholderH + 30)
      }

      // 底部信息区
      const infoY = cy + cardH * 0.72
      const padding = 16

      ctx.setTextAlign('left')
      ctx.setFillStyle(COLORS.gold)
      ctx.setFontSize(18)
      ctx.fillText(card.position, cx + padding, infoY)

      ctx.setFillStyle(COLORS.textLight)
      ctx.setFontSize(nameFontSize)
      ctx.fillText(card.name, cx + padding, infoY + 28)

      ctx.setFillStyle(COLORS.gold)
      ctx.setFontSize(16)
      ctx.fillText(card.keywords.slice(0, 2).join(' · '), cx + padding, infoY + 52)

      // 解读文字
      ctx.setFillStyle(COLORS.textSecondary)
      ctx.setFontSize(meaningFontSize)
      const meaningMaxW = cardW - padding * 2
      const meaningLines = wrapText(ctx, card.meaning, meaningMaxW, meaningFontSize)
      const meaningMaxLines = Math.min(2, Math.floor((cardH - infoY - 52 - 8 - padding) / meaningLineHeight))
      meaningLines.slice(0, meaningMaxLines).forEach((line, li) => {
        ctx.fillText(line, cx + padding, infoY + 52 + 20 + li * meaningLineHeight)
      })
    }

    // 7. 综合解读
    if (summaryText && displaySummaryLines.length > 0) {
      const summaryCardW = POSTER_W - 100
      ctx.setFillStyle(COLORS.summaryBg)
      roundRect(ctx, 50, summaryY, summaryCardW, summaryH, 8)
      ctx.fill()

      // 金色左边框
      ctx.setFillStyle(COLORS.gold)
      ctx.fillRect(50, summaryY + 8, 4, summaryH - 16)

      // 标题
      ctx.setFillStyle(COLORS.gold)
      ctx.setFontSize(26)
      ctx.setTextAlign('left')
      ctx.fillText('✨ 综合解读', 50 + 32, summaryY + 32 + 30)

      // 正文
      ctx.setFillStyle(COLORS.textBody)
      ctx.setFontSize(22)
      displaySummaryLines.forEach((line, li) => {
        ctx.fillText(
          line,
          50 + 32,
          summaryY + 32 + 50 + 12 + li * 44 + 24,
        )
      })
    }

    // 8. 底部装饰
    ctx.setFillStyle(COLORS.gold)
    ctx.fillRect(60, footerY, POSTER_W - 120, 2)

    ctx.setFillStyle(COLORS.textMuted)
    ctx.setFontSize(22)
    ctx.setTextAlign('center')
    ctx.fillText('命运之轮 · 塔罗占卜', POSTER_W / 2, footerY + 50)
    ctx.fillText(data.date, POSTER_W / 2, footerY + 80)

    // 9. 绘制并导出（2x 高清）
    ctx.draw(false, () => {
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId,
          width: POSTER_W * SCALE,
          height: actualPosterH * SCALE,
          destWidth: POSTER_W * SCALE,
          destHeight: actualPosterH * SCALE,
          quality: 0.95,
          success: (res) => {
            resolve({
              url: res.tempFilePath,
              width: POSTER_W * SCALE,
              height: actualPosterH * SCALE,
            })
          },
          fail: (err) => {
            reject(err)
          },
        })
      }, 500)
    })
  })
}
