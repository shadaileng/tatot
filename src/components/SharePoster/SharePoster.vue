<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { DrawnCard } from '@/types'

const props = defineProps<{
  visible: boolean
  cards: DrawnCard[]
  question: string
  spreadName: string
  /** AI 综合解读全文（含各牌解读 + ✨ 综合解读部分） */
  interpretation?: string
}>()

const emit = defineEmits<{
  close: []
  share: [url: string]
}>()

const posterReady = ref(false)
const posterUrl = ref('')
const isSaving = ref(false)
const canvasId = 'share-poster-canvas'

// 海报尺寸
const posterW = 750
const minPosterH = 1334

/** 从 interpretation 中提取「✨ 综合解读」部分 */
function extractSummary(text: string): string {
  if (!text) return ''
  const marker = '✨ 综合解读'
  const idx = text.indexOf(marker)
  if (idx === -1) return ''
  const afterMarker = text.slice(idx + marker.length)
  // 去掉开头的换行/冒号等
  return afterMarker.replace(/^[：:\s\n]+/, '').trim()
}

/** 生成海报 */
async function generatePoster() {
  if (posterReady.value) return

  try {
    const ctx = uni.createCanvasContext(canvasId)

    // 动态海报高度（先预估最大值，背景铺满）
    const estimatedPosterH = minPosterH + 1200 // 给综合解读预留空间
    const posterH = estimatedPosterH

    // 1. 背景
    ctx.fillStyle = '#0f0f23'
    ctx.fillRect(0, 0, posterW, posterH)

    // 2. 顶部装饰线
    ctx.fillStyle = '#c9a96e'
    ctx.fillRect(60, 80, posterW - 120, 2)

    // 3. 标题
    ctx.fillStyle = '#c9a96e'
    ctx.font = 'bold 44px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🔮 塔罗牌占卜', posterW / 2, 170)

    // 4. 牌阵名称
    ctx.fillStyle = '#a89b8c'
    ctx.font = '28px sans-serif'
    ctx.fillText(props.spreadName, posterW / 2, 220)

    // 5. 问题
    if (props.question) {
      ctx.fillStyle = '#6b5e53'
      ctx.font = '24px sans-serif'
      // 换行处理
      const maxQWidth = posterW - 120
      const qLines = wrapText(ctx, props.question, maxQWidth, 24)
      qLines.forEach((line, i) => {
        ctx.fillText(line, posterW / 2, 280 + i * 36)
      })
    }

    // 6. 牌阵解读卡片区域（动态尺寸，确保不溢出画布）
    const cardAreaY = props.question ? 320 + 40 : 280
    const maxCardW = 300
    const minCardW = 180
    const cardGap = 16
    const rowGap = 24
    const sideMargin = 60
    const availableW = posterW - sideMargin * 2

    // 动态列数：最多3列，但保证卡片宽度≥minCardW
    let cols = Math.min(props.cards.length, 3)
    let cardW = (availableW - (cols - 1) * cardGap) / cols
    if (cardW < minCardW && cols > 1) {
      cols = 2
      cardW = (availableW - (cols - 1) * cardGap) / cols
    }
    cardW = Math.min(maxCardW, cardW)
    cardW = Math.max(minCardW, cardW)

    const rows = Math.ceil(props.cards.length / cols)

    // 动态计算卡片高度
    let cardH = cardW * 1.45
    cardH = Math.max(160, cardH) // 最小高度160

    const totalW = cols * cardW + (cols - 1) * cardGap
    const startX = (posterW - totalW) / 2

    // 窄卡片字体适配
    const isNarrow = cardW < 250
    const nameFontSize = isNarrow ? 24 : 28
    const meaningFontSize = isNarrow ? 20 : 22
    const meaningLineHeight = isNarrow ? 26 : 30

    for (let i = 0; i < props.cards.length; i++) {
      const item = props.cards[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = startX + col * (cardW + cardGap)
      const cy = cardAreaY + row * (cardH + rowGap)

      // 卡片背景
      ctx.fillStyle = '#16213e'
      roundRect(ctx, cx, cy, cardW, cardH, 12)
      ctx.fill()

      // 卡片边框
      ctx.strokeStyle = 'rgba(201,169,110,0.3)'
      ctx.lineWidth = 2
      roundRect(ctx, cx, cy, cardW, cardH, 12)
      ctx.stroke()

      // 根据卡片高度动态计算各元素的垂直位置
      const padding = 16
      const posY = cy + padding + 20      // 位置标签
      const nameY = posY + 32             // 牌名
      const oriY = nameY + 28             // 正逆位标签顶部
      const oriH = 24                     // 正逆位标签高度
      const kwY = oriY + oriH + 20        // 关键词
      const meaningStartY = kwY + 20      // 解读文字起始
      const meaningAvailableH = cardH - (meaningStartY - cy) - padding
      const meaningMaxLines = Math.max(1, Math.floor(meaningAvailableH / meaningLineHeight))

      // 位置标签
      ctx.fillStyle = '#c9a96e'
      ctx.font = 'bold 18px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(item.position, cx + padding, posY)

      // 牌名（动态字号）
      ctx.fillStyle = '#e8d5b7'
      ctx.font = `bold ${nameFontSize}px sans-serif`
      ctx.fillText(item.card.name, cx + padding, nameY)

      // 正逆位
      const isReversed = item.orientation === 'reversed'
      ctx.font = 'bold 16px sans-serif'
      const oriText = isReversed ? '逆位' : '正位'
      const oriW = ctx.measureText(oriText).width
      ctx.fillStyle = isReversed ? 'rgba(220,100,80,0.85)' : 'rgba(10,200,120,0.85)'
      roundRect(ctx, cx + padding, oriY, oriW + 14, oriH, 6)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText(oriText, cx + padding + oriW / 2 + 7, oriY + 17)

      // 关键词
      ctx.textAlign = 'left'
      ctx.fillStyle = '#c9a96e'
      ctx.font = '16px sans-serif'
      const kwText = item.card.keywords.slice(0, 3).join(' · ')
      ctx.fillText(kwText, cx + padding, kwY)

      // 解读文字（动态字号和行数限制，确保不超出卡片）
      ctx.fillStyle = '#a89b8c'
      ctx.font = `${meaningFontSize}px sans-serif`
      const meaning = isReversed ? item.card.reversedMeaning : item.card.uprightMeaning
      const meaningLines = wrapText(ctx, meaning, cardW - padding * 2, meaningFontSize)
      meaningLines.slice(0, meaningMaxLines).forEach((line, li) => {
        ctx.fillText(line, cx + padding, meaningStartY + li * meaningLineHeight)
      })
    }

    // 7. 综合解读区域（在牌阵卡片下方）
    const summaryText = extractSummary(props.interpretation || '')
    let summaryH = 0
    if (summaryText) {
      const summaryPadding = 32
      const summaryTitleH = 40
      const summaryLineH = 36
      const summaryCardW = posterW - 100
      const summaryMaxW = summaryCardW - 48 // 卡片内边距
      const summaryLines = wrapText(ctx, summaryText, summaryMaxW, 22)
      // 限制最多 20 行
      const displayLines = summaryLines.slice(0, 20)
      summaryH = summaryTitleH + 16 + displayLines.length * summaryLineH + summaryPadding * 2

      const summaryX = 50
      const summaryY = cardAreaY + rows * (cardH + rowGap) - rowGap + 40

      // 综合解读卡片背景
      ctx.fillStyle = '#1a1a3e'
      roundRect(ctx, summaryX, summaryY, summaryCardW, summaryH, 8)
      ctx.fill()

      // 金色左边框
      ctx.fillStyle = '#c9a96e'
      ctx.fillRect(summaryX, summaryY + 8, 4, summaryH - 16)

      // 标题：✨ 综合解读
      ctx.fillStyle = '#c9a96e'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('✨ 综合解读', summaryX + summaryPadding, summaryY + summaryPadding + 30)

      // 正文
      ctx.fillStyle = '#c4b8a8'
      ctx.font = '22px sans-serif'
      displayLines.forEach((line, li) => {
        ctx.fillText(
          line,
          summaryX + summaryPadding,
          summaryY + summaryPadding + summaryTitleH + 16 + li * summaryLineH + 22,
        )
      })

      // 如果行数超出限制，显示省略号
      if (summaryLines.length > 20) {
        ctx.fillStyle = '#6b5e53'
        ctx.font = '20px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText('... 更多解读请查看App', summaryX + summaryCardW - summaryPadding, summaryY + summaryH - 20)
      }
    }

    // 8. 底部装饰
    const cardsBottomY = cardAreaY + rows * (cardH + rowGap) - rowGap + 40
    const footerY = summaryH > 0 ? cardsBottomY + summaryH + 20 : cardsBottomY
    ctx.fillStyle = '#c9a96e'
    ctx.fillRect(60, footerY, posterW - 120, 2)

    // 8. 底部文字
    ctx.fillStyle = '#6b5e53'
    ctx.font = '22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('命运之轮 · 塔罗占卜', posterW / 2, footerY + 50)
    ctx.fillText(new Date().toLocaleDateString('zh-CN'), posterW / 2, footerY + 80)

    // 9. 实际海报高度
    const actualPosterH = footerY + 120

    // 10. 绘制完成
    ctx.draw(false, () => {
      // 导出图片
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId,
          width: posterW,
          height: actualPosterH,
          quality: 0.9,
          success: (res) => {
            posterUrl.value = res.tempFilePath
            posterReady.value = true
          },
          fail: (err) => {
            console.error('生成海报失败:', err)
          },
        })
      }, 500)
    })
  } catch (e) {
    console.error('生成海报异常:', e)
  }
}

/** 保存海报到相册 */
async function savePoster() {
  if (isSaving.value || !posterUrl.value) return
  isSaving.value = true
  try {
    // #ifdef MP-WEIXIN
    const setting = await uni.getSetting()
    if (!setting.authSetting['scope.writePhotosAlbum']) {
      await uni.authorize({ scope: 'scope.writePhotosAlbum' })
    }
    await uni.saveImageToPhotosAlbum({
      filePath: posterUrl.value,
      success: () => {
        uni.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          uni.showModal({
            title: '提示',
            content: '需要相册权限才能保存海报，请在设置中开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                uni.openSetting({})
              }
            },
          })
        } else {
          uni.showToast({ title: '保存失败', icon: 'error' })
        }
      },
    })
    // #endif

    // #ifdef H5
    const link = document.createElement('a')
    link.download = 'tarot-poster.png'
    link.href = posterUrl.value
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    uni.showToast({ title: '已开始下载', icon: 'success' })
    // #endif
  } catch (e) {
    console.error('保存海报失败:', e)
    uni.showToast({ title: '保存失败', icon: 'error' })
  } finally {
    isSaving.value = false
  }
}

/** 分享海报 */
function sharePoster() {
  if (!posterUrl.value) return
  // #ifdef MP-WEIXIN
  uni.showToast({ title: '请点击右上角菜单分享', icon: 'none' })
  emit('close')
  // #endif

  // #ifdef H5
  emit('share', posterUrl.value)
  // #endif
}

// 监听 visible 变化，自动生成
watch(
  () => props.visible,
  (val) => {
    if (val) {
      posterReady.value = false
      posterUrl.value = ''
      nextTick(() => generatePoster())
    }
  },
)

// 辅助：文本换行
function wrapText(ctx: any, text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i]
    const metrics = ctx.measureText ? ctx.measureText(testLine) : { width: testLine.length * fontSize }
    if (metrics.width > maxWidth && line.length > 0) {
      lines.push(line)
      line = text[i]
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)
  return lines
}

// 辅助：圆角矩形
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
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
</script>

<template>
  <view v-if="visible" class="poster-overlay" @click.self="emit('close')">
    <view class="poster-modal">
      <!-- 顶部栏 -->
      <view class="poster-header">
        <text class="poster-title">分享海报</text>
        <view class="poster-close" @click="emit('close')">
          <text>✕</text>
        </view>
      </view>

      <!-- 加载中 -->
      <view v-if="!posterReady" class="poster-loading">
        <view class="loading-spinner" />
        <text class="loading-text">正在生成海报...</text>
      </view>

      <!-- 海报图片 -->
      <image
        v-if="posterUrl"
        class="poster-image"
        :src="posterUrl"
        mode="widthFix"
      />

      <!-- Canvas 隐藏画布 -->
      <canvas
        :id="canvasId"
        canvas-id="share-poster-canvas"
        class="poster-canvas"
        :style="{ width: `${posterW}px`, height: `${minPosterH + 1200}px` }"
      />

      <!-- 操作按钮 -->
      <view v-if="posterReady" class="poster-actions">
        <view class="poster-btn save-btn" @click="savePoster">
          <text>{{ isSaving ? '保存中...' : '保存到相册' }}</text>
        </view>
        <view class="poster-btn share-btn" @click="sharePoster">
          <text>分享给好友</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.poster-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.poster-modal {
  width: 100%;
  max-width: 600rpx;
  max-height: 90vh;
  background: $bg-secondary;
  border-radius: $radius-lg;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.poster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba($accent-gold, 0.1);
}

.poster-title {
  font-size: 32rpx;
  color: $accent-gold;
  font-weight: bold;
}

.poster-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: $text-muted;
}

// 加载中
.poster-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid rgba($accent-gold, 0.2);
  border-top-color: $accent-gold;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: $text-muted;
}

// 海报图片
.poster-image {
  width: 100%;
  max-height: 60vh;
  border-radius: 0;
}

// 隐藏 canvas
.poster-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}

// 操作按钮
.poster-actions {
  display: flex;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  border-top: 1rpx solid rgba($accent-gold, 0.1);
}

.poster-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-md;
  font-size: 28rpx;
  font-weight: 600;
  transition: all $transition-fast;

  &:active {
    opacity: 0.8;
    transform: scale(0.96);
  }
}

.save-btn {
  background: linear-gradient(135deg, $accent-gold, #b8943f);
  color: #1a1a2e;
}

.share-btn {
  background: transparent;
  color: $accent-gold;
  border: 2rpx solid $accent-gold;
}
</style>
