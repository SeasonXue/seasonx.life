# SeasonX 品牌与视觉风格

> 后续改 logo、favicon、Header 或任何品牌图形时，先读本文，再动手。  
> 目标：在迭代中保持同一套气质，而不是每次重造风格。

---

## 1. 品牌一句话

| 项 | 内容 |
|----|------|
| 名称 | **SeasonX** |
| 域名 | seasonx.life |
| 定位 | 个人博客 · 技术、思考与生活 |
| 气质 | 书卷、克制、偏暖、编辑感；不科技霓虹、不插画满铺、不吉祥物夸张表情 |

灵感基底：Kami 系「羊皮纸 + 单一墨蓝 + 衬线正文」。  
图形识别：**墨蓝单线狐狸**（无边框线稿），而非字母标。

---

## 2. 设计关键词

用这些词做取舍；冲突时优先靠前的词：

1. **Monoline（单线）** — 近似等线宽描边，无渐变、无色块填充  
2. **Editorial（编辑/刊名）** — 安静、可长期看，不卖萌、不电商  
3. **Warm parchment（暖纸）** — 底是暖灰米色，不是纯白冷灰  
4. **Ink blue only（单色强调）** — 品牌色只有一系墨蓝；其他靠明度  
5. **No frame（无章框）** — 主标是纯动物线稿，不加圆章、方章、描边底（favicon 小尺寸除外）

避免：

- 厚涂、水彩晕染、3D、描边+填充双层  
- 多彩色、荧光、渐变紫蓝  
- 圆角胶囊底 + 立体图标（App Store 风）  
- 过度拟人（大眼睛、张嘴笑、尖牙卡通）  
- 无意义的几何装饰环绕 logo

---

## 3. 色板

与 `src/styles/global.css` 中 token 一致；改色先改 CSS 变量，再同步图形资产。

### 3.1 品牌与表面

| Token | Hex | 用途 |
|-------|-----|------|
| `--brand` | `#1b365d` | **唯一主色**：logo 线、链接、强调 |
| `--brand-light` | `#2d5a8a` | hover / 次级强调 |
| `--brand-tint` | `#eef2f7` | 浅蓝底（标签、hover 圆） |
| `--tag-bg` | `#e4ecf5` | 标签底 |
| `--parchment` | `#f5f4ed` | 页面主底、favicon 底 |
| `--ivory` | `#faf9f5` | 抬升表面 |
| `--warm-sand` | `#e8e6dc` | 交互底、边框近色 |
| `--deep-dark` / `--near-black` | `#141413` | 主文字（暖黑，非纯黑） |

### 3.2 文字层级（暖灰）

| Token | Hex | 用途 |
|-------|-----|------|
| `--near-black` | `#141413` | 标题、正文主色 |
| `--dark-warm` | `#3d3d3a` | 次级正文 |
| `--olive` | `#504e49` | 弱化说明 |
| `--stone` | `#6b6a64` | meta、图标默认 |

### 3.3 Logo 用色规则

| 场景 | 线色 | 背景 |
|------|------|------|
| Header / 正文旁 | `#1b365d`（或 PNG 内嵌同色） | 透明 |
| favicon / 桌面图标 | `#1b365d` | `#f5f4ed` 圆角方 |
| 深色场景（若以后有） | 可反白为 `#f5f4ed` 或保持墨蓝在深底上 | 勿用纯白冷底硬套 |
| 禁止 | 多色狐狸、橙狐写实色 | 渐变底、照片底 |

**原则：站点只有一系「彩色」= 墨蓝；狐狸本身不涂橙、不涂棕。**

---

## 4. 字体

| 角色 | 字体 | 说明 |
|------|------|------|
| 正文 / UI | Noto Serif SC（回退 Source Han Serif SC / Songti / Georgia） | 全书卷感，不是无衬线产品站 |
| 代码 | JetBrains Mono 等 | 仅 code |
| 字标「SeasonX」 | 继承 Header 字重：`font-medium` + `tracking-tight` | 与狐狸并排，不另造花体 |

Logo 图形内**不出现文字**（字标在图形外用系统/站点字体排）。  
AI 出图若带字，落库前去掉文字，字标用代码排。

---

## 5. Logo 系统

### 5.1 主题

- **主体**：狐狸（Fox）  
- **画法**：线条插画 / monoline，无填充色块  
- **构图**：无边框、无印章圈（主标）  
- **情绪**：安静、机敏、略文学，不卡通 IP 化  

### 5.2 变体与文件

| 变体 | 文件 | 用途 | 选用理由 |
|------|------|------|----------|
| **正面头像（主标）** | `public/logo-fox.png` | Header、默认品牌图 | 对称、小尺寸仍可辨 |
| 侧面头像 | `public/logo-fox-profile.png` | 专题、关于页、横版组合 | 更优雅、叙事感 |
| 坐姿全身 | `public/logo-fox-sitting.png` | 空状态、品牌故事、大图 | 完整、尾巴识别强 |
| favicon | `public/favicon.svg`、`favicon-32.png` | 浏览器标签 | 羊皮纸圆角底 + **加粗**线 |
| 触控图标 | `public/apple-touch-icon.png` | iOS 主屏 | 羊皮纸底 + 正面狐狸 |

接入位置：

- Header：`src/components/Header.astro`（`/logo-fox.png` + 文案 SeasonX）  
- 站点图标：`src/components/BaseHead.astro`

### 5.3 形态规范

**主标（Header）**

- 图形：正面 monoline 狐狸，透明底 PNG  
- 尺寸：约 `32×32` CSS 像素（`h-8 w-8`），可随 header 微调 28–36  
- 与字距：`gap-2` 量级，图形在左、字标在右  
- Hover：字标跟站点 accent；图形可略提不透明度（勿变色成橙狐）

**Favicon**

- 画布 `32×32`，圆角约 `rx=6`（与旧 S 标一致）  
- 底：`#f5f4ed`  
- 线：墨蓝；**线宽必须比 Header 主图更粗**，否则 16px 不可辨  
- 细节可简化（耳朵、吻、胸前 V 保留即可），勿塞满毛发

**Lockup（组合标）**

```
[ 狐狸线稿 ]  SeasonX
```

- 不写 `.life` 进默认 lockup（域名出现在页脚/关于即可）  
- 不把 SeasonX 画进 PNG；字用 HTML/CSS  

### 5.4 导出与制作约定

| 项 | 约定 |
|----|------|
| 主交付 | 透明底 PNG（线色已烘焙为 `#1b365d`） |
| 理想长期 | 等线 SVG path（`stroke="#1b365d"` 或 `currentColor`），Header 可内联 |
| 源概念图 | 单线、羊皮纸或透明构思、无字、无水印 |
| 从概念图提线 | 去底 → 线色归一墨蓝 → 透明底；小尺寸再 morph 加粗 |
| 禁止 | 直接拿未去底的 JPG 当 logo；未加粗的细线当 16px favicon |

优化流程建议：

1. 先对照本文关键词与反例  
2. 改线稿时保留「正面 / 侧面 / 坐姿」三套角色分工  
3. 同步：主 PNG → favicon（加粗）→ apple-touch → Header 路径  
4. 在 16 / 32 / 64 / Header 实际尺寸下目视验收  

---

## 6. 与页面视觉的关系

Logo 不是孤立贴纸，必须像从站点里长出来：

| 页面元素 | 与 logo 的对齐 |
|----------|----------------|
| 背景 | 羊皮纸暖色，logo 透明底叠上去 |
| 分割线 | 虚线 `section-rule`，logo 勿用实线粗框抢戏 |
| 强调色 | 只有墨蓝一系，与狐狸线同色 |
| 圆角 | favicon 轻圆角；主标本身无底板故无圆角 |
| 阴影 | 页面用极轻 shadow；**logo 不加投影** |
| 动效 | 至多 opacity / 文字颜色过渡；不要弹跳、旋转吉祥物 |

---

## 7. 使用场景速查

| 场景 | 用什么 | 注意 |
|------|--------|------|
| 顶栏 | 正面 PNG + SeasonX | 固定主标，勿轮换坐姿 |
| 浏览器图标 | favicon（加粗） | 与主图可同源简化 |
| OG / 分享图 | 可选正面或侧面 + 标题排版 | 大图可留白，勿拉伸变形 |
| 关于页 / 品牌故事 | 坐姿或侧面 | 可更大展示线稿美感 |
| 深色模式（若将来做） | 先定纸感是否保留；线色可反白 | 改前更新本文色表 |
| 打印 / 单色 | 纯黑线亦可 | 保持 monoline，勿网点填充 |

---

## 8. 验收清单（改完必过）

- [ ] 线色是墨蓝 `#1b365d`（或 token `--brand`），无第二彩色  
- [ ] 主标透明底、无圆框/方章（favicon 除外）  
- [ ] 单线感：无明显色块填充分层  
- [ ] 仍是狐狸，不是猫/狼/抽象一团  
- [ ] 16px favicon 仍能看出耳 + 吻的方向感  
- [ ] Header 组合：图 +「SeasonX」对齐、不拥挤  
- [ ] 与 `--parchment` 页面并置不发灰、不发冷  
- [ ] 无 AI 乱码字、无水印、无多余英文 slogan 进图  

---

## 9. 明确不要的方向（反例）

| 反例 | 原因 |
|------|------|
| 橙色写实狐狸 | 破坏「单色墨蓝」体系 |
| 圆形徽章 + 狐狸 | 偏离「无边框线稿」决策 |
| 字母 S 取代狐狸 | 已从字母标演进到动物标，勿回退除非品牌重做 |
| 厚涂插画头像 | 与 monoline / 编辑气质冲突 |
| 科技电路、火箭、终端 prompt 图形 | 博客有技术向，但品牌不是 SaaS 产品标 |
| 多姿态同时塞进 Header | 主标只保留一个识别符号 |

---

## 10. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-08 | 初版：确立墨蓝 monoline 狐狸、三变体、色板与接入位置；主标为正面头像 |

---

## 11. 相关文件索引

```text
docs/brand.md                 ← 本文
src/styles/global.css         ← 色板与字体 token
src/consts.ts                 ← SITE_TITLE / 文案
src/components/Header.astro   ← logo lockup
src/components/BaseHead.astro ← favicon / apple-touch
public/logo-fox.png           ← 主标（正面）
public/logo-fox-profile.png   ← 侧面
public/logo-fox-sitting.png   ← 坐姿
public/favicon.svg
public/favicon-32.png
public/apple-touch-icon.png
```

改品牌图形时：更新资产 → 必要时改 Header/BaseHead → **补一笔第 10 节变更记录**。
