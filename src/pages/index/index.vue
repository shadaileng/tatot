<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { SpreadType } from '@/types'
import { spreadList } from '@/data/spreads'
import { useTarotStore } from '@/store'
import { navTo } from '@/utils'
import { checkBackendHealth, type BackendStatus } from '@/services/reading'
import TabBar from '@/components/TabBar/TabBar.vue'

const store = useTarotStore()
const selectedSpread = ref<SpreadType>('single')
const question = ref('')
const useAI = ref(true)

// 后台分层健康状态
const backendStatus = ref<BackendStatus>({ status: 'checking', worker: 'down', gemini: 'unknown' })

// 用于 CSS class 的状态字符串：checking | ok | degraded | error
const backendClass = computed(() => backendStatus.value.status)

// 状态文字
const backendText = computed(() => {
  const s = backendStatus.value
  if (s.status === 'checking') return '正在检测服务...'
  if (s.worker === 'up' && s.gemini === 'up') return 'AI 服务已连接'
  if (s.worker === 'up' && s.gemini !== 'up') return 'AI 服务不可用，将使用本地解读'
  return '服务不可用，将使用本地解读'
})

// 星空粒子
const stars = ref<{ x: number; y: number; size: number; delay: number; duration: number; opacity: number }[]>([])
onMounted(async () => {
  stars.value = Array.from({ length: 40 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 3,
    delay: Math.random() * 4,
    duration: 2 + Math.random() * 3,
    opacity: 0.2 + Math.random() * 0.6,
  }))

  // 检测后台服务
  backendStatus.value = await checkBackendHealth()
})

const spreadIcons: Record<SpreadType, string> = {
  single: '🃏',
  three: '🎴',
  'celtic-cross': '✝️',
}

const tabList = [
  { pagePath: 'pages/index/index', text: '首页' },
  { pagePath: 'pages/draw/draw', text: '抽牌' },
  { pagePath: 'pages/cards/cards', text: '牌库' },
  { pagePath: 'pages/history/history', text: '记录' },
]

function handleDraw() {
  // 触觉反馈
  // #ifdef MP-WEIXIN
  wx.vibrateShort({ type: 'medium' })
  // #endif
  store.drawCards(selectedSpread.value, question.value, useAI.value)
  navTo('/pages/result/result')
}

function handleTabChange(path: string) {
  uni.switchTab({ url: '/' + path })
}
</script>

<template>
  <view class="page-container index-page">
    <!-- 星空背景粒子 -->
    <view class="starfield-bg">
      <view
        v-for="(star, i) in stars"
        :key="i"
        class="star-bg-particle"
        :style="{
          left: `${star.x}%`,
          top: `${star.y}%`,
          width: `${star.size * 2}rpx`,
          height: `${star.size * 2}rpx`,
          animationDelay: `${star.delay}s`,
          animationDuration: `${star.duration}s`,
          opacity: star.opacity,
        }"
      />
    </view>

    <!-- 顶部区域 -->
    <view class="hero-section">
      <view class="hero-glow" />
      <text class="hero-title">塔罗牌占卜</text>
      <text class="hero-subtitle">探索命运的神秘指引</text>
      <view class="hero-stars">
        <text class="star">✦</text>
        <text class="star">✦</text>
        <text class="star">✦</text>
      </view>
    </view>

    <!-- 后台服务状态 -->
    <view class="backend-status" :class="backendClass">
      <view class="status-dot" />
      <text class="status-text">{{ backendText }}</text>
    </view>

    <!-- 牌阵选择 -->
    <view class="spread-section">
      <text class="section-title">选择牌阵</text>
      <view class="spread-list">
        <view
          v-for="spread in spreadList"
          :key="spread.type"
          class="spread-item"
          :class="{ active: selectedSpread === spread.type }"
          @click="selectedSpread = spread.type"
        >
          <text class="spread-icon">{{ spreadIcons[spread.type] }}</text>
          <text class="spread-name">{{ spread.name }}</text>
          <text class="spread-count">{{ spread.positions.length }} 张牌</text>
        </view>
      </view>
    </view>

    <!-- 问题输入 -->
    <view class="question-section">
      <view class="section-title-row">
        <text class="section-title">你想问什么？（选填）</text>
        <view class="ai-toggle">
          <text class="ai-toggle-label">AI 解读</text>
          <switch
            :checked="useAI"
            color="#c9a96e"
            style="transform: scale(0.7);"
            @change="useAI = $event.detail.value"
          />
        </view>
      </view>
      <view class="question-input-wrap">
        <textarea
          v-model="question"
          class="question-input"
          placeholder="默想你的问题..."
          placeholder-style="color: #6b5e53"
          maxlength="200"
          :auto-height="true"
        />
        <text class="input-count">{{ question.length }}/200</text>
      </view>
    </view>

    <!-- 抽牌按钮 -->
    <view class="draw-btn-wrap">
      <view class="btn-primary draw-btn" @click="handleDraw">
        <text class="draw-btn-icon">🔮</text>
        <text class="draw-btn-text">开始占卜</text>
      </view>
    </view>

    <!-- 自定义底部导航 -->
    <TabBar :current-path="'pages/index/index'" :tabs="tabList" @change="handleTabChange" />
  </view>
</template>

<style lang="scss" scoped>
.index-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 40rpx;
  position: relative;
  overflow: hidden;
}

// 星空粒子背景
.starfield-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.star-bg-particle {
  position: absolute;
  background: $accent-gold;
  border-radius: 50%;
  animation: starFloat 3s ease-in-out infinite alternate;
}

@keyframes starFloat {
  0% { opacity: 0.1; transform: translateY(0) scale(0.8); }
  100% { opacity: 0.8; transform: translateY(-10rpx) scale(1.3); }
}

// 顶部
.hero-section {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0 80rpx;
  z-index: 1;
}

.hero-glow {
  position: absolute;
  top: 0;
  width: 400rpx;
  height: 400rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba($accent-purple, 0.3) 0%, transparent 70%);
  pointer-events: none;
}

.hero-title {
  font-size: 56rpx;
  font-weight: bold;
  color: $accent-gold;
  letter-spacing: 8rpx;
  position: relative;
  z-index: 1;
}

.hero-subtitle {
  font-size: 28rpx;
  color: $text-secondary;
  margin-top: 16rpx;
  letter-spacing: 4rpx;
  position: relative;
  z-index: 1;
}

.hero-stars {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
  position: relative;
  z-index: 1;
}

.star {
  font-size: 32rpx;
  color: $accent-gold-light;
  opacity: 0.6;
}

// 后台服务状态
.backend-status {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.3);
  margin-bottom: 32rpx;
  z-index: 1;
  position: relative;

  &.checking .status-dot { background: #f0ad4e; animation: statusPulse 1s infinite; }
  &.ok .status-dot { background: #5cb85c; }
  &.degraded .status-dot { background: #f0ad4e; }
  &.error .status-dot { background: #d9534f; }
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-text {
  font-size: 22rpx;
  color: $text-secondary;
}

@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

// 牌阵
.spread-section {
  width: 100%;
  margin-bottom: 40rpx;
  z-index: 1;
  position: relative;
}

.section-title {
  font-size: 30rpx;
  color: $text-secondary;
  display: block;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title-row .section-title {
  margin-bottom: 0;
}

.ai-toggle {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.ai-toggle-label {
  font-size: 22rpx;
  color: $accent-gold;
}

.spread-list {
  display: flex;
  gap: 20rpx;
}

.spread-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 16rpx;
  background: $bg-card;
  border-radius: $radius-md;
  border: 2rpx solid transparent;
  transition: all $transition-fast;

  &.active {
    border-color: $accent-gold;
    background: rgba($accent-gold, 0.08);
  }
}

.spread-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.spread-name {
  font-size: 28rpx;
  color: $text-primary;
  font-weight: 600;
}

.spread-count {
  font-size: 22rpx;
  color: $text-muted;
  margin-top: 6rpx;
}

// 问题
.question-section {
  width: 100%;
  margin-bottom: 48rpx;
  z-index: 1;
  position: relative;
}

.question-input-wrap {
  background: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx;
  position: relative;
}

.question-input {
  width: 100%;
  min-height: 100rpx;
  font-size: 28rpx;
  color: $text-primary;
  background: transparent;
}

.input-count {
  text-align: right;
  font-size: 22rpx;
  color: $text-muted;
  display: block;
  margin-top: 8rpx;
}

// 按钮
.draw-btn-wrap {
  width: 100%;
  padding-bottom: 60rpx;
  z-index: 1;
  position: relative;
}

.draw-btn {
  width: 100%;
  height: 100rpx;
  font-size: 36rpx;
  gap: 16rpx;
}

.draw-btn-icon {
  font-size: 40rpx;
}
</style>
