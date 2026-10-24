# 版块技术契约（每个子代理开工前必读）

项目根目录：仓库根目录（下文命令都从这里执行）
预览服务器已在 `http://127.0.0.1:8846/` 运行（**不要重启它**）。

## 你只许改一个文件

新建并只写你自己的 `src/scenes/sNN-<slug>.js`。
**严格禁止**修改 `src/scenes/index.js`（主代理统一注册）、`src/main/main.js`、`src/kit/*`、`src/rig/*`、`src/beat/*`、`src/scenes/meta.js`，以及任何其他版块的文件。
如果你认为共用工具包缺东西，**不要自己改**，在最终汇报里写清楚需要什么，主代理统一加。

## 场景模块接口

```js
// 必须
export function render(g, meta, local, index) { }
//   g     = p5 实例，坐标已变换到 1000×1000 单位空间，(0,0) 在左上
//   meta  = { zh, en, era, bg, ink, accent }（来自 src/scenes/meta.js，十六进制字符串）
//   local = 本版块内时间 0..6 秒（不要在内部算全局时间）
//   只画「地面以上」的内容：天空、建筑、人物、装饰。公路、画框、标题卡由主调度画。

// 可选：版块内推镜（第 2 小节推近再拉回）
export function camera(local) { return { z: 1, fx: 500, fy: 500 }; }
//   返回 { z: 1 } 等于不推镜。z 建议不超过 2.6。
//   推镜时公路、舱体、你的场景共用同一变换，不会被落下。

// 可选：本版块自己的时空舱画法（水墨/皮影/示波器/只画影子等）
export function drawVehicle(g, { x, y, local, t, wave }) { }
//   x = 舱体横坐标（routeU(local)*1000），y = 890（贴地线）
//   t = 全局时间（只有漩涡相位等跨版块连续量才用）
//   wave = true 表示正处第 2 小节高光（驾驶员挥手）
//   默认实现是 drawCapsule(g, x, y, 1, { t, hoverLocal: local, driverPose: { t, wave } })
```

## 时间轴常量（`src/beat/beats.js`）

```js
BPM 120, BEAT 0.5s, BAR 2s, SCENE_LEN 6s, TAU = 2π
smooth(a, b, x)                 // 平滑阶跃
routeU(local)   → 0..1          // 舱体路线进度：第1小节 0.02→0.42，第2小节 0.42→0.50（慢），第3小节 0.50→1.02
hoverY(local)                   // 悬浮起伏（周期两拍）+ 强拍下沉，单位空间
swirlAngle(t)                   // 时间漩涡相位（一圈 = 两拍）
```
你的版块 index i 在全片的时间窗是 `[5 + 6*i, 11 + 6*i]`。

## 共用工具

`src/kit/kit.js`：
```js
mulberry32(seed)                // 可复现伪随机，禁止 Math.random()
rr(g,x,y,w,h,r) / rrFill / rrStroke   // 圆角矩形（走原生 ctx，稳）
grain(g,x,y,w,h,seed,strength)  // 颗粒叠加（已缓存）
vignette(g,x,y,w,h,strength)    // 柔和径向晕影
catmull(pts, perSeg)            // 手排转折点 → 平滑点列
inPoly(x, y, poly)              // 点在多边形内
lerp(a,b,u)
```

`src/kit/ink.js`（水墨五格 3/4/6/9 及 5 共用）：
```js
paper(g, { w,h,scale,seed,base,fiber,mottle })  // 宣纸底（缓存，返回 p5.Graphics）
paperInto(pg, w, h, opt)                        // 在已有画布上铺纸底
inkStroke(g, pts, { rgb, alpha, weight, taper, dry, wobble, seed })  // 毛笔线
dryLine(g, x1,y1,x2,y2, { rgb, alpha, weight, dry, seed })           // 单笔短画/皴
blot(g, x, y, r, { rgb, alpha, layers, seed })  // 晕染点
mistBand(g, x, y, w, h, alpha, seed)            // 云气带
seal(g, x, y, s, text)                          // 朱红印章
highlight(g, x, y, w, h, alpha)                 // 纸面留白补光
```

`src/rig/capsule.js`：
```js
drawCapsule(g, x, y, s, { capsule, t, hoverLocal, driverPose })
DEFAULT_CAPSULE = { w:178, h:196, body:'#1f8a94', bodyDark:'#14606a',
                    trim:'#c9973f', lamp:'#ffd97a', glass:'#0d3940',
                    windowCols:3, windowRows:2 }
```
改配色/比例请传 `capsule: { body:'#xxx', ... }`，不要改 rig 文件。

## 版面几何（必须遵守）

- 单位空间 1000×1000，映射到屏幕中央 1080×1080（左右各 420px 边区）。**画面只保证中央正方形可见**，左右边区会被深色幕布覆盖 —— 不要把关键内容放到 x<30 或 x>970。
- 路面带：`y 770..940`，车道中线 `y 902`，舱体贴地 `y 890`。
- **不要画公路**（`drawRoadUnit` 由主调度在你的 render 之后画）。如果你的版式需要"地面"，请把地面画在 y<770 区域，或设计成让公路自然融入（例如把 y 770..940 当成水面/沙地/街道上部，但公路会盖上去）。
- 顶部 y<80 建议留空（过框时门柱会发光）。

## 三条硬性规则

1. **纹理必须缓存**：`g.createGraphics` 只能在模块级 `let layer = null` 里做一次（第一次调用时生成，之后复用）。每帧重建会让逐帧导出慢到不可用。
2. **随机数必须用固定种子的 `mulberry32`**，禁止 `Math.random()`，禁止依赖 `Date.now()`。逐帧渲染时每帧是独立进程调用，随机值会闪烁。
3. **每帧可重入**：不依赖上一帧状态，不在 render 里累加计数器。

## p5 2.x 已踩过的坑（照抄这些做法）

- `beginShape()` + `bezierVertex()` 会抛错 → 用独立 `g.bezier(...)` 或先 `vertex()` 打底再 `bezierVertex`。保险起见全用 `vertex` 或独立曲线。
- 在 `drawingContext.save()` 里混用 `ctx.filter = 'blur()'` 与 p5 形状调用，图形会**整个不显示** → 二选一：要么纯 ctx 画，要么纯 p5 画。
- 设了 `ctx.fillStyle = grad` 后再调 `g.rect()` 会被 p5 的 fill 覆盖 → 渐变填充一律用 `ctx.beginPath(); ctx.rect(...); ctx.fill()`。
- 逐段 `line()` 堆毛笔线会有"串珠感" → 用变宽度多边形填充，或用 `inkStroke`。

## 自查与交付流程

Node 要求 18 或以上，命令里直接用 `node`。

```bash
cd <repo>                                                # 仓库根目录
node --check src/scenes/sNN-slug.js                      # 1 语法
node tools/probe.js <全局时间点>                          # 2 抓页面报错 + 单帧耗时
node tools/render.js --scene NN --times 0.5,2.2,3.2,4.2,5.2,5.9 --out frames/<slug>   # 3 出 6 帧
```
`--scene NN` 里的 NN 是**版块序号 1..20**（不是 index），`--times` 后面跟的是**版块内局部时间 0..6**，脚本会自动加 `5 + 6*(NN-1)` 换算成全局时间。
你的场景已经在 `src/scenes/index.js` 里注册好了（占位版本），直接渲染就能看到你的实现，**不需要也不许改 index.js**。

然后用 Read 工具逐张看 `frames/<slug>/shot_*.png`，自己判断画面是否成立：
- 主体是否一眼能认出是这个时代/这个风格
- 有没有糊成一团噪点、糊成灰色、元素互相重叠打架
- 舱体（或你自定义的舱体形态）在 6 个时间点上都可见、都在合理位置
- 文字（如果有）在 1080p 下清晰可读

不满意就改，改完重跑。至少迭代到你自己判"能看"为止，**不要第一版就交稿**。

## 版权红线（违反即退回）

- 只致敬**已进入公有领域**的作品/风格；不得复刻任何具体作品的构图到可辨认的程度（例如《星月夜》只能取"漩涡星空 + 柏树 + 村庄"的母题，不能描摹原画构图）。
- 不得出现任何真实品牌、logo、吉祥物、界面元素。聊天软件/短视频/游戏/编辑器全部用**虚构名称与自绘图标**。
- 不得使用任何《神秘博士》/塔迪斯相关视觉：无蓝色警亭、无 POLICE BOX 字样、无圣约翰徽章。我们的时空舱是青瓷+黄铜、3×2 横窗、六角灯笼、宽扁比例（见 `src/rig/capsule.js` 顶部注释）。
- 不使用任何外部图片/字体文件/音频素材；中文字体只用系统字体栈，例如
  `const ZH = '"KaiTi","STKaiti","SimSun",serif'` 或 `const SANS = '"Microsoft YaHei","PingFang SC",sans-serif'`。
