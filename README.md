# 《塔迪斯测试》

约 2:17 的代码动画短片：一辆原创时空舱沿一条贯穿全片的时间公路，
依次穿过 20 个时代 / 地域 / 艺术风格的版块，每过一道画框就换一种画风。
120 BPM，一小节 2 秒；每次过画框都落在强拍上。

> 版权边界：「塔迪斯 / TARDIS」与《神秘博士》为 BBC 受保护 IP。
> 本片仅以其为内部灵感，成片使用原创时空舱与原创驾驶员设计，
> 不复刻蓝色警亭外观、灯箱文字、logo 或音效。目录名仅为内部代号。
> 参考仓库 Tunai-0511/meme67-art-history 只借鉴"做法"（kit + 纯函数场景 + 逐帧渲染），
> 不取用其影片、帧、音频与美术简报文字；详见 NOTICE.md 与 THIRD_PARTY_NOTICES.md。

## 结构

    src/beat/beats.js        时间轴（唯一时间源）：120BPM、版块切换、过框判定、路线进度
    src/kit/                 共用绘图工具包：颗粒/晕影/标题卡/素描笔触、时间公路
    src/rig/capsule.js       参数化时空舱（+ 驾驶员剪影）；姿态由 beats 驱动
    src/scenes/meta.js       20 个版块元数据与配色
    src/scenes/placeholder.js  阶段 1 占位场景（阶段 2/3 逐格替换为正式场景）
    src/scenes/intro.js      片头：一本正经地胡说（5s）
    src/scenes/outro.js      片尾：新闻发布会（12s，7×3 展墙）
    src/main/main.js         主调度：镜头/边区/画框/标题卡/预览 UI

    src/audio/theory.js      音阶库与变体映射（同一旋律换音阶=换时代）
    src/audio/melody.js      全片唯一的主旋律（12 小节 A 小调骨架）+ 和声进行
    src/audio/synth.js       Web Audio 合成原语（零采样：拨弦/FM/管乐/弓弦/鼓/混响）
    src/audio/engine.js      总线 + 全片编排：把同一条旋律喂给每个版块的乐器
    src/audio/player.js      预览页播放器（画面时间跟音频时钟走）
    src/audio/sections/      20 个版块的「音乐皮肤」a01…a20 + 片头片尾

    tools/serve.js           本地静态服务器（ES 模块需要 http://）
    tools/render.js          Puppeteer 逐帧导出
    tools/render-audio.js    无头 Chrome 跑 OfflineAudioContext → WAV
    tools/audio-stats.js     WAV 分段 RMS / 峰值（有没有声音、有没有过响）
    tools/audio-spec.js      短时频谱探针（看主旋律基频对不对）
    tools/mux.js             帧序列 + WAV → MP4
    tools/gen-audio-index.js 扫描并重写音频版块注册表
    tools/contact-sheet.js   接触表生成
    public/vendor/           p5.js 2.0.3（LGPL-2.1）、p5.brush（MIT）

## 用法

    npm install                     # 安装 puppeteer-core
    npm run serve                   # http://127.0.0.1:8846/ 预览（空格播放，←/→ 跳 5 秒）
    npm run render -- --from 5 --to 11 --fps 30 --out frames/run
    npm run sheet -- frames/run     # 生成接触表 HTML

    npm run audio                   # 渲染整片音轨 -> audio/film.wav（约 3 分钟）
    npm run audio -- --scene 18     # 只渲染第 18 格，自检用
    npm run stats -- audio/film.wav 3
    npm run spec -- audio/scene18.wav --at 2.7,2.95
    npm run mux -- --frames frames/run --fps 60 --audio audio/film.wav --out out/film.mp4

音频也支持在浏览器里试听：开 serve 后打开 /audio.html（可整片渲染，也可下拉选单版块）。

## 时间轴

| 区段 | 时长 | 内容 |
|---|---|---|
| 片头 | 2.5 小节 = 5s | 纸张质感、纪录片字幕、时空舱驶入 |
| 20 版块 | 各 3 小节 = 6s | 第 1 小节进场 / 第 2 小节高光 / 第 3 小节过框 |
| 片尾 | 6 小节 = 12s | 新闻发布会，7×3 展墙推向第 21 格 |

全片 137s。每个版块在 1000×1000 单位空间内作画，输出 1920×1080
（中央 1080×1080 正方形 + 两侧 420px 边区）。

## 音乐

全片只有**一条**主旋律（12 小节，A 小调骨架），20 个版块各取 3 小节，
5 次循环正好走完 60 小节；每个版块只决定「用什么乐器、什么音阶演奏它」：

- 旋律以「相对主音的半音数」存储，每格按该时代音阶做就近吸附
  （埃及 Hijaz 出增二度、浮世绘都节音阶、甘美兰 pelog、全音阶…），
  于是轮廓始终是同一条，听感却一直在换。
- 全部 Web Audio 程序合成，没有任何采样或素材：拨弦用加法合成（泛音各自衰减）、
  钟与锣用非整数比 FM、管乐是三角波+气声噪声、混响 IR 也是现算的。
- 过框音（21 次）是贯穿全片的节奏锚点：风声 + 金属拨响 + 低频推力。
- 第 18 格蒸汽波是唯一的「磁带型」版块：素材先以 151.2 BPM 生成并升 4 个半音，
  主时间轴以 playbackRate 0.7937 播放降回 120BPM 与主调；进框减速、出框加速，
  第 2 小节每个音重复两遍做跳针，再叠大混响、4kHz 低通、0.5Hz 摇晃与磁带底噪。
