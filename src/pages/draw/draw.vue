<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { SpreadType } from '@/types'
import { spreadList, getSpread } from '@/data/spreads'
import { useTarotStore } from '@/store'
import { navTo } from '@/utils'
import TabBar from '@/components/TabBar/TabBar.vue'

const store = useTarotStore()
const selectedSpread = ref<SpreadType>('single')
const question = ref('')
const useAI = ref(true)

const currentSpread = computed(() => getSpread(selectedSpread.value))

// ========== 动画状态机 ==========
type AnimPhase = 'idle' | 'shuffle' | 'deal' | 'done'
const animPhase = ref<AnimPhase>('idle')
const shuffleCards = ref<number[]>([]) // 洗牌中的牌索引
const dealCards = ref<number[]>([])     // 已发牌到位置的索引

const cardCount = computed(() => currentSpread.value?.positions.length ?? 1)

const tabList = [
  { pagePath: 'pages/index/index', text: '首页' },
  { pagePath: 'pages/draw/draw', text: '抽牌' },
  { pagePath: 'pages/cards/cards', text: '牌库' },
  { pagePath: 'pages/history/history', text: '记录' },
]

function handleDraw() {
  if (animPhase.value !== 'idle') return

  // 触觉反馈
  // #ifdef MP-WEIXIN
  wx.vibrateShort({ type: 'medium' })
  // #endif

  // 1. 先抽牌（数据层面）
  store.drawCards(selectedSpread.value, question.value, useAI.value)

  // 2. 启动洗牌动画
  animPhase.value = 'shuffle'
  shuffleCards.value = Array.from({ length: Math.min(cardCount.value + 4, 10) }, (_, i) => i)

  // 洗牌 1.2s 后进入发牌阶段
  setTimeout(() => {
    animPhase.value = 'deal'
    dealCards.value = []

    // 依次发牌：每张间隔 300ms
    const total = cardCount.value
    let dealt = 0
    const dealTimer = setInterval(() => {
      dealCards.value = [...dealCards.value, dealt]
      dealt++
      if (dealt >= total) {
        clearInterval(dealTimer)
        // 发完停顿 600ms 后跳转
        setTimeout(() => {
          animPhase.value = 'done'
          navTo('/pages/result/result')
        }, 600)
      }
    }, 300)
  }, 1200)
}

function handleTabChange(path: string) {
  uni.switchTab({ url: '/' + path })
}
</script>

<template>
  <view class="page-container draw-page">
    <!-- ========== 动画遮罩层 ========== -->
    <view v-if="animPhase !== 'idle'" class="anim-overlay">
      <!-- 星空粒子背景 -->
      <view class="starfield">
        <view
          v-for="i in 30"
          :key="i"
          class="star-particle"
          :style="{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${1.5 + Math.random() * 2}s`,
            opacity: 0.3 + Math.random() * 0.7,
            width: `${2 + Math.random() * 4}rpx`,
            height: `${2 + Math.random() * 4}rpx`,
          }"
        />
      </view>

      <!-- 洗牌阶段 -->
      <view v-if="animPhase === 'shuffle'" class="anim-shuffle">
        <text class="shuffle-title">牌灵正在回应你的问题...</text>
        <view class="shuffle-deck">
          <view
            v-for="(_, i) in shuffleCards"
            :key="i"
            class="shuffle-card"
            :style="{
              animationDelay: `${i * 0.08}s`,
              transform: `rotate(${(i - shuffleCards.length / 2) * 6}deg) translateY(${Math.abs(i - shuffleCards.length / 2) * 8}rpx)`,
            }"
          >
            <view class="shuffle-card-inner">
              <text class="shuffle-star">★</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 发牌阶段 -->
      <view v-if="animPhase === 'deal' || animPhase === 'done'" class="anim-deal">
        <text class="deal-title">命运之轮正在转动...</text>
        <view class="deal-slots" :class="[`slots-${currentSpread?.type}`]">
          <view
            v-for="(pos, i) in currentSpread?.positions"
            :key="i"
            class="deal-slot"
            :class="{ dealt: dealCards.includes(i), dealing: i === dealCards.length }"
          >
            <view class="deal-card-placeholder">
              <view v-if="!dealCards.includes(i) && i !== dealCards.length" class="deal-empty">
                <text class="deal-empty-glow">✦</text>
              </view>
              <view v-else class="deal-card-back">
                <view class="deal-card-inner">
                  <text class="deal-card-icon">★</text>
                  <text class="deal-card-moon">☽</text>
                </view>
                <!-- 飞入动画的牌 -->
                <view
                  v-if="i === dealCards.length && animPhase === 'deal'"
                  class="deal-fly-card"
                >
                  <text class="fly-icon">★</text>
                </view>
              </view>
            </view>
            <text class="deal-pos-label">{{ pos }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 选择区域（动画时隐藏） ========== -->
    <template v-if="animPhase === 'idle'">
      <!-- 牌阵选择 -->
      <view class="spread-select">
        <text class="section-title">选择牌阵</text>
        <view class="spread-grid">
          <view
            v-for="spread in spreadList"
            :key="spread.type"
            class="spread-card"
            :class="{ active: selectedSpread === spread.type }"
            @click="selectedSpread = spread.type"
          >
            <text class="spread-card-name">{{ spread.name }}</text>
            <text class="spread-card-desc">{{ spread.positions.join(' · ') }}</text>
            <text class="spread-card-count">{{ spread.positions.length }} 张牌</text>
          </view>
        </view>
      </view>

      <!-- 问题 -->
      <view class="question-wrap">
        <view class="section-title-row">
          <text class="section-title">默想你的问题</text>
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
        <textarea
          v-model="question"
          class="question-textarea"
          placeholder="在心中默想你的问题，也可以写在这里..."
          placeholder-style="color: #6b5e53"
          maxlength="200"
          :auto-height="true"
        />
      </view>

      <!-- 牌阵预览 -->
      <view class="spread-preview">
        <text class="section-title">牌阵预览：{{ currentSpread?.name }}</text>
        <view class="preview-cards">
          <view
            v-for="(pos, i) in currentSpread?.positions"
            :key="i"
            class="preview-card-slot"
          >
            <view class="card-back-preview">
              <text class="card-back-star">★</text>
            </view>
            <text class="preview-pos">{{ pos }}</text>
          </view>
        </view>
      </view>

      <!-- 抽牌按钮 -->
      <view class="draw-action">
        <view class="btn-primary" @click="handleDraw">
          <text>🔮 开始抽牌</text>
        </view>
      </view>
    </template>

    <!-- 自定义底部导航 -->
    <TabBar :current-path="'pages/draw/draw'" :tabs="tabList" @change="handleTabChange" />
  </view>
</template>

<style lang="scss" scoped>
.draw-page {
  padding: 32rpx;
  position: relative;
  min-height: 100vh;
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

.spread-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.spread-card {
  background: $bg-card;
  border-radius: $radius-md;
  padding: 28rpx 32rpx;
  border: 2rpx solid transparent;
  transition: all $transition-fast;

  &.active {
    border-color: $accent-gold;
    background: rgba($accent-gold, 0.06);
  }
}

.spread-card-name {
  font-size: 32rpx;
  color: $text-primary;
  font-weight: 600;
}

.spread-card-desc {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-top: 8rpx;
}

.spread-card-count {
  font-size: 22rpx;
  color: $accent-gold;
  display: block;
  margin-top: 6rpx;
}

.question-wrap {
  margin-top: 40rpx;
}

.question-textarea {
  width: 100%;
  min-height: 120rpx;
  background: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx;
  font-size: 28rpx;
  color: $text-primary;
}

.spread-preview {
  margin-top: 40rpx;
}

.preview-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  justify-content: center;
}

.preview-card-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.card-back-preview {
  width: 100rpx;
  height: 150rpx;
  background: linear-gradient(135deg, $card-back-color, #3d2b6b);
  border-radius: $radius-sm;
  border: 2rpx solid $card-border-color;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-back-star {
  font-size: 36rpx;
  color: $accent-gold;
  opacity: 0.5;
}

.preview-pos {
  font-size: 22rpx;
  color: $text-muted;
}

.draw-action {
  margin-top: 60rpx;
  padding-bottom: 40rpx;

  .btn-primary {
    width: 100%;
    height: 96rpx;
    font-size: 34rpx;
  }
}

// ==========================================
// 动画遮罩层
// ==========================================
.anim-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $bg-primary;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

// 星空粒子
.starfield {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.star-particle {
  position: absolute;
  background: $accent-gold;
  border-radius: 50%;
  animation: starTwinkle 2s ease-in-out infinite alternate;
}

@keyframes starTwinkle {
  0% { opacity: 0.2; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1.2); }
}

// ========== 洗牌阶段 ==========
.anim-shuffle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 60rpx;
  z-index: 1;
}

.shuffle-title {
  font-size: 32rpx;
  color: $accent-gold;
  animation: textPulse 1.5s ease-in-out infinite;
}

@keyframes textPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.shuffle-deck {
  position: relative;
  width: 200rpx;
  height: 280rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shuffle-card {
  position: absolute;
  width: 140rpx;
  height: 210rpx;
  animation: shuffleMove 0.6s ease-in-out infinite alternate;
}

.shuffle-card-inner {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, $card-back-color, #3d2b6b);
  border-radius: $radius-sm;
  border: 2rpx solid rgba($accent-gold, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-md;
}

.shuffle-star {
  font-size: 48rpx;
  color: rgba($accent-gold, 0.5);
}

@keyframes shuffleMove {
  0% { transform: translateY(-6rpx); }
  100% { transform: translateY(6rpx); }
}

// ========== 发牌阶段 ==========
.anim-deal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 50rpx;
  z-index: 1;
  width: 100%;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.deal-title {
  font-size: 30rpx;
  color: $accent-gold;
  animation: textPulse 1.5s ease-in-out infinite;
}

.deal-slots {
  display: flex;
  gap: 24rpx;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;

  &.slots-single {
    .deal-slot { flex: 1; min-width: 200rpx; max-width: 240rpx; }
  }
  &.slots-three {
    .deal-slot { flex: 1; min-width: 180rpx; max-width: 220rpx; }
  }
  &.slots-celtic-cross {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20rpx 12rpx;
    max-width: 560rpx;
    margin: 0 auto;
  }
}

.deal-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  transition: all 0.4s ease;

  &.dealt .deal-card-back {
    border-color: rgba($accent-gold, 0.5);
    box-shadow: 0 0 24rpx rgba($accent-gold, 0.2);
  }
}

.deal-card-placeholder {
  width: 140rpx;
  height: 210rpx;
  position: relative;
}

.deal-empty {
  width: 100%;
  height: 100%;
  border: 2rpx dashed rgba($accent-gold, 0.15);
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.deal-empty-glow {
  font-size: 40rpx;
  color: rgba($accent-gold, 0.2);
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.1; transform: scale(0.9); }
  50% { opacity: 0.4; transform: scale(1.1); }
}

.deal-card-back {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, $card-back-color, #3d2b6b);
  border-radius: $radius-sm;
  border: 2rpx solid rgba($accent-gold, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: $shadow-md;
}

.deal-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.deal-card-icon {
  font-size: 48rpx;
  color: rgba($accent-gold, 0.5);
}

.deal-card-moon {
  font-size: 28rpx;
  color: rgba($accent-gold, 0.3);
}

// 飞入动画的牌
.deal-fly-card {
  position: absolute;
  top: -120rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 100rpx;
  height: 150rpx;
  background: linear-gradient(135deg, $card-back-color, #3d2b6b);
  border-radius: $radius-sm;
  border: 2rpx solid rgba($accent-gold, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-lg;
  animation: flyDown 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  z-index: 2;
}

.fly-icon {
  font-size: 36rpx;
  color: rgba($accent-gold, 0.7);
}

@keyframes flyDown {
  0% {
    top: -120rpx;
    opacity: 0;
    transform: translateX(-50%) rotate(-15deg) scale(0.5);
  }
  60% {
    opacity: 1;
    transform: translateX(-50%) rotate(3deg) scale(1.05);
  }
  100% {
    top: 50%;
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
  }
}

.deal-pos-label {
  font-size: 22rpx;
  color: $text-muted;
  text-align: center;
}

// 发牌完成后的强调
.deal-slot.dealt .deal-pos-label {
  color: $accent-gold;
}
</style>
