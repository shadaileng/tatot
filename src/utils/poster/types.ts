// ========== 海报生成 - 统一类型定义 ==========

import type { DrawnCard } from '@/types'

/** 海报生成输入数据 */
export interface PosterData {
  cards: DrawnCard[]
  question: string
  spreadName: string
  interpretation?: string
  date: string
}

/** 海报卡片展示数据 */
export interface PosterCard {
  name: string
  /** 牌面图片路径 */
  image: string
  /** 在牌阵中的位置 */
  position: string
  /** 正位/逆位 */
  orientation: 'upright' | 'reversed'
  /** 含义文本 */
  meaning: string
  /** 关键词 */
  keywords: string[]
  /** 花色类型 */
  type: string
  /** 大阿卡纳序号（小阿卡纳为 -1） */
  number: number
}

/** 海报生成结果 */
export interface PosterResult {
  /** 图片临时路径 (小程序) / base64 (H5) */
  url: string
  /** 海报宽度 */
  width: number
  /** 海报高度 */
  height: number
}
