# 后台海报生成方案

> 创建日期：2026-06-12
> 最后更新：2026-06-12
> 状态：待开发

## 背景

当前海报生成逻辑全在前端：

- **小程序端**：Canvas 2D API 在客户端绘制（`src/utils/poster/miniprogram.ts`，438 行）
- **H5 端**：html2canvas 在浏览器截图（`src/utils/poster/html2canvas.ts`，324 行）
- **组件层**：`src/components/SharePoster/SharePoster.vue`（358 行），用 `#ifdef` 混写小程序/H5 逻辑

存在的问题：

| 问题 | 说明 |
|------|------|
| **效果不佳** | Canvas 2D 只能绘制占位框 + 文字符号，无法展示真实牌面图片，视觉效果干瘪 |
| **设计难迭代** | 改一个颜色需要翻几十行 `ctx.fillStyle` 代码，无法像改 CSS 一样直观 |
| **效果受限** | 阴影、毛玻璃、渐变叠加等 CSS 效果 Canvas 做起来极其繁琐甚至不可能 |
| **字体单调** | 只能用系统默认 sans-serif，无法使用优雅的中文字体 |
| **双端维护** | 小程序和 H5 各有一套绘制逻辑，修改需要两边同步，容易不一致 |
| **代码量大** | 前端海报相关代码累计 1120+ 行（438 + 324 + 358） |
| **组件混写** | SharePoster.vue 用 `#ifdef` 混写小程序/H5 逻辑，改一端容易影响另一端 |

## 方案选择

### 方案对比

| 方案 | 原理 | 费用 | 海报品质 | 维护成本 | 结论 |
|------|------|------|----------|----------|------|
| **A. Cloudflare Browser Rendering** | Worker 调用无头浏览器截图 | Free: 10分钟/天<br>Paid: $5/月起 | ⭐⭐⭐ 高（HTML/CSS） | ⭐ 低 | ❌ 需付费，配额受限 |
| **B. node-canvas 后端绘制** | 用 node-canvas 复刻 Canvas 2D API | 仅服务器 | ⭐⭐ 中（和现在一样） | ⭐⭐ 中 | ❌ 品质无法提升 |
| **C. SVG → PNG** | 后端生成 SVG 转 PNG | 仅服务器 | ⭐⭐ 中 | ⭐⭐⭐ 高 | ❌ 中文排版差，效果受限 |
| **✅ D. HTML/CSS + Puppeteer 后台截图** | Node.js 服务拼装 HTML 页面，Puppeteer 截图 | 仅服务器（~¥30-50/月） | ⭐⭐⭐⭐⭐ 极高 | ⭐ 低（CSS 改设计） | ✅ **推荐** |

### 最终选择：方案 D — HTML/CSS + Puppeteer

核心理由：
- **海报品质飞跃**：真实牌面图片 + 优雅字体 + 完整 CSS 效果
- **前端极大简化**：1120+ 行绘制代码 → 一个 `fetch` 调用
- **设计迭代友好**：改 CSS 属性即可，所见即所得
- **双端完全一致**：同一套 HTML 模板，输出完全相同
- **成本可控**：一个轻量云服务器 ¥30~50/月，塔罗占卜场景完全够用
- **免费起步**：可通过 HuggingFace Spaces 免费部署验证

## 架构设计

```
┌─────────────────────┐          POST /poster          ┌─────────────────────────┐
│  前端（小程序 / H5）  │  ──────────────────────────▶  │  海报生成微服务 (Node.js)  │
│                     │    { cards, question,          │                         │
│  const url = await  │      spreadName,               │  1. 接收 PosterData     │
│  fetch('/poster', { │      interpretation,           │  2. 拼装精美 HTML 页面    │
│    method: 'POST',  │      date }                    │     ├── 真实牌面图片 🃏    │
│    body: JSON...    │                                │     ├── 优雅中文字体 ✍️    │
│  })                 │                                │     ├── CSS 阴影/渐变 🎨  │
│                     │  ◀──────────────────────────   │     └── Dark UI 风格     │
│  <img :src="url" /> │   { url, width, height }       │  3. Puppeteer 截图 → PNG │
│                     │                                │  4. 返回图片 URL/Buffer  │
└─────────────────────┘                                └─────────────────────────┘
```

### 海报品质对比

| 维度 | 当前 Canvas 2D | HTML/CSS + Puppeteer（新方案） |
|------|:---:|:---:|
| 牌面展示 | ❌ 占位框 + 数字符号 | ✅ **真实牌面图片** |
| 字体 | ❌ 系统 sans-serif | ✅ 优雅中文字体（思源宋体/站酷文艺体等） |
| 视觉效果 | ❌ 纯色 + 基础渐变 | ✅ 阴影、毛玻璃、渐变叠加、半透明边框 |
| 设计迭代 | ❌ 改 ctx.fillStyle 代码 | ✅ 改 CSS 属性，所见即所得 |
| 双端一致性 | ⚠️ 两端实现可能不一致 | ✅ 同一套 HTML，输出完全一致 |
| 前端代码量 | 1120+ 行绘制代码 | ~30 行 API 调用 |

---

## 一、部署方式

支持三种部署方式，从免费开发到生产环境平滑过渡：

| 方式 | 费用 | 难度 | 适用场景 |
|------|------|------|----------|
| **本地开发** | 免费 | 零门槛 | 开发调试 |
| **Docker 部署** | ¥30-50/月（轻量云服务器） | 需 Docker | 生产环境 |
| **HuggingFace Spaces** | 完全免费 | git push | 快速上线验证 |

### 方式 1：本地开发

```bash
# 进入项目目录
cd tarot-poster-service

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑 .env，可选配置 API_KEY

# 开发模式（热重载）
npm run dev

# 生产模式
npm run build && npm start
```

服务默认监听 `http://localhost:3000`，端口可通过 `PORT` 环境变量修改。

### 方式 2：Docker 部署

```bash
# 构建镜像
docker build -t tarot-poster-service .

# 运行容器
docker run -d \
  --name tarot-poster \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e API_KEY=your-secret-key \
  -e CACHE_MAX_SIZE=100 \
  -e CACHE_TTL_SECONDS=3600 \
  tarot-poster-service

# 或使用 docker-compose
docker-compose up -d
```

### 方式 3：HuggingFace Spaces（免费）

1. 在 HuggingFace 创建 Space，选择 **Docker** 模板
2. 将 `Dockerfile.hf` 重命名为 `Dockerfile` 推送到 Space 仓库
3. 设置环境变量（API_KEY 可选）
4. HuggingFace 自动构建并部署

**HF Spaces 注意事项**：
- 端口必须使用 `PORT=7860`（HF 内部环境变量，`Dockerfile.hf` 已配置）
- 需要暴露根路径 `/` 端点（返回服务状态）
- 免费层无 GPU，截图约 3-8 秒
- 长时间不访问会休眠，可使用定时 ping 保持活跃

---

## 二、项目结构

```
tarot-poster-service/
├── package.json                # 项目配置
├── tsconfig.json               # TypeScript 配置
├── .env.example                # 环境变量示例
├── .gitignore                  # Git 忽略文件
├── Dockerfile                  # 标准 Docker 构建（多阶段）
├── Dockerfile.hf               # HuggingFace Spaces 专用 Dockerfile
├── docker-compose.yml          # Docker Compose 本地开发
├── Makefile                    # 常用命令快捷方式
├── README.md                   # 项目说明
├── scripts/
│   └── entrypoint.sh           # 容器启动脚本
├── src/
│   ├── index.ts                # Express 服务入口
│   ├── config.ts               # 统一环境变量管理
│   ├── poster/
│   │   ├── template.ts         # 海报 HTML 模板生成
│   │   ├── render.ts           # Puppeteer 截图逻辑（含连接池）
│   │   └── types.ts            # 类型定义
│   ├── cache/
│   │   └── index.ts            # LRU 内存缓存
│   └── middleware/
│       ├── cors.ts             # CORS 中间件
│       └── auth.ts             # API Key 鉴权中间件
├── assets/
│   └── fonts/                  # 中文字体文件
└── test/
    └── poster.test.ts          # 海报生成测试
```

---

## 三、核心代码实现

### 3.1 环境变量统一管理（`src/config.ts`）

```typescript
// src/config.ts
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // API 鉴权（不配置则跳过）
  apiKey: process.env.API_KEY || '',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Puppeteer 配置
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: (process.env.PUPPETEER_ARGS || '--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage').split(','),
  },

  // 缓存配置
  cache: {
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100', 10),
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
  },

  // 海报配置
  poster: {
    width: parseInt(process.env.POSTER_WIDTH || '750', 10),
    height: parseInt(process.env.POSTER_HEIGHT || '1334', 10),
  },
}
```

### 3.2 Express 服务入口（`src/index.ts`）

```typescript
// src/index.ts
import express from 'express'
import { config } from './config'
import { corsMiddleware } from './middleware/cors'
import { authMiddleware } from './middleware/auth'
import { buildPosterHTML } from './poster/template'
import { renderPoster } from './poster/render'
import { posterCache } from './cache'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(corsMiddleware)

// ========== 根路径（HF Spaces 兼容） ==========
app.get('/', (_req, res) => {
  res.json({
    service: 'tarot-poster-service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      poster: 'POST /poster',
    },
  })
})

// ========== 健康检查 ==========
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', cache: { size: posterCache.size, maxSize: posterCache.maxSize } })
})

// ========== 海报生成 API ==========
app.post('/poster', authMiddleware, async (req, res) => {
  try {
    const posterData = req.body

    // 参数校验
    if (!posterData.cards || !Array.isArray(posterData.cards) || posterData.cards.length === 0) {
      return res.status(400).json({ error: 'Invalid request: cards array is required' })
    }

    // 检查缓存
    const cacheKey = posterCache.generateKey(posterData)
    const cached = posterCache.get(cacheKey)
    if (cached) {
      res.set('Content-Type', 'image/png')
      res.set('X-Cache', 'HIT')
      res.set('Cache-Control', 'public, max-age=3600')
      return res.send(cached)
    }

    // 生成海报
    const html = buildPosterHTML(posterData)
    const imageBuffer = await renderPoster(html)

    // 缓存
    posterCache.set(cacheKey, imageBuffer)

    res.set('Content-Type', 'image/png')
    res.set('X-Cache', 'MISS')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(imageBuffer)
  } catch (error) {
    console.error('Poster generation failed:', error)
    res.status(500).json({ error: 'Poster generation failed' })
  }
})

// ========== 启动服务 ==========
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🃏 Tarot Poster Service running on http://0.0.0.0:${config.port}`)
  console.log(`   Environment: ${config.nodeEnv}`)
  console.log(`   Auth: ${config.apiKey ? 'enabled' : 'disabled'}`)
})
```

### 3.3 Puppeteer 截图（含浏览器连接池）（`src/poster/render.ts`）

```typescript
// src/poster/render.ts
import puppeteer, { Browser, Page } from 'puppeteer'
import { config } from '../config'

// ========== 浏览器连接池 ==========
// 复用浏览器实例，避免每次请求都 launch + close
let browserPromise: Promise<Browser> | null = null

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    console.log('[Puppeteer] Launching browser...')
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: config.puppeteer.executablePath,
      args: config.puppeteer.args,
    })
  }
  return browserPromise
}

// 优雅关闭浏览器
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise
      await browser.close()
      console.log('[Puppeteer] Browser closed')
    } catch (e) {
      console.error('[Puppeteer] Error closing browser:', e)
    }
    browserPromise = null
  }
}

// 监听进程退出
process.on('SIGTERM', closeBrowser)
process.on('SIGINT', closeBrowser)

// ========== 截图渲染 ==========
export async function renderPoster(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // 设置视口
    await page.setViewport({
      width: config.poster.width,
      height: config.poster.height,
      deviceScaleFactor: 2, // 2x 高清
    })

    // 加载 HTML
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    })

    // 等待海报渲染完成标记
    await page.waitForSelector('.poster-ready', { timeout: 10000 })

    // 截图
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    })

    return Buffer.from(screenshot)
  } finally {
    await page.close()
  }
}
```

### 3.4 LRU 缓存（`src/cache/index.ts`）

```typescript
// src/cache/index.ts
import { createHash } from 'crypto'
import { config } from '../config'

interface CacheEntry {
  key: string
  data: Buffer
  timestamp: number
}

class LRUCache {
  private cache: Map<string, CacheEntry>
  readonly maxSize: number
  readonly ttlMs: number

  constructor(maxSize: number = 100, ttlSeconds: number = 3600) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.ttlMs = ttlSeconds * 1000
  }

  get size(): number {
    return this.cache.size
  }

  /** 根据 PosterData 生成缓存键 */
  generateKey(data: any): string {
    const normalized = JSON.stringify({
      cards: data.cards.map((c: any) => ({
        name: c.name || c.card?.name,
        orientation: c.orientation,
        position: c.position,
      })),
      question: data.question,
      spreadName: data.spreadName,
      date: data.date,
    })
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  }

  get(key: string): Buffer | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // 检查 TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    // LRU: 移到末尾（最近使用）
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(key: string, data: Buffer): void {
    // 淘汰最旧条目
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest) this.cache.delete(oldest)
    }

    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now(),
    })
  }
}

export const posterCache = new LRUCache(config.cache.maxSize, config.cache.ttlSeconds)
```

### 3.5 API Key 鉴权中间件（`src/middleware/auth.ts`）

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import { config } from '../config'

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 未配置 API Key 时跳过鉴权
  if (!config.apiKey) {
    return next()
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (token !== config.apiKey) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}
```

### 3.6 海报 HTML 模板（`src/poster/template.ts`）

```typescript
// src/poster/template.ts

interface PosterCardInput {
  name: string
  image: string          // 牌面图片 URL
  position: string       // 牌阵位置
  orientation: 'upright' | 'reversed'
  meaning: string        // 含义文本
  keywords: string[]
  type: string           // 花色（major/minor）
  number: number
}

interface PosterData {
  cards: PosterCardInput[]
  question: string
  spreadName: string
  interpretation?: string
  date: string
}

export function buildPosterHTML(data: PosterData): string {
  const cardsHTML = data.cards.map((card, i) => {
    const isReversed = card.orientation === 'reversed'
    const keywordsStr = card.keywords.slice(0, 4).join(' · ')

    return `
    <div class="card-item">
      <div class="card-position">${card.position}</div>
      <div class="card-image-wrap ${isReversed ? 'reversed' : ''}">
        <img class="card-image" src="${card.image}" alt="${card.name}" crossorigin="anonymous" />
        <div class="card-badge ${card.orientation}">${isReversed ? '逆位' : '正位'}</div>
      </div>
      <div class="card-name">${card.name}</div>
      <div class="card-keywords">${keywordsStr}</div>
      <div class="card-meaning">${card.meaning}</div>
    </div>`
  }).join('')

  const interpretationHTML = data.interpretation
    ? `<div class="interpretation-section">
         <div class="section-title">✨ 综合解读</div>
         <div class="interpretation-text">${escapeHTML(data.interpretation)}</div>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=750, initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 750px;
    font-family: 'Noto Serif SC', 'SimSun', serif;
    background: linear-gradient(160deg, #0a0a1a 0%, #1a1a2e 40%, #16213e 100%);
    color: #e0d8c8;
    min-height: 1334px;
  }

  .poster-container {
    padding: 60px 50px;
    position: relative;
    overflow: hidden;
  }

  /* 背景装饰 */
  .poster-container::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
      radial-gradient(ellipse at 20% 10%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 30%, rgba(138, 43, 226, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, rgba(212, 175, 55, 0.05) 0%, transparent 50%);
    pointer-events: none;
  }

  /* 顶部星月装饰 */
  .header-decor {
    text-align: center;
    margin-bottom: 36px;
    position: relative;
  }

  .header-decor .moon {
    font-size: 28px;
    opacity: 0.3;
    letter-spacing: 8px;
  }

  .header-decor .line {
    width: 120px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.4), transparent);
    margin: 16px auto;
  }

  /* 标题 */
  .poster-title {
    text-align: center;
    font-size: 36px;
    font-weight: 700;
    color: #d4af37;
    letter-spacing: 4px;
    margin-bottom: 12px;
    text-shadow: 0 0 30px rgba(212, 175, 55, 0.2);
    position: relative;
  }

  .poster-subtitle {
    text-align: center;
    font-size: 16px;
    color: rgba(224, 216, 200, 0.5);
    margin-bottom: 40px;
    position: relative;
  }

  /* 问题 */
  .question-section {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 40px;
    text-align: center;
    position: relative;
  }

  .question-label {
    font-size: 14px;
    color: rgba(212, 175, 55, 0.6);
    margin-bottom: 8px;
  }

  .question-text {
    font-size: 22px;
    color: #e0d8c8;
    font-weight: 600;
  }

  /* 牌阵区域 */
  .cards-section {
    margin-bottom: 40px;
    position: relative;
  }

  .cards-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 28px;
  }

  /* 单张牌 */
  .card-item {
    width: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .card-position {
    font-size: 14px;
    color: rgba(212, 175, 55, 0.8);
    font-weight: 600;
    padding: 3px 14px;
    background: rgba(212, 175, 55, 0.1);
    border-radius: 20px;
  }

  .card-image-wrap {
    width: 160px;
    height: 260px;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(212, 175, 55, 0.2);
  }

  .card-image-wrap.reversed .card-image {
    transform: rotate(180deg);
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 10px;
    font-weight: 600;
  }

  .card-badge.upright {
    background: rgba(10, 200, 120, 0.85);
    color: #fff;
  }

  .card-badge.reversed {
    background: rgba(220, 100, 80, 0.85);
    color: #fff;
  }

  .card-name {
    font-size: 18px;
    font-weight: 700;
    color: #e0d8c8;
    text-align: center;
  }

  .card-keywords {
    font-size: 12px;
    color: rgba(212, 175, 55, 0.7);
    text-align: center;
    line-height: 1.6;
  }

  .card-meaning {
    font-size: 13px;
    color: rgba(224, 216, 200, 0.6);
    text-align: center;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* 解读区域 */
  .interpretation-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(212, 175, 55, 0.1);
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 40px;
    position: relative;
  }

  .section-title {
    font-size: 22px;
    color: #d4af37;
    font-weight: 700;
    margin-bottom: 20px;
    text-align: center;
  }

  .interpretation-text {
    font-size: 15px;
    color: rgba(224, 216, 200, 0.75);
    line-height: 1.8;
    white-space: pre-wrap;
  }

  /* 底部信息 */
  .footer {
    text-align: center;
    padding-top: 24px;
    border-top: 1px solid rgba(212, 175, 55, 0.1);
    position: relative;
  }

  .footer-text {
    font-size: 13px;
    color: rgba(224, 216, 200, 0.35);
    line-height: 2;
  }

  .footer-brand {
    font-size: 15px;
    color: rgba(212, 175, 55, 0.4);
    font-weight: 600;
    letter-spacing: 2px;
  }

  /* 海报就绪标记（Puppeteer 等待此选择器） */
  .poster-ready {
    opacity: 1;
  }
</style>
</head>
<body>
  <div class="poster-container poster-ready">
    <!-- 顶部装饰 -->
    <div class="header-decor">
      <div class="moon">☽ ★ ☾</div>
      <div class="line"></div>
    </div>

    <!-- 标题 -->
    <div class="poster-title">塔 罗 占 卜</div>
    <div class="poster-subtitle">${escapeHTML(data.spreadName)} · ${escapeHTML(data.date)}</div>

    <!-- 问题 -->
    <div class="question-section">
      <div class="question-label">🔮 你的问题</div>
      <div class="question-text">${escapeHTML(data.question)}</div>
    </div>

    <!-- 牌阵 -->
    <div class="cards-section">
      <div class="cards-grid">
        ${cardsHTML}
      </div>
    </div>

    <!-- AI 解读 -->
    ${interpretationHTML}

    <!-- 底部 -->
    <div class="footer">
      <div class="footer-brand">✦ TAROT ✦</div>
      <div class="footer-text">AI塔罗占卜 · 仅供娱乐参考</div>
    </div>
  </div>
</body>
</html>`
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

---

## 四、Docker 配置

### 4.1 标准 Dockerfile（多阶段构建）

```dockerfile
# ========== 构建阶段 ==========
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ========== 运行阶段 ==========
FROM node:20-slim

# 安装 Chromium + 中文字体
RUN apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
```

### 4.2 HuggingFace Spaces 专用 Dockerfile

```dockerfile
# HuggingFace Spaces 专用 Dockerfile
# HF 使用 PORT=7860，需要 root 端点

FROM node:20-slim

# 安装 Chromium + 中文字体
RUN apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# HF Spaces 默认端口
ENV PORT=7860
ENV NODE_ENV=production

EXPOSE 7860

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
```

### 4.3 容器启动脚本（`scripts/entrypoint.sh`）

```bash
#!/bin/bash
set -e

echo "🃏 Tarot Poster Service Starting..."
echo "   PORT: ${PORT:-7860}"
echo "   NODE_ENV: ${NODE_ENV:-production}"

# 确保 Chromium 可用
if [ -x "$PUPPETEER_EXECUTABLE_PATH" ]; then
  echo "   Chromium: $PUPPETEER_EXECUTABLE_PATH ($($PUPPETEER_EXECUTABLE_PATH --version | head -1))"
else
  echo "   ⚠️ Chromium not found at $PUPPETEER_EXECUTABLE_PATH"
fi

exec "$@"
```

### 4.4 docker-compose.yml

```yaml
version: '3.8'

services:
  poster:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tarot-poster
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - API_KEY=${API_KEY:-}
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
      - CACHE_MAX_SIZE=100
      - CACHE_TTL_SECONDS=3600
    volumes:
      # 可选：挂载字体目录
      - ./assets/fonts:/app/assets/fonts:ro
    healthcheck:
      test: ['CMD', 'wget', '-q', '-O', '-', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 五、前端简化

### 5.1 小程序和 H5 端统一 API 调用

当前前端代码（`src/utils/poster/index.ts`、`miniprogram.ts`、`html2canvas.ts`、`SharePoster.vue`）共 1120+ 行，简化后只需：

```typescript
// 新文件：src/services/poster.ts
import type { PosterData } from '@/utils/poster/types'

const POSTER_API = import.meta.env.VITE_POSTER_API || 'http://localhost:3000'

export async function generatePoster(data: PosterData): Promise<string> {
  const res = await fetch(`${POSTER_API}/poster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok) throw new Error('海报生成失败')

  const blob = await res.blob()

  // #ifdef H5
  return URL.createObjectURL(blob)
  // #endif

  // #ifdef MP-WEIXIN
  // 小程序：保存为临时文件
  const arrayBuffer = await blob.arrayBuffer()
  const fs = uni.getFileSystemManager()
  const tempPath = `${wx.env.USER_DATA_PATH}/poster-${Date.now()}.png`
  fs.writeFileSync(tempPath, arrayBuffer, 'binary')
  return tempPath
  // #endif
}
```

### 5.2 SharePoster 组件简化

`SharePoster.vue` 从 358 行简化到 ~100 行，移除所有 `#ifdef` 绘制逻辑：

```vue
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { DrawnCard } from '@/types'
import { generatePoster } from '@/services/poster'
import type { PosterData } from '@/utils/poster/types'

const props = defineProps<{
  visible: boolean
  cards: DrawnCard[]
  question: string
  spreadName: string
  interpretation?: string
}>()

const emit = defineEmits<{ close: []; share: [url: string] }>()

const posterReady = ref(false)
const posterUrl = ref('')
const posterError = ref('')

async function loadPoster() {
  posterError.value = ''
  try {
    const data: PosterData = {
      cards: props.cards,
      question: props.question,
      spreadName: props.spreadName,
      interpretation: props.interpretation,
      date: new Date().toLocaleDateString('zh-CN'),
    }
    posterUrl.value = await generatePoster(data)
    posterReady.value = true
  } catch (e) {
    console.error('[SharePoster] 生成失败:', e)
    posterError.value = '生成失败，请重试'
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    posterReady.value = false
    posterUrl.value = ''
    posterError.value = ''
    nextTick(() => setTimeout(loadPoster, 300))
  }
})
</script>
<!-- 模板保持不变，只是移除了 canvas 节点和 #ifdef 保存逻辑 -->
```

### 5.3 环境变量

前端 `.env` 添加：

```env
# 海报服务 API 地址
VITE_POSTER_API=https://your-poster-service.com
```

---

## 六、实施步骤

### 步骤 1：创建海报微服务项目

在 `/workspace` 下新建 `tarot-poster-service/`，按上述项目结构创建文件。

### 步骤 2：实现核心模块

按顺序实现：
1. `config.ts` — 环境变量管理
2. `cache/index.ts` — LRU 缓存
3. `middleware/cors.ts` + `auth.ts` — 中间件
4. `poster/template.ts` — 海报 HTML 模板
5. `poster/render.ts` — Puppeteer 截图 + 连接池
6. `index.ts` — Express 服务组装

### 步骤 3：本地测试

```bash
cd tarot-poster-service
npm install
npm run dev

# 测试 API
curl -X POST http://localhost:3000/poster \
  -H "Content-Type: application/json" \
  -d '{"cards": [...], "question": "测试", "spreadName": "三牌阵", "date": "2026-06-12"}'
```

### 步骤 4：前端适配

1. 新建 `src/services/poster.ts`（API 调用封装）
2. 简化 `src/components/SharePoster/SharePoster.vue`
3. 删除旧绘制代码（`miniprogram.ts`、`html2canvas.ts`、`poster/index.ts`）
4. 保留 `src/utils/poster/types.ts`（类型定义）

### 步骤 5：部署上线

- **快速验证**：推送到 HF Spaces（免费）
- **生产部署**：Docker 部署到轻量云服务器

---

## 七、涉及文件清单

| 操作 | 文件路径 |
|------|----------|
| **新建** | `/workspace/tarot-poster-service/`（整个微服务项目） |
| **新建** | `src/services/poster.ts`（前端 API 封装） |
| **保留** | `src/utils/poster/types.ts`（类型定义） |
| **删除** | `src/utils/poster/miniprogram.ts` |
| **删除** | `src/utils/poster/html2canvas.ts` |
| **删除** | `src/utils/poster/index.ts` |
| **简化** | `src/components/SharePoster/SharePoster.vue` |
| **修改** | `.env`（添加 VITE_POSTER_API） |

---

## 八、注意事项

1. **中文字体**：Google Fonts CDN 国内访问可能较慢，推荐将思源宋体子集打包到 `assets/fonts/` 并通过 CSS `@font-face` 引用
2. **牌面图片**：海报模板需要引用牌面图片 URL，需确保牌面图片托管在可公网访问的 CDN/OSS 上
3. **Puppeteer 并发**：使用连接池复用浏览器实例（已实现），避免每次请求都 launch + close
4. **超时处理**：Puppeteer 截图约 2-8 秒（本地 2-3 秒，HF Spaces 5-8 秒），前端需做好 loading 和超时重试
5. **安全性**：API Key 鉴权在未配置时自动跳过，适合开发阶段；生产环境务必配置
6. **HF Spaces 休眠**：免费层长时间不访问会休眠，可配置 GitHub Actions 定时 ping 或使用 cron-job.org 保持活跃

---

## 九、收益

- 海报视觉效果从"能用"升级到"精美"
- 前端海报相关代码从 1120+ 行降至 ~100 行
- 小程序包体积减少（移除 html2canvas 等依赖）
- 修改海报设计只需改 HTML/CSS，无需碰前端代码
- 双端海报完全一致，不再有平台差异
- 支持缓存，相同内容无需重复生成
- 三种部署方式灵活切换：本地 → HF Spaces（免费验证）→ Docker（正式生产）
