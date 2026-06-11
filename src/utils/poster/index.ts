// ========== 海报生成 - 统一入口（条件编译） ==========

import type { PosterData, PosterResult } from './types'

// #ifdef MP-WEIXIN
import { generateMiniProgramPoster } from './miniprogram'
// #endif

// #ifdef H5
import { generateH5Poster } from './html2canvas'
// #endif

/** 生成海报的 canvasId（小程序端需要） */
let posterCanvasId = 'poster-canvas'
let posterCanvasInstance = 0

/**
 * 生成海报图片
 * 小程序端：使用 Canvas 2D API，2x 高清绘制
 * H5 端：使用 html2canvas 截图 HTML
 *
 * @param data 海报数据
 * @param options.canvasId 小程序 canvas 的 id（需确保不冲突）
 * @returns 海报结果（url + 尺寸）
 */
export async function generatePoster(
  data: PosterData,
  options?: { canvasId?: string },
): Promise<PosterResult> {
  // #ifdef MP-WEIXIN
  const id = options?.canvasId || `${posterCanvasId}-${++posterCanvasInstance}`
  return generateMiniProgramPoster(id, data)
  // #endif

  // #ifdef H5
  return generateH5Poster(data)
  // #endif
}

/** 重新导出类型 */
export type { PosterData, PosterResult, PosterCard } from './types'
