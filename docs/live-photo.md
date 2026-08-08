# Live Photo 规范

将 iPhone Live Photo 导入本站的标准流程：本地脚本转码 + 提取地理信息，组件只引用生成的 meta。

## 目录约定

```text
public/images/live/<slug>/
  photo.jpg      # 静图（Web JPEG）
  video.mp4      # 短视频 H.264 + AAC（含环境声）
  meta.json      # 与 src 侧同内容的 sidecar（可选查阅）

src/data/live/
  <slug>.json    # ★ 组件 / 页面 import 用
```

默认 **`<slug>` = 拍摄时间** `YYYY-MM-DD-HHmmss`（优先 MOV 本地拍摄时间，例如 `2025-04-18-181243`）。  
可用 `--slug` 或 `--slug-from name` 覆盖。

| 路径 | 职责 |
|------|------|
| `public/images/live/<slug>/` | 浏览器可访问的静态资源 |
| `src/data/live/<slug>.json` | 构建期 import：URL、尺寸、GPS、地名 |

**不要**手写路径拼 `photo`/`video`；以 meta 为准。

## 导入命令

依赖（macOS）：`sips`、`ffmpeg`、`ffprobe`、`mdls`。

```bash
# 最简：同目录 HEIC + MOV → slug 按拍摄时间命名
pnpm live:import ~/Downloads/IMG_8279.HEIC
# 例：→ public/images/live/2025-04-18-181243/

# 显式指定视频与文案
pnpm live:import ~/Downloads/IMG_8279.HEIC ~/Downloads/IMG_8279.MOV \
  --alt "Sunset over the ocean and volcano" \
  --force

# 改用原文件名作 slug（img-8279）
pnpm live:import ~/Downloads/IMG_8279.HEIC --slug-from name

# 完全自定义 slug
pnpm live:import ~/Downloads/IMG_8279.HEIC --slug bali-sunset --force

# 不请求 OSM 反查（仅保留 GPS 坐标）
pnpm live:import ~/Downloads/IMG_8279.HEIC --no-geocode
```

### 常用选项

| 选项 | 说明 |
|------|------|
| `--slug <name>` | 自定义输出 id（优先于 `--slug-from`） |
| `--slug-from time\|name` | 默认命名：`time` 拍摄时间（默认）/ `name` 源文件名 |
| `--alt` / `--caption` | 写入 meta 的默认文案 |
| `--width <n>` | 静图最大宽，默认 1600 |
| `--video-max <n>` | 视频长边最大，默认 1280 |
| `--no-geocode` | 跳过 Nominatim 反查 |
| `--force` | 覆盖已有目录 / meta |
| `--dry-run` | 只打印计划 |

脚本入口：`scripts/import-live-photo.mjs`（`package.json` → `live:import`）。

## 照片墙

导入成功后，meta 会进入 `src/data/live/`，**照片墙**页（`/photos`）通过 `listLive()` 自动收录，无需再改页面代码。

- 导航：顶栏「照片墙」
- 排序：按 slug（拍摄时间）新 → 旧
- 组件：`variant="wall"`（网格间距更紧）

```astro
---
import LivePhoto from '../components/LivePhoto.astro';
import { listLive } from '../utils/live-photo';

const photos = listLive({ order: 'desc' });
---

{photos.map((meta) => <LivePhoto meta={meta} variant="wall" />)}
```

## 在页面 / MDX 中使用

```astro
---
import LivePhoto from '../../components/LivePhoto.astro';
import { getLive } from '../../utils/live-photo';

// 用 slug 加载（不要直接 import 以数字开头的 json 路径，dev 下可能解析失败）
const live = getLive('2025-04-18-181243');
---

<LivePhoto meta={live} />

<!-- 覆盖 alt / 地点 -->
<LivePhoto meta={live} alt="自定义描述" />

<!-- 照片墙网格用紧凑变体 -->
<LivePhoto meta={live} variant="wall" />
```

图下固定三行：

1. **时间** — 时钟图标 + 当地拍摄时间（如 `2025-04-18 18:12 UTC+8`）  
2. **地址** — 图钉 + `place.label`（完整地名原文，不用 region；单行溢出省略）  
3. **经纬度** — 单独一行，可点开地图（单行溢出省略）  

**alt** 仅作无障碍文本，并在鼠标悬停画面时以 tooltip 显示。

### Meta 主要字段

```ts
{
  id: string             // "live/<slug>"
  slug: string           // 默认 YYYY-MM-DD-HHmmss
  photo: string          // "/images/live/<slug>/photo.jpg"
  video: string
  width: number
  height: number
  duration: number
  hasAudio: boolean
  alt?: string
  caption?: string
  source: { still, video, device, capturedAt, … }
  gps?: { latitude, longitude, altitude, … }
  place?: { name, region, state, country, label, … }  // 原文地名，不翻译
  maps?: { apple, google, osm }
  importedAt: string
}
```

类型定义：`src/utils/live-photo.ts`。

## 交互约定（组件）

| 操作 | 行为 |
|------|------|
| 悬停 | 播放画面；声音常被浏览器拦截 → 静音预览 |
| 点击 / LIVE / 长按 | 有声播放（用户手势） |
| `sound={false}` | 全程静音 |
| `autoplayOnce` | 入视口播一次，**强制静音** |
| 地址 / 坐标 | 第二行 `place.label`，第三行经纬度；均可链到 `maps.apple` |

## 从 iPhone 准备源文件

1. 确认照片带 **LIVE**。
2. 隔空投送到 Mac 时通常进「下载」；需同时有：
   - `IMG_xxxx.HEIC`（或 JPEG）
   - `IMG_xxxx.MOV`
3. 若只有 HEIC：再从手机「存储到文件」或确认 iCloud 图库完整后重传。
4. 两文件就绪后执行 `pnpm live:import …`。

## 地理信息

- GPS 来自 HEIC（`mdls`）与 MOV（QuickTime `ISO6709`）。
- 地名默认请求 OpenStreetMap Nominatim，**使用返回的原文**，不做强制翻译。
- 无网或失败时仍写入 `gps` + 坐标地图链接，`place` 可为 `null`。

## 清单（写文章前）

- [ ] 源文件 HEIC + MOV 成对  
- [ ] `pnpm live:import …` 成功（默认 slug 为拍摄时间）  
- [ ] `src/data/live/<slug>.json` 存在  
- [ ] 页面 `getLive('<slug>')` + `<LivePhoto meta={…} />`  
- [ ] 本地确认：画面、声音、地点链接  
