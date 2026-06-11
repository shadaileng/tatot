<script setup lang="ts">
import { computed, ref, reactive, watch, nextTick } from 'vue'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useTarotStore } from '@/store'
import { navTo, navBack } from '@/utils'
import CardDetail from '@/components/CardDetail/CardDetail.vue'
import SharePoster from '@/components/SharePoster/SharePoster.vue'
import type { TarotCard, CardOrientation } from '@/types'

const store = useTarotStore()
const reading = computed(() => store.currentReading)

const flippedCards = ref<Set<number>>(new Set())
const allFlipped = computed(() => flippedCards.value.size === (reading.value?.cards.length ?? 0))
const flipQueue = ref<number[]>([])
const isFlipping = ref(false)

// 图片加载状态
const imgLoaded = reactive<Record<number, boolean>>({})

function onImgLoad(index: number) {
  imgLoaded[index] = true
}

function onImgError(index: number) {
  imgLoaded[index] = false
}

// 牌面详情弹窗
const detailVisible = ref(false)
const detailCard = ref<TarotCard | null>(null)
const detailOrientation = ref<CardOrientation>('upright')
const detailAiMeaning = ref('')

/** 从 interpretation 中提取指定牌的 AI 解读段落 */
function extractCardAiMeaning(cardName: string, position: string): string {
  const interpretation = reading.value?.interpretation
  if (!interpretation) return ''

  // 尝试匹配 "📍 位置：XXX" 模式的段落
  const posPattern = new RegExp(`📍\\s*位置[：:]\\s*${escapeRegex(position)}[\\s\\S]*?(?=\\n📍|\\n✨|$)`, 'i')
  const match = interpretation.match(posPattern)
  if (match) return match[0].trim()

  // 回退：匹配包含牌名的段落
  const namePattern = new RegExp(`[^\\n]*${escapeRegex(cardName)}[^\\n]*(?:\\n[^📍✨][^\\n]*)*`, 'i')
  const nameMatch = interpretation.match(namePattern)
  if (nameMatch) return nameMatch[0].trim()

  // 最终回退：返回整个解读
  return interpretation
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 分享海报弹窗
const posterVisible = ref(false)

function openDetail(card: TarotCard, orientation: CardOrientation) {
  detailCard.value = card
  detailOrientation.value = orientation
  // 从 reading 中查找该牌的 position
  const drawnItem = reading.value?.cards.find((c) => c.card.id === card.id)
  detailAiMeaning.value = drawnItem ? extractCardAiMeaning(card.name, drawnItem.position) : ''
  detailVisible.value = true
}

function closeDetail() {
  detailVisible.value = false
}

// 依次翻牌动画
function flipSequentially() {
  const total = reading.value?.cards.length ?? 0
  if (total === 0) return
  isFlipping.value = true
  flipQueue.value = []
  let i = 0
  const timer = setInterval(() => {
    if (i >= total) {
      clearInterval(timer)
      isFlipping.value = false
      return
    }
    flipQueue.value.push(i)
    flippedCards.value = new Set([...flippedCards.value, i])
    i++
  }, 400)
}

function toggleFlip(index: number) {
  if (isFlipping.value) return
  const next = new Set(flippedCards.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
    // 触觉反馈
    // #ifdef MP-WEIXIN
    wx.vibrateShort({ type: 'light' })
    // #endif
  }
  flippedCards.value = next
}

function flipAll() {
  if (isFlipping.value) return
  const indices = reading.value?.cards.map((_, i) => i) ?? []
  flippedCards.value = new Set(indices)
}

function handleBack() {
  store.clearReading()
  navBack()
}

function handleNewReading() {
  store.clearReading()
  navTo('/pages/draw/draw')
}

// 页面进入时自动翻牌
watch(
  () => reading.value,
  (val) => {
    if (val) {
      flippedCards.value = new Set()
      nextTick(() => flipSequentially())
    }
  },
  { immediate: true },
)

// 全部翻完后自动获取 AI 解读
watch(allFlipped, (flipped) => {
  if (flipped && reading.value && !reading.value.interpretation) {
    store.fetchInterpretation()
  }
})

// ========== 微信分享 ==========
// #ifdef MP-WEIXIN
onShareAppMessage(() => {
  const cardNames = reading.value?.cards.map((c) => c.card.name).join('、') ?? ''
  return {
    title: `🔮 塔罗占卜：${cardNames}`,
    path: '/pages/index/index',
  }
})

onShareTimeline(() => {
  return {
    title: '🔮 塔罗牌占卜 - 探索命运的奥秘',
    query: '',
  }
})
// #endif
</script>

<template>
  <view class="page-container result-page">
    <template v-if="reading">
      <!-- 问题 -->
      <view v-if="reading.question" class="result-question">
        <text class="q-label">你的问题</text>
        <text class="q-text">{{ reading.question }}</text>
      </view>

      <!-- 凯尔特十字：5行3列矩阵布局 -->
      <!-- 布局：
      //         (空)         [5]上方(目标)       (空)          ← 行1
      //        [3]过去   [1]现状/[2]挑战(重叠)   [4]未来        ← 行2
      //         (空)        [6]下方(基础)       (空)          ← 行3
      //         (空)           [7]建议           (空)          ← 行4
      //      [8]外界影响    [9]希望与恐惧     [10]最终结果       ← 行5
      -->
      <view
        v-if="reading.spreadType === 'celtic-cross'"
        class="result-cards spread-celtic-cross"
      >
        <view class="cc-matrix">
          <!-- 行1 -->
          <view class="cc-cell"></view>
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-4" :style="{ animationDelay: '0.6s' }">
              <text class="card-position">{{ reading.cards[4].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(4), reversed: reading.cards[4].orientation === 'reversed' }" @click="toggleFlip(4)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[4].card, reading.cards[4].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[4] }" :src="reading.cards[4].card.image" mode="aspectFit" @load="onImgLoad(4)" @error="onImgError(4)" /><view class="card-image-placeholder" v-if="!imgLoaded[4]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[4].orientation"><text>{{ reading.cards[4].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[4].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="cc-cell"></view>

          <!-- 行2 -->
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-2" :style="{ animationDelay: '0.3s' }">
              <text class="card-position">{{ reading.cards[2].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(2), reversed: reading.cards[2].orientation === 'reversed' }" @click="toggleFlip(2)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[2].card, reading.cards[2].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[2] }" :src="reading.cards[2].card.image" mode="aspectFit" @load="onImgLoad(2)" @error="onImgError(2)" /><view class="card-image-placeholder" v-if="!imgLoaded[2]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[2].orientation"><text>{{ reading.cards[2].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[2].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <!-- 中心格：第1张(现状) + 第2张(挑战)重叠，向左上偏移 -->
          <view class="cc-cell cc-cell-center">
            <view class="result-card-item cc-card cc-pos-0" :style="{ animationDelay: '0s' }">
              <text class="card-position">{{ reading.cards[0].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(0), reversed: reading.cards[0].orientation === 'reversed' }" @click="toggleFlip(0)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[0].card, reading.cards[0].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[0] }" :src="reading.cards[0].card.image" mode="aspectFit" @load="onImgLoad(0)" @error="onImgError(0)" /><view class="card-image-placeholder" v-if="!imgLoaded[0]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[0].orientation"><text>{{ reading.cards[0].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[0].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
            <view class="result-card-item cc-card cc-pos-1" :style="{ animationDelay: '0.15s' }">
              <text class="card-position">{{ reading.cards[1].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(1), reversed: reading.cards[1].orientation === 'reversed' }" @click="toggleFlip(1)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[1].card, reading.cards[1].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[1] }" :src="reading.cards[1].card.image" mode="aspectFit" @load="onImgLoad(1)" @error="onImgError(1)" /><view class="card-image-placeholder" v-if="!imgLoaded[1]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[1].orientation"><text>{{ reading.cards[1].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[1].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-3" :style="{ animationDelay: '0.45s' }">
              <text class="card-position">{{ reading.cards[3].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(3), reversed: reading.cards[3].orientation === 'reversed' }" @click="toggleFlip(3)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[3].card, reading.cards[3].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[3] }" :src="reading.cards[3].card.image" mode="aspectFit" @load="onImgLoad(3)" @error="onImgError(3)" /><view class="card-image-placeholder" v-if="!imgLoaded[3]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[3].orientation"><text>{{ reading.cards[3].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[3].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 行3 -->
          <view class="cc-cell"></view>
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-5" :style="{ animationDelay: '0.75s' }">
              <text class="card-position">{{ reading.cards[5].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(5), reversed: reading.cards[5].orientation === 'reversed' }" @click="toggleFlip(5)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[5].card, reading.cards[5].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[5] }" :src="reading.cards[5].card.image" mode="aspectFit" @load="onImgLoad(5)" @error="onImgError(5)" /><view class="card-image-placeholder" v-if="!imgLoaded[5]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[5].orientation"><text>{{ reading.cards[5].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[5].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="cc-cell"></view>

          <!-- 行4：建议在基础正下方 -->
          <view class="cc-cell"></view>
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-6" :style="{ animationDelay: '0.9s' }">
              <text class="card-position">{{ reading.cards[6].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(6), reversed: reading.cards[6].orientation === 'reversed' }" @click="toggleFlip(6)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[6].card, reading.cards[6].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[6] }" :src="reading.cards[6].card.image" mode="aspectFit" @load="onImgLoad(6)" @error="onImgError(6)" /><view class="card-image-placeholder" v-if="!imgLoaded[6]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[6].orientation"><text>{{ reading.cards[6].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[6].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="cc-cell"></view>

          <!-- 行5：三种结果（外界影响、希望与恐惧、最终结果） -->
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-7" :style="{ animationDelay: '1.05s' }">
              <text class="card-position">{{ reading.cards[7].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(7), reversed: reading.cards[7].orientation === 'reversed' }" @click="toggleFlip(7)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[7].card, reading.cards[7].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[7] }" :src="reading.cards[7].card.image" mode="aspectFit" @load="onImgLoad(7)" @error="onImgError(7)" /><view class="card-image-placeholder" v-if="!imgLoaded[7]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[7].orientation"><text>{{ reading.cards[7].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[7].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-8" :style="{ animationDelay: '1.2s' }">
              <text class="card-position">{{ reading.cards[8].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(8), reversed: reading.cards[8].orientation === 'reversed' }" @click="toggleFlip(8)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[8].card, reading.cards[8].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[8] }" :src="reading.cards[8].card.image" mode="aspectFit" @load="onImgLoad(8)" @error="onImgError(8)" /><view class="card-image-placeholder" v-if="!imgLoaded[8]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[8].orientation"><text>{{ reading.cards[8].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[8].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view class="cc-cell">
            <view class="result-card-item cc-card cc-pos-9" :style="{ animationDelay: '1.35s' }">
              <text class="card-position">{{ reading.cards[9].position }}</text>
              <view class="flip-container" :class="{ flipped: flippedCards.has(9), reversed: reading.cards[9].orientation === 'reversed' }" @click="toggleFlip(9)">
                <view class="flip-inner">
                  <view class="card-back"><view class="card-back-pattern"><text class="card-back-star">★</text><text class="card-back-moon">☽</text></view><text class="tap-hint">点击翻开</text></view>
                  <view class="card-front" @click.stop="openDetail(reading.cards[9].card, reading.cards[9].orientation)">
                    <view class="card-image-wrap"><image class="card-image" :class="{ loaded: imgLoaded[9] }" :src="reading.cards[9].card.image" mode="aspectFit" @load="onImgLoad(9)" @error="onImgError(9)" /><view class="card-image-placeholder" v-if="!imgLoaded[9]"><text class="placeholder-icon">🃏</text></view><view class="card-badge" :class="reading.cards[9].orientation"><text>{{ reading.cards[9].orientation === 'upright' ? '正位' : '逆位' }}</text></view><view class="card-title-overlay"><text class="card-name-overlay">{{ reading.cards[9].card.name }}</text></view></view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 其他牌阵（单张、三牌）：通用布局 -->
      <view
        v-else
        class="result-cards"
        :class="[`spread-${reading.spreadType}`]"
      >
        <view
          v-for="(item, i) in reading.cards"
          :key="item.card.id"
          class="result-card-item"
          :style="{ animationDelay: `${i * 0.15}s` }"
        >
          <!-- 牌位置标签 -->
          <text class="card-position">{{ item.position }}</text>

          <!-- 3D 翻牌容器 -->
          <view
            class="flip-container"
            :class="{
              flipped: flippedCards.has(i),
              reversed: item.orientation === 'reversed',
            }"
            @click="toggleFlip(i)"
          >
            <view class="flip-inner">
              <!-- 牌背 -->
              <view class="card-back">
                <view class="card-back-pattern">
                  <text class="card-back-star">★</text>
                  <text class="card-back-moon">☽</text>
                </view>
                <text class="tap-hint">点击翻开</text>
              </view>

              <!-- 牌正面 -->
              <view class="card-front" @click.stop="openDetail(item.card, item.orientation)">
                <view class="card-image-wrap">
                  <image
                    class="card-image"
                    :class="{ loaded: imgLoaded[i] }"
                    :src="item.card.image"
                    mode="aspectFit"
                    @load="onImgLoad(i)"
                    @error="onImgError(i)"
                  />
                  <view class="card-image-placeholder" v-if="!imgLoaded[i]">
                    <text class="placeholder-icon">🃏</text>
                  </view>
                  <!-- 正逆位标签叠加在图片右上角 -->
                  <view class="card-badge" :class="item.orientation">
                    <text>{{ item.orientation === 'upright' ? '正位' : '逆位' }}</text>
                  </view>
                  <!-- 牌名叠加在图片底部 -->
                  <view class="card-title-overlay">
                    <text class="card-name-overlay">{{ item.card.name }}</text>
                  </view>
                </view>

                <!-- 底部精简信息 -->
                <view class="card-front-footer">
                  <view class="card-keywords-mini">
                    <text
                      v-for="kw in item.card.keywords.slice(0, 3)"
                      :key="kw"
                      class="keyword-dot"
                    >{{ kw }}</text>
                  </view>
                  <text class="tap-detail-hint">点击查看详细解读 →</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 全部翻开按钮 -->
      <view v-if="!allFlipped" class="flip-all-wrap">
        <view class="btn-secondary" @click="flipAll">
          <text>翻开全部牌</text>
        </view>
      </view>

      <!-- 解读总结 -->
      <view v-if="allFlipped" class="reading-summary">
        <text class="summary-title">✨ 牌阵解读</text>

        <!-- AI 个性化解读 -->
        <view v-if="reading.interpretation" class="ai-reading">
          <view class="ai-badge" :class="{ 'ai-badge-local': !reading.isAIInterpretation, 'ai-badge-partial': reading.isPartialAIInterpretation }">
            <text>{{ reading.isAIInterpretation ? (reading.isPartialAIInterpretation ? '🤖 AI 解读（综合部分本地补充）' : '🤖 AI 个性化解读') : '📖 智能解读' }}</text>
          </view>
          <view class="ai-reading-content">
            <text class="ai-reading-text">{{ reading.interpretation }}</text>
          </view>
        </view>

        <!-- AI 解读加载中 -->
        <view v-else-if="store.isLoadingInterpretation" class="ai-loading">
          <view class="loading-dots">
            <view class="dot"></view>
            <view class="dot"></view>
            <view class="dot"></view>
          </view>
          <text class="loading-text">正在为你解读牌面...</text>
        </view>

        <!-- 通用含义（始终展示，作为补充参考） -->
        <view class="summary-cards" :class="{ 'summary-collapsed': !!reading.interpretation }">
          <text class="summary-subtitle">📋 牌面含义参考</text>
          <view
            v-for="(item, i) in reading.cards"
            :key="i"
            class="summary-item"
          >
            <text class="summary-pos">{{ item.position }}</text>
            <text class="summary-name">
              {{ item.card.name }}
              <text :class="item.orientation === 'reversed' ? 'rev' : 'up'">
                ({{ item.orientation === 'upright' ? '正' : '逆' }})
              </text>
            </text>
            <text class="summary-meaning">
              {{ item.orientation === 'upright' ? item.card.uprightMeaning : item.card.reversedMeaning }}
            </text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="result-actions">
        <view class="btn-primary" @click="handleNewReading">
          <text>🔮 重新占卜</text>
        </view>
        <view class="btn-secondary" style="margin-top: 20rpx;" @click="posterVisible = true">
          <text>📤 生成分享海报</text>
        </view>
        <view class="btn-secondary" style="margin-top: 20rpx;" @click="handleBack">
          <text>返回首页</text>
        </view>
      </view>
    </template>

    <!-- 空状态 -->
    <template v-else>
      <view class="empty-state">
        <text class="empty-icon">🔮</text>
        <text class="empty-text">暂无占卜结果</text>
        <view class="btn-primary" @click="handleNewReading">
          <text>开始占卜</text>
        </view>
      </view>
    </template>

    <!-- 牌面详情弹窗 -->
    <CardDetail
      :visible="detailVisible"
      :card="detailCard"
      :orientation="detailOrientation"
      :ai-meaning="detailAiMeaning"
      @close="closeDetail"
    />

    <!-- 分享海报弹窗 -->
    <SharePoster
      v-if="reading"
      :visible="posterVisible"
      :cards="reading.cards"
      :question="reading.question"
      :spread-name="store.records[0]?.spreadName ?? ''"
      :interpretation="reading.interpretation"
      @close="posterVisible = false"
    />
  </view>
</template>

<style lang="scss" scoped>
.result-page {
  padding: 32rpx;
  padding-bottom: 120rpx;
}

// 问题
.result-question {
  background: $bg-card;
  border-radius: $radius-md;
  padding: 28rpx 32rpx;
  margin-bottom: 32rpx;
}

.q-label {
  font-size: 24rpx;
  color: $text-muted;
}

.q-text {
  display: block;
  font-size: 30rpx;
  color: $text-primary;
  margin-top: 8rpx;
}

// ========== 牌阵布局 ==========
.result-cards {
  display: flex;
  flex-direction: column;
  gap: 40rpx;

  // 单张牌阵 - 一行三列，卡牌放第二列
  &.spread-single {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24rpx;
    .result-card-item {
      flex: 1;
      min-width: 200rpx;
      max-width: 220rpx;
    }
    .flip-container, .flip-inner {
      min-height: 320rpx;
    }
    .card-image-wrap {
      height: 280rpx;
    }
  }

  // 三牌阵 - 横向排列
  &.spread-three {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24rpx;
    .result-card-item {
      flex: 1;
      min-width: 200rpx;
      max-width: 220rpx;
    }
    .flip-container, .flip-inner {
      min-height: 320rpx;
    }
    .card-image-wrap {
      height: 280rpx;
    }
    .card-name-overlay {
      font-size: 24rpx;
    }
    .card-badge {
      font-size: 18rpx;
      padding: 2rpx 10rpx;
    }
    .keyword-dot {
      font-size: 18rpx;
      padding: 2rpx 10rpx;
    }
    .tap-detail-hint {
      font-size: 18rpx;
    }
  }

  // 凯尔特十字 - 5行3列矩阵布局
  // 第1张（现状）和第2张（挑战）重叠在矩阵中心格，第2张旋转90°
  //
  //         (空)         [5]上方(目标)       (空)          ← 行1
  //        [3]过去   [1]现状/[2]挑战(重叠)   [4]未来        ← 行2
  //         (空)        [6]下方(基础)       (空)          ← 行3
  //         (空)           [7]建议           (空)          ← 行4
  //      [8]外界影响    [9]希望与恐惧     [10]最终结果       ← 行5
  &.spread-celtic-cross {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;

    .cc-matrix {
      display: grid;
      grid-template-columns: repeat(3, 180rpx);
      grid-template-rows: repeat(5, 240rpx);
      gap: 16rpx 12rpx;
      width: 100%;
      max-width: 600rpx;
      justify-content: center;
      padding: 0 8rpx;
      box-sizing: border-box;
    }

    .cc-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: 180rpx;
      height: 240rpx;
    }

    // 中心格：第0(现状)和第1(挑战)交叉重叠
    .cc-cell-center {
      position: relative;

      // 两张牌都绝对居中于格子
      .cc-card {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        margin: auto;
      }

      // 第1张(挑战)：旋转90°，叠在第0张上面
      .cc-pos-1 {
        z-index: 2;
        .flip-container {
          transform: rotate(90deg);
        }
        // "挑战"字样跟随牌面一起旋转，围绕卡牌中心旋转90度
        .card-position {
          transform: rotate(90deg);
          transform-origin: 75rpx 105rpx;
          left: 22rpx;
          top: 38rpx;
        }
      }

      // 第0张(现状)：z-index更低
      .cc-pos-0 {
        z-index: 1;
      }
    }

    .cc-card {
      width: 150rpx;
      height: 210rpx;
      overflow: visible !important;

      .flip-container, .flip-inner {
        min-width: 0;
        min-height: 0;
        width: 100%;
        height: 100%;
      }
      .card-image-wrap {
        height: 200rpx;
      }
      .card-front {
        padding: 6rpx;
      }
      .card-name-overlay {
        font-size: 18rpx;
      }
      .card-badge {
        font-size: 14rpx;
        padding: 2rpx 6rpx;
      }
      .keyword-dot {
        font-size: 14rpx;
        padding: 2rpx 6rpx;
      }
      .tap-detail-hint {
        font-size: 14rpx;
      }
      .card-keywords-mini {
        gap: 4rpx;
      }
      .card-position {
        font-size: 16rpx;
      }

      // 去掉底部空白
      .card-front-footer {
        padding: 6rpx 4rpx 0;
        gap: 2rpx;
      }
      .tap-detail-hint {
        display: none;
      }
    }
  }
}

.result-card-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
  overflow: hidden;
  position: relative;
  animation: fadeInUp 0.5s ease both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-position {
  position: absolute;
  top: 8rpx;
  left: 12rpx;
  font-size: 20rpx;
  color: #fff;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.55);
  padding: 4rpx 10rpx;
  border-radius: 10rpx;
  z-index: 10;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ========== 3D 翻牌容器 ==========
.flip-container {
  width: 100%;
  min-height: 400rpx;
  perspective: 1200px;
  cursor: pointer;

  &.flipped .flip-inner {
    transform: rotateY(180deg);
  }
}

.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400rpx;
  transition: transform 0.7s cubic-bezier(0.4, 0.0, 0.2, 1);
  transform-style: preserve-3d;
}

// 牌背 & 牌正面共享
.card-back, .card-front {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100%;
  height: auto;
  backface-visibility: hidden;
  border-radius: $radius-md;
  overflow: hidden;
}

// 牌背
.card-back {
  background: linear-gradient(135deg, $card-back-color, #3d2b6b);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba($accent-gold, 0.25);
}

.card-back-pattern {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 3rpx solid rgba($accent-gold, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  margin-bottom: 24rpx;
}

.card-back-star {
  font-size: 56rpx;
  color: rgba($accent-gold, 0.6);
}

.card-back-moon {
  font-size: 36rpx;
  color: rgba($accent-gold, 0.35);
}

.tap-hint {
  font-size: 26rpx;
  color: $text-muted;
}

// 牌正面（初始背面，翻转后可见）
.card-front {
  background: $bg-card;
  transform: rotateY(180deg);
  padding: 24rpx;
  box-shadow: $shadow-md;
  border: 2rpx solid rgba($accent-gold, 0.15);
}

// 逆位时牌正面旋转
.flip-container.reversed.flipped .card-front {
  .card-image-wrap {
    transform: rotate(180deg);
  }
}

.card-image-wrap {
  width: 100%;
  height: 420rpx;
  background: rgba(0,0,0,0.25);
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0;
  position: relative;
  overflow: hidden;
  transition: transform $transition-normal;
}

.card-image {
  width: 85%;
  height: 92%;
  position: absolute;
  opacity: 0;
  transition: opacity 0.3s ease;

  &.loaded {
    opacity: 1;
  }
}

.card-image-placeholder {
  position: absolute;
}

.placeholder-icon {
  font-size: 80rpx;
  opacity: 0.3;
}

// 正逆位标签 - 叠加在图片右上角
.card-badge {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  font-weight: 600;
  z-index: 2;

  &.upright {
    background: rgba(10, 200, 120, 0.85);
    color: #fff;
  }
  &.reversed {
    background: rgba(220, 100, 80, 0.85);
    color: #fff;
  }
}

// 牌名叠加在图片底部
.card-title-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40rpx 16rpx 12rpx;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  text-align: center;
  z-index: 2;
}

.card-name-overlay {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
}

// 底部精简区域
.card-front-footer {
  padding: 14rpx 8rpx 4rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.card-keywords-mini {
  display: flex;
  gap: 12rpx;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.keyword-dot {
  font-size: 20rpx;
  color: $accent-gold;
  background: rgba($accent-gold, 0.12);
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  white-space: nowrap;
}

.tap-detail-hint {
  font-size: 20rpx;
  color: $text-muted;
}

// ========== 解读总结 ==========
.reading-summary {
  margin-top: 48rpx;
  background: $bg-card;
  border-radius: $radius-md;
  padding: 32rpx;
  border: 1rpx solid rgba($accent-gold, 0.12);
}

.summary-title {
  font-size: 32rpx;
  color: $accent-gold;
  font-weight: bold;
  display: block;
  margin-bottom: 24rpx;
  text-align: center;
}

// AI 个性化解读
.ai-reading {
  margin-bottom: 28rpx;
}

.ai-badge {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  margin-bottom: 20rpx;

  &.ai-badge-local {
    background: linear-gradient(135deg, $accent-gold, #d97706);
  }

  &.ai-badge-partial {
    background: linear-gradient(135deg, #6366f1, #d97706);
  }
}

.ai-reading-content {
  background: rgba(139, 92, 246, 0.08);
  border-radius: $radius-sm;
  padding: 28rpx;
  border: 1rpx solid rgba(139, 92, 246, 0.15);
}

.ai-reading-text {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.8;
  white-space: pre-wrap;
}

// AI 加载中
.ai-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0;
  margin-bottom: 28rpx;
}

.loading-dots {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;

  .dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    background: $accent-gold;
    animation: dotPulse 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
}

@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.loading-text {
  font-size: 26rpx;
  color: $text-muted;
}

// 通用含义（折叠样式）
.summary-subtitle {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-bottom: 16rpx;
}

.summary-cards {
  display: flex;
  flex-direction: column;
  gap: 20rpx;

  &.summary-collapsed {
    padding-top: 20rpx;
    border-top: 1rpx solid rgba(255, 255, 255, 0.06);
  }
}

.summary-item {
  padding: 20rpx;
  background: rgba(0,0,0,0.15);
  border-radius: $radius-sm;
  border-left: 4rpx solid $accent-gold;
}

.summary-pos {
  font-size: 22rpx;
  color: $accent-gold;
  display: block;
  margin-bottom: 6rpx;
}

.summary-name {
  font-size: 28rpx;
  color: $text-primary;
  font-weight: 600;
  display: block;
  margin-bottom: 8rpx;

  .up { color: $upright-color; font-size: 22rpx; }
  .rev { color: $reversed-color; font-size: 22rpx; }
}

.summary-meaning {
  font-size: 24rpx;
  color: $text-secondary;
  line-height: 1.6;
}

// ========== 翻牌按钮 ==========
.flip-all-wrap {
  margin-top: 40rpx;
  display: flex;
  justify-content: center;

  .btn-secondary {
    width: 60%;
  }
}

// ========== 操作按钮 ==========
.result-actions {
  margin-top: 48rpx;
  padding-bottom: 40rpx;

  .btn-primary, .btn-secondary {
    width: 100%;
  }
}

// ========== 空状态 ==========
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 32rpx;
  color: $text-muted;
  margin-bottom: 48rpx;
}

.empty-state .btn-primary {
  width: 300rpx;
  height: 88rpx;
}
</style>
