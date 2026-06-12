import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TarotCard, DrawnCard, SpreadType, ReadingRecord, CardOrientation } from '@/types'
import { drawRandomCards } from '@/data/tarot-cards'
import { getSpread } from '@/data/spreads'
import { fetchAIReading, generateLocalReading } from '@/services/reading'

/** 生成唯一 ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 随机方向 */
function randomOrientation(): CardOrientation {
  return Math.random() > 0.5 ? 'upright' : 'reversed'
}

/** 格式化日期 */
function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const useTarotStore = defineStore('tarot', () => {
  // ========== State ==========
  const currentReading = ref<{
    cards: DrawnCard[]
    spreadType: SpreadType
    question: string
    /** 是否使用 AI 解读 */
    useAI: boolean
    /** AI 综合解读文本 */
    interpretation: string
    /** 是否为 AI 生成（false 表示本地降级） */
    isAIInterpretation: boolean
    /** AI 解读格式不完整，综合解读由本地补偿 */
    isPartialAIInterpretation: boolean
  } | null>(null)

  const records = ref<ReadingRecord[]>([])

  /** AI 解读加载状态 */
  const isLoadingInterpretation = ref(false)

  // ========== Getters ==========
  const recordCount = computed(() => records.value.length)

  // ========== Actions ==========

  /** 执行抽牌 */
  function drawCards(spreadType: SpreadType, question = '', useAI = true) {
    const spread = getSpread(spreadType)
    const drawn = drawRandomCards(spread.positions.length)

    const cards: DrawnCard[] = drawn.map((card, i) => ({
      card,
      orientation: randomOrientation(),
      position: spread.positions[i],
    }))

    const timestamp = Date.now()
    currentReading.value = { cards, spreadType, question, useAI, interpretation: '', isAIInterpretation: false, isPartialAIInterpretation: false }

    // 保存到记录
    records.value.unshift({
      id: generateId(),
      spreadType,
      spreadName: spread.name,
      cards,
      question,
      timestamp,
      date: formatDate(timestamp),
    })

    // 最多保留 100 条记录
    if (records.value.length > 100) {
      records.value = records.value.slice(0, 100)
    }

    // 持久化到本地存储
    saveRecords()
  }

  /** 获取 AI 个性化解读 */
  async function fetchInterpretation() {
    if (!currentReading.value || currentReading.value.interpretation) return

    isLoadingInterpretation.value = true
    try {
      // 用户关闭 AI 开关，直接使用本地规则解读
      if (!currentReading.value.useAI) {
        const localReading = generateLocalReading(currentReading.value.question, currentReading.value.cards)
        if (currentReading.value) {
          currentReading.value.interpretation = localReading
          currentReading.value.isAIInterpretation = false
          currentReading.value.isPartialAIInterpretation = false
        }
        return
      }

      const result = await fetchAIReading(currentReading.value.question, currentReading.value.cards)
      if (currentReading.value) {
        currentReading.value.interpretation = result.reading
        currentReading.value.isAIInterpretation = result.isAI
        currentReading.value.isPartialAIInterpretation = result.isPartialAI
      }
    } catch (e) {
      console.error('获取 AI 解读失败:', e)
    } finally {
      isLoadingInterpretation.value = false
    }
  }

  /** 清除当前占卜结果 */
  function clearReading() {
    currentReading.value = null
    isLoadingInterpretation.value = false
  }

  /** 保存记录到本地存储 */
  function saveRecords() {
    try {
      uni.setStorageSync('tarot-records', JSON.stringify(records.value))
    } catch (e) {
      console.error('保存记录失败:', e)
    }
  }

  /** 从本地存储加载记录 */
  function loadRecords() {
    try {
      const data = uni.getStorageSync('tarot-records')
      if (data) {
        records.value = JSON.parse(data)
      }
    } catch (e) {
      console.error('加载记录失败:', e)
    }
  }

  /** 删除记录 */
  function deleteRecord(id: string) {
    records.value = records.value.filter((r) => r.id !== id)
    saveRecords()
  }

  /** 清空所有记录 */
  function clearAllRecords() {
    records.value = []
    saveRecords()
  }

  return {
    currentReading,
    records,
    recordCount,
    isLoadingInterpretation,
    drawCards,
    fetchInterpretation,
    clearReading,
    loadRecords,
    deleteRecord,
    clearAllRecords,
  }
})
