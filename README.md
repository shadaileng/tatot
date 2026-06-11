# 🃏 塔罗牌占卜小程序

基于 **UniApp + Vue 3 + TypeScript + Pinia + Vite** 构建的塔罗牌占卜微信小程序。

## 功能特性

- **占卜抽牌** — 支持单张牌、三张牌（过去·现在·未来）、凯尔特十字（10张）三种牌阵
- **翻牌动画** — 3D CSS 翻转动画，Fisher-Yates 洗牌算法，正逆位随机
- **完整牌库** — 78 张塔罗牌（22 张大阿卡纳 + 56 张小阿卡纳），支持分类浏览与搜索
- **解读引擎** — 正逆位完整解读，涵盖爱情、事业、健康方向
- **占卜记录** — 本地存储历史记录，支持查看详情与删除
- **分享海报** — Canvas 绘制精美分享图
- **深色主题** — 星空紫蓝色调，金色点缀，神秘氛围

## 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 8
- 微信开发者工具

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
# 微信小程序
pnpm dev:mp-weixin

# H5
pnpm dev:h5
```

### 构建

```bash
# 微信小程序
pnpm build:mp-weixin

# H5
pnpm build:h5
```

构建产物在 `dist/dev/mp-weixin`（开发）或 `dist/build/mp-weixin`（生产），使用微信开发者工具打开该目录即可预览。

---

## 环境变量

项目根目录的 `.env` 文件管理运行时配置：

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_API_URL` | AI 解读后台 API 地址（Vite 注入到 `import.meta.env`） | `https://tarot-reading-api.xxx.workers.dev` |
| `TAROT_APPID` | 微信小程序 AppID（构建时自动写入 `project.config.json`） | `wx8011fd667bbb95dc` |
| `TAROT_URL_CHECK` | 是否校验域名白名单（构建时写入 `project.config.json`） | `false`（开发） / `true`（生产） |

如需为生产环境设置不同的值，创建 `.env.production` 覆盖即可。

> `TAROT_APPID` 由 Vite 插件在构建时自动注入 `dist/*/mp-weixin/project.config.json`，无需手动修改 `src/manifest.json`。

---

## 部署

### H5 本地预览

构建后在本地启动静态服务器预览：

```bash
pnpm build:h5
npx wrangler pages dev dist/build/h5        # 使用 wrangler（推荐，支持 _redirects）
# 或
npx serve dist/build/h5                     # 使用 serve
```

> SPA 路由回退规则在 `public/_redirects` 中配置，使用 `wrangler pages dev` 可本地生效。

### 部署 H5 到 Cloudflare Pages

H5 构建产物 (`dist/build/h5/`) 可部署到 Cloudflare Pages，支持三种方式：

**方式一：Wrangler CLI（推荐，已配置脚本）**

```bash
pnpm deploy:cf
```

该命令会先执行 `pnpm build:h5`，然后调用 `wrangler pages deploy` 上传。首次运行需登录：`npx wrangler login`。

**方式二：Cloudflare Dashboard 直接上传**

1. 运行 `pnpm build:h5`
2. 打开 [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages)
3. Create a project → Direct upload → 拖拽上传 `dist/build/h5/` 目录

**方式三：Git 集成自动部署**

1. 将代码推送到 GitHub/GitLab
2. 在 Cloudflare Pages Dashboard 连接仓库
3. 构建配置：
   - **Framework preset**: None
   - **Build command**: `pnpm build:h5`
   - **Build output directory**: `dist/build/h5`
   - **Node.js version**: 18 或更高
4. 每次 push 自动触发构建部署

> `public/_redirects` 已配置 SPA 路由回退规则，Cloudflare Pages 会自动读取。

### 微信小程序上传

1. 运行 `pnpm build:mp-weixin` 构建生产版本
2. 打开微信开发者工具，导入项目目录 `dist/build/mp-weixin`
3. 在开发者工具中点击 **上传** 按钮，填写版本号和项目备注
4. 登录 [微信公众平台](https://mp.weixin.qq.com)，在「版本管理」中提交审核

> AppID 通过 `TAROT_APPID` 环境变量配置（详见「环境变量」），构建时自动注入 `project.config.json`，无需手动修改 `src/manifest.json`。

## 项目结构

```
tarot-miniprogram/
├── docs/
│   ├── REQUIREMENTS.md      # 需求文档
│   └── PLAN.md              # 执行规划
├── src/
│   ├── pages/               # 页面
│   │   ├── index/           # 首页
│   │   ├── draw/            # 抽牌页
│   │   ├── result/          # 结果页
│   │   ├── cards/           # 牌库页
│   │   └── history/         # 历史记录页
│   ├── components/          # 组件
│   │   ├── TarotCard/       # 单张牌组件
│   │   └── CardSpread/      # 牌阵布局组件
│   ├── store/               # Pinia 状态管理
│   ├── data/                # 78张牌数据 + 牌阵配置
│   ├── utils/               # 工具函数
│   ├── types/               # TypeScript 类型
│   ├── styles/              # SCSS 变量与全局样式
│   └── static/              # 静态资源
├── .env                     # 环境变量（VITE_API_URL / TAROT_APPID）
├── .npmrc                   # pnpm 配置
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | UniApp (Vue 3) |
| 语言 | TypeScript |
| 状态管理 | Pinia |
| 构建 | Vite |
| 样式 | SCSS |
| 包管理 | pnpm |
| 目标平台 | 微信小程序 / H5 |

## 相关文档

- [需求文档](./docs/REQUIREMENTS.md)
- [执行规划](./docs/PLAN.md)
- [UniApp 文档](https://uniapp.dcloud.net.cn/)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/)
