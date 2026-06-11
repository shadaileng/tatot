# AGENTS.md — AI 协作指南

> 本文档帮助 AI 编程助手快速理解 `tarot-miniprogram` 项目。
> 修改代码前请先阅读本文档。

## 项目概述

塔罗牌占卜多端应用（微信小程序 + H5），基于 **UniApp Vue3 + TypeScript + Pinia + Vite** 构建，使用 **pnpm** 管理依赖。

```
tarot-miniprogram/
├── src/
│   ├── pages/        # 页面（index / draw / result / cards / history）
│   ├── components/   # 组件（TarotCard / CardDetail / TabBar）
│   ├── store/        # Pinia 状态管理
│   ├── data/         # 静态数据（牌组数据 / 牌阵配置）
│   ├── types/        # TypeScript 类型定义
│   ├── utils/        # 工具函数
│   ├── styles/       # 全局样式 & 设计 Token
│   ├── static/       # 静态资源（图片）
│   ├── pages.json    # 路由 & TabBar 配置
│   └── manifest.json # 平台配置（AppID 由 env 注入，不硬编码）
├── .env              # 环境变量（VITE_API_URL / TAROT_APPID）
├── public/
│   └── _redirects   # Cloudflare Pages SPA 路由回退规则
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | UniApp Vue3（`@dcloudio/uni-app`） |
| 语言 | TypeScript（strict: true） |
| 状态管理 | Pinia |
| 构建工具 | Vite 5 + `@dcloudio/vite-plugin-uni` |
| CSS | SCSS（设计 Token 在 `variables.scss`）+ TailwindCSS（通过 `weapp-tailwindcss`） |
| 包管理 | pnpm（`.npmrc` 中 `shamefully-hoist=true` 不可删除） |

## 规范与约束

### 编码规范
- 使用 Composition API（`<script setup lang="ts">`）
- 页面组件 PascalCase 命名，CSS 类名 kebab-case
- 优先使用 `src/styles/variables.scss` 中的 SCSS 变量，禁止硬编码颜色/尺寸
- 用户可见文本直接写在模板中（不做 i18n）

### UniApp / 微信小程序约束
- `shamefully-hoist=true` 是 UniApp 正确解析依赖的必要条件，不得删除
- 微信小程序不支持某些 CSS（如 `position: fixed` 在 `scroll-view` 内异常）
- 分包限制：单包 ≤ 2MB，总包 ≤ 20MB；图片资源放在 `src/static/`
- `vite.config.ts` 通过 `additionalData` 全局注入 `variables.scss`，组件中直接使用变量无需 import

### easycom 组件自动注册
`pages.json` 中配置了 `^T-(.*)` → `@/components/TarotCard/$1.vue`，
目前只有 `TarotCard` 组件使用此规则，新组件放在 `src/components/<Name>/index.vue`。

## 核心数据结构

```
TarotCard { id, name, nameEn, type('major'|Suit), number, image, keywords, uprightMeaning, reversedMeaning, description }
  ↓ drawCards(spreadType, question)
DrawnCard { card: TarotCard, orientation: 'upright'|'reversed', position: string }
  ↓ 组成
ReadingRecord { id, spreadType, spreadName, cards: DrawnCard[], question, timestamp, date }
```

- 牌组数据：`src/data/tarot-cards.ts`（78 张，大阿卡纳 0-21 + 小阿卡纳 4 花色）
- 牌阵配置：`src/data/spreads.ts`（single / three / celtic-cross）
- 状态管理：`src/store/tarot.ts`（Pinia Store，管理当前占卜 + 历史记录，持久化到 `uni.storage`，最多 100 条）

## 页面结构

| 路径 | 说明 | TabBar |
|------|------|--------|
| `pages/index/index` | 首页（入口） | ✅ |
| `pages/draw/draw` | 抽牌页（选择牌阵、执行抽牌） | ✅ |
| `pages/result/result` | 占卜结果页（展示牌面、正逆位解读） | - |
| `pages/cards/cards` | 牌库浏览（78 张牌列表） | ✅ |
| `pages/history/history` | 占卜记录（历史列表、删除） | ✅ |

> TabBar 为自定义组件（`src/components/TabBar/TabBar.vue`），`pages.json` 中 `"custom": true`。

## 命令

```bash
pnpm install               # 安装依赖（必须用 pnpm，不可用 npm/yarn）
pnpm dev:mp-weixin         # 开发：微信小程序（HBuilderX 或微信开发者工具）
pnpm build:mp-weixin       # 构建：微信小程序生产包 → dist/build/mp-weixin
pnpm dev:h5                # 开发：H5（浏览器访问）
pnpm build:h5              # 构建：H5 生产包 → dist/build/h5
pnpm deploy:cf             # 构建 + 部署 H5 到 Cloudflare Pages（需先 npx wrangler login）

## 环境变量

| 变量 | 用途 | 说明 |
|------|------|------|
| `VITE_API_URL` | AI 解读后台地址 | 构建时注入 `import.meta.env.VITE_API_URL`，值在 `.env` 中配置 |
| `TAROT_APPID` | 微信小程序 AppID | 构建时由 `injectAppidPlugin` 自动写入 `project.config.json`，值在 `.env` 中配置 |
| `TAROT_URL_CHECK` | 域名白名单校验开关 | 构建时由 `injectAppidPlugin` 写入 `project.config.json`，开发环境 `false`，生产环境 `true` |

> 如需为不同环境设置不同值，可创建 `.env.development` 或 `.env.production` 覆盖。

## 部署

### H5 本地预览
```bash
pnpm build:h5
npx wrangler pages dev dist/build/h5   # 支持 _redirects SPA 路由回退
```

### Cloudflare Pages 部署

| 方式 | 说明 |
|------|------|
| `pnpm deploy:cf` | Wrangler CLI（推荐，构建 + 上传一键完成） |
| Dashboard 上传 | 构建后拖拽 `dist/build/h5/` 到 Cloudflare Pages Dashboard |
| Git 集成 | 连接仓库，Build: `pnpm build:h5`，Output: `dist/build/h5` |

> `public/_redirects` 已配置 `/* /index.html 200`，Cloudflare Pages 自动生效。

### 微信小程序上传
1. `pnpm build:mp-weixin` 构建生产版本
2. 微信开发者工具导入 `dist/build/mp-weixin`
3. 点击「上传」→ 填写版本号 → 在微信公众平台提交审核

> AppID 通过 `TAROT_APPID` 环境变量配置（详见「环境变量」），构建时由 `injectAppidPlugin` 自动注入 `project.config.json`，无需手动修改 `src/manifest.json`。
