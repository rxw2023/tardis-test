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
    tools/serve.js           本地静态服务器（ES 模块需要 http://）
    tools/render.js          Puppeteer 逐帧导出
    tools/contact-sheet.js   接触表生成
    public/vendor/           p5.js 2.0.3（LGPL-2.1）、p5.brush（MIT）

## 用法

    npm install                     # 安装 puppeteer-core
    npm run serve                   # http://127.0.0.1:8846/ 预览（空格播放，←/→ 跳 5 秒）
    npm run render -- --from 5 --to 11 --fps 30 --out frames/run
    npm run sheet -- frames/run     # 生成接触表 HTML

## 时间轴

| 区段 | 时长 | 内容 |
|---|---|---|
| 片头 | 2.5 小节 = 5s | 纸张质感、纪录片字幕、时空舱驶入 |
| 20 版块 | 各 3 小节 = 6s | 第 1 小节进场 / 第 2 小节高光 / 第 3 小节过框 |
| 片尾 | 6 小节 = 12s | 新闻发布会，7×3 展墙推向第 21 格 |

全片 137s。每个版块在 1000×1000 单位空间内作画，输出 1920×1080
（中央 1080×1080 正方形 + 两侧 420px 边区）。
