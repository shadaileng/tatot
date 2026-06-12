# 分享海报拆分方案

> 创建日期：2026-06-12
> 状态：待开发

## 背景

当前分享海报的代码存在 H5 端和小程序端逻辑混写问题：

- `src/utils/poster/` 底层绘制逻辑已分离（`miniprogram.ts` / `html2canvas.ts`）
- 但 `src/components/SharePoster/SharePoster.vue` 组件层仍用 `#ifdef` 条件编译混在一起
- 修改小程序端逻辑时容易连带影响 H5 端

## 目标

将 `SharePoster.vue` 拆成两个独立组件，彻底解耦，互不影响。

## 当前代码结构

```
src/
├── components/SharePoster/
│   └── SharePoster.vue          ← 问题文件：#ifdef 混写，需要拆分
├── utils/poster/
│   ├── index.ts                 ← #ifdef 路由（保持现状）
│   ├── types.ts                 ← 纯类型定义（无需改动）
│   ├── miniprogram.ts           ← 小程序 Canvas 2D 绘制（已分离）
│   └── html2canvas.ts           ← H5 html2canvas 截图（已分离）
└── pages/result/
    └── result.vue               ← 引入 SharePoster，需改为 #ifdef 选择组件
```

## 拆分架构

```
拆分前：
  SharePoster.vue（#ifdef 混写）
    ├── 小程序逻辑（canvas、uni.createSelectorQuery、uni.saveImageToPhotosAlbum）
    └── H5 逻辑（document.createElement('a')、emit('share')）

拆分后：
  SharePosterMP.vue  ← 纯小程序（无 #ifdef）
  SharePosterH5.vue  ← 纯 H5（无 #ifdef）
  result.vue         ← 用 #ifdef 选择导入哪个组件
```

## 具体实施步骤

### 步骤 1：新建 `src/components/SharePoster/SharePosterMP.vue`（小程序版）

从 `SharePoster.vue` 中提取小程序专属逻辑：

- 保留 canvas 节点（`type="2d"`）+ Canvas 2D API
- 保留 `componentScope`、`uni.createSelectorQuery`
- `savePoster` → `uni.saveImageToPhotosAlbum`（相册授权 + 保存）
- `sharePoster` → `uni.showToast`（引导右上角分享）
- 移除所有 `#ifdef`，直接写死小程序逻辑
- 直接 `import { generateMiniProgramPoster } from '@/utils/poster/miniprogram'`

### 步骤 2：新建 `src/components/SharePoster/SharePosterH5.vue`（H5 版）

从 `SharePoster.vue` 中提取 H5 专属逻辑：

- 删除 canvas 节点（H5 用 html2canvas 不需要）
- 移除 `componentScope`、`uni.createSelectorQuery` 等小程序 API
- `savePoster` → `document.createElement('a')` 触发下载
- `sharePoster` → `emit('share', posterUrl)`
- 移除所有 `#ifdef`
- 直接 `import { generateH5Poster } from '@/utils/poster/html2canvas'`

### 步骤 3：修改 `src/pages/result/result.vue`

用 `#ifdef` 条件编译选择导入不同组件：

```vue
<script setup lang="ts">
// #ifdef MP-WEIXIN
import SharePoster from '@/components/SharePoster/SharePosterMP.vue'
// #endif

// #ifdef H5
import SharePoster from '@/components/SharePoster/SharePosterH5.vue'
// #endif
</script>
```

模板和 props 传递方式不变。

### 步骤 4：保留 `src/utils/poster/index.ts`

底层绘制逻辑已经分离好，无需改动。

### 步骤 5：删除旧的 `SharePoster.vue`

拆分完成后，旧的 `SharePoster.vue` 可以删除。

## 各文件职责对比

| 功能点 | SharePosterMP.vue | SharePosterH5.vue |
|---|---|---|
| Canvas 元素 | ✅ 保留（隐藏的 2d canvas） | ❌ 不需要 |
| 海报生成方式 | Canvas 2D API 直接绘制 | html2canvas 截图 HTML |
| 保存图片 | `uni.saveImageToPhotosAlbum` | `<a download>` 触发下载 |
| 分享 | Toast 引导右上角菜单 | `emit('share', url)` |
| 直接导入 | `miniprogram.ts` | `html2canvas.ts` |

## 涉及文件清单

| 操作 | 文件路径 |
|---|---|
| 新建 | `src/components/SharePoster/SharePosterMP.vue` |
| 新建 | `src/components/SharePoster/SharePosterH5.vue` |
| 修改 | `src/pages/result/result.vue`（import 部分改用 #ifdef） |
| 删除 | `src/components/SharePoster/SharePoster.vue`（拆分完成后） |
| 不动 | `src/utils/poster/index.ts` |
| 不动 | `src/utils/poster/types.ts` |
| 不动 | `src/utils/poster/miniprogram.ts` |
| 不动 | `src/utils/poster/html2canvas.ts` |

## 收益

- 修改小程序端海报 UI/交互时，完全不会触碰 `SharePosterH5.vue`，H5 端不再被连带弄坏
- 同理，修改 H5 端也不影响小程序
- 代码更清晰，每个文件职责单一，无需读 #ifdef 条件编译来理解逻辑
