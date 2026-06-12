# 后台海报生成方案

> 创建日期：2026-06-12
> 状态：待开发

## 背景

当前海报生成逻辑全在前端：

- **小程序端**：Canvas 2D API 在客户端绘制（`src/utils/poster/miniprogram.ts`）
- **H5 端**：html2canvas 在浏览器截图（`src/utils/poster/html2canvas.ts`）

存在的问题：

| 问题 | 说明 |
|------|------|
| **效果不佳** | Canvas 2D 只能绘制占位框 + 文字符号，无法展示真实牌面图片，视觉效果干瘪 |
| **设计难迭代** | 改一个颜色需要翻几十行 `ctx.fillStyle` 代码，无法像改 CSS 一样直观 |
| **效果受限** | 阴影、毛玻璃、渐变叠加等 CSS 效果 Canvas 做起来极其繁琐甚至不可能 |
| **字体单调** | 只能用系统默认 sans-serif，无法使用优雅的中文字体 |
| **双端维护** | 小程序和 H5 各有一套绘制逻辑，修改需要两边同步，容易不一致 |
| **代码量大** | 前端海报相关代码累计 750+ 行 |

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
- **前端极大简化**：750+ 行绘制代码 → 一个 `fetch` 调用
- **设计迭代友好**：改 CSS 属性即可，所见即所得
- **双端完全一致**：同一套 HTML 模板，输出完全相同
- **成本可控**：一个轻量云服务器 ¥30~50/月，塔罗占卜场景完全够用

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
| 前端代码量 | 750+ 行绘制代码 | ~20 行 API 调用 |

## 实施计划

### 步骤 1：创建海报微服务项目

在 `/workspace` 下新建 `tarot-poster-service/`：

```
tarot-poster-service/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Express 服务入口
│   ├── poster/
│   │   ├── template.ts       # 海报 HTML 模板生成
│   │   ├── render.ts         # Puppeteer 截图逻辑
│   │   └── types.ts          # 类型定义（复用 frontend 的 PosterData）
│   ├── assets/
│   │   └── fonts/            # 中文字体文件（或使用 CDN Google Fonts）
│   └── cache/
│       └── index.ts          # 可选：Redis/Memory 缓存层
├── Dockerfile                # Docker 部署
└── docker-compose.yml        # 本地开发用
```

### 步骤 2：海报 HTML 模板设计

用 CSS 打造暗黑神秘风格的海报模板，核心要素：

- **背景**：深色渐变 / 星空纹理
- **牌面区域**：3x1 或 3x3 网格，展示真实牌面图片
- **每张牌下方**：牌名 + 关键词 + 简短含义
- **底部**：问题 + 阵型名 + 综合解读 + 日期水印
- **装饰**：神秘符号、细线分隔、毛玻璃效果

模板函数签名：

```typescript
// src/poster/template.ts
export function buildPosterHTML(data: PosterData): string {
  // 返回完整的 HTML 页面字符串
  // 包含内联 CSS、Google Fonts 引用、卡片图片等
}
```

### 步骤 3：Puppeteer 截图逻辑

```typescript
// src/poster/render.ts
import puppeteer from 'puppeteer';

export async function renderPoster(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 750, height: 1334 }); // 设计稿尺寸
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // 等待图片和字体加载完成
  await page.waitForSelector('.poster-ready', { timeout: 10000 });

  const screenshot = await page.screenshot({
    type: 'png',
    fullPage: true,
  });

  await browser.close();
  return Buffer.from(screenshot);
}
```

### 步骤 4：API 端点

```typescript
// src/index.ts
import express from 'express';
import { buildPosterHTML } from './poster/template';
import { renderPoster } from './poster/render';
import { cacheGet, cacheSet } from './cache';

const app = express();
app.use(express.json());

app.post('/poster', async (req, res) => {
  try {
    const posterData = req.body;
    const cacheKey = generateCacheKey(posterData);

    // 检查缓存
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.set('Content-Type', 'image/png');
      res.set('X-Cache', 'HIT');
      return res.send(cached);
    }

    // 生成海报
    const html = buildPosterHTML(posterData);
    const imageBuffer = await renderPoster(html);

    // 缓存
    await cacheSet(cacheKey, imageBuffer, 3600); // 1小时

    res.set('Content-Type', 'image/png');
    res.set('X-Cache', 'MISS');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Poster generation failed:', error);
    res.status(500).json({ error: 'Poster generation failed' });
  }
});

app.listen(3000, () => {
  console.log('Poster service running on port 3000');
});
```

### 步骤 5：前端大幅简化

小程序和 H5 端统一改为 API 调用：

```typescript
// 之前：750+ 行 Canvas 2D + html2canvas 绘制代码
// 之后：

async function generatePoster(data: PosterData): Promise<string> {
  const res = await fetch('https://api.example.com/poster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error('生成海报失败');

  const blob = await res.blob();
  return URL.createObjectURL(blob); // H5 直接展示
  // 或
  // const filePath = await saveTempFile(blob); // 小程序保存临时文件
  // return filePath;
}
```

### 步骤 6：删除旧代码

| 操作 | 文件 |
|------|------|
| 删除 | `src/utils/poster/miniprogram.ts`（Canvas 2D 绘制逻辑） |
| 删除 | `src/utils/poster/html2canvas.ts`（html2canvas 截图逻辑） |
| 删除 | `src/utils/poster/index.ts`（路由逻辑） |
| 保留 | `src/utils/poster/types.ts`（类型定义，后端也会引用） |
| 简化 | `src/components/SharePoster/` → 简化为纯展示+调用组件 |

## 部署方案

### 推荐：Docker 部署到轻量云服务器

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
  chromium \
  fonts-noto-cjk \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 可选：部署到现有 tarot-reading-api 同一服务器

如果 `tarot-reading-api` 已经有一台服务器，海报服务可以部署在同一台机器上，通过 Nginx 反向代理统一对外。

## 缓存策略

| 层级 | 方案 | 过期时间 | 说明 |
|------|------|----------|------|
| 应用层 | 内存 LRU Cache | 1 小时 | 相同参数返回同一张图 |
| CDN | CloudFront / CDN 节点 | 24 小时 | 热点海报加速 |
| 持久化 | 可选存 OSS/S3 | 永久 | 历史海报可回溯 |

## 注意事项

1. **中文字体**：需要将字体文件打包到 Docker 镜像中，或使用 Google Fonts CDN（确保服务能访问外网）
2. **牌面图片**：海报模板需要能引用到牌面图片的 URL，牌面图片需要托管在可公网访问的 CDN/OSS 上
3. **Puppeteer 并发**：建议使用连接池复用浏览器实例，避免每次请求都 `launch` + `close`
4. **超时处理**：Puppeteer 截图可能较慢（2~5秒），前端需要做好 loading 状态和超时重试
5. **安全性**：可以加简单的 API Key 校验，防止被滥用

## 涉及文件清单

| 操作 | 文件路径 |
|------|----------|
| 新建 | `/workspace/tarot-poster-service/`（整个微服务项目） |
| 保留 | `src/utils/poster/types.ts`（类型定义） |
| 删除 | `src/utils/poster/miniprogram.ts` |
| 删除 | `src/utils/poster/html2canvas.ts` |
| 删除 | `src/utils/poster/index.ts` |
| 简化 | `src/components/SharePoster/SharePoster.vue` |
| 修改 | `src/pages/result/result.vue`（传参逻辑） |

## 收益

- 海报视觉效果从"能用"升级到"精美"
- 前端海报相关代码从 750+ 行降至 ~30 行
- 小程序包体积减少（移除 html2canvas 等依赖）
- 修改海报设计只需改 HTML/CSS，无需碰前端代码
- 双端海报完全一致，不再有平台差异
- 支持缓存，相同内容无需重复生成
