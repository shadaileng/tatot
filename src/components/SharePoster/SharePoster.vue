<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { DrawnCard } from '@/types'
import { generatePoster } from '@/utils/poster'
import type { PosterData } from '@/utils/poster'

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

/** 海报尺寸（用于模板 canvas 占位） */
const posterW = 750
const minPosterH = 1334

/** 使用统一海报生成入口 */
async function generatePosterImage() {
  if (posterReady.value) return

  try {
    const data: PosterData = {
      cards: props.cards,
      question: props.question,
      spreadName: props.spreadName,
      interpretation: props.interpretation,
      date: new Date().toLocaleDateString('zh-CN'),
    }

    const result = await generatePoster(data, { canvasId })
    posterUrl.value = result.url
    posterReady.value = true
  } catch (e) {
    console.error('生成海报失败:', e)
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
      nextTick(() => generatePosterImage())
    }
  },
)
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
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  -webkit-overflow-scrolling: touch;
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
  height: auto;
  border-radius: 0;
  display: block;
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
