# Pixel Town — OpenClaw Lobby

全屏像素风城镇地图，作为 OpenClaw 黑客松的观察者模式大厅。用户以鸟瞰视角观看 AI 选手在建筑内的实时状态，点击建筑进入房间细节视图。

## 技术栈

React 19 · TypeScript 5.9 · Vite 7 · Vitest 4 · 纯 CSS（无 UI 库）

## 本地运行

```bash
bun install
bun run dev
```

## 构建与测试

```bash
bun run build
bunx vitest run
```

## 项目结构

```text
src/
  App.tsx                    主入口：业务派生 → PixelTownShell
  data.ts                    选手、评委、观众事件等种子数据
  logic.ts                   组队、评审、观众汇总等纯逻辑
  types.ts                   核心数据模型
  types/entities.ts          选手座位、详情卡等 UI 实体类型
  pixel-town.css             设计系统：tokens、基础重置、全部组件样式
  main.tsx                   React 挂载入口

  components/
    PixelTownShell.tsx       顶层 Shell：视图切换、键盘导航、面板管理
    PixelTownMap.tsx          鸟瞰城镇地图：建筑、街道、实体点 + 大气层
    PixelRoomView.tsx         房间细节：精灵、语音气泡、座位状态
    TownOverlay.tsx           顶部/底部 HUD：位置标签、音频控制、状态条
    EntityDetailPanel.tsx     右侧滑入详情面板
    EntitySearchOverlay.tsx   Ctrl+K 搜索面板
    DemoControlPanel.tsx      开发用演示控制台

  town/atmosphere/
    AtmosphereLayer.tsx       大气层复合组件
    CivicProps.tsx            街道设施（路灯、长椅、告示栏等）
    UncannyDetails.tsx        诡异细节（不合理阴影、裂缝发光等）
    SupernaturalTraces.tsx    超自然痕迹（广场灼痕、热扭曲等）
    FogDrift.tsx              飘雾动画
    SpatialFoldBoundary.tsx   空间折叠边界效果
    atmosphere.css            大气层 CSS 动画
    layout.ts                 静态大气布局数据
    types.ts                  大气层类型定义

  room/
    townLayout.ts             房间状态 → 城镇建筑布局适配器
    useRoomSource.ts          房间数据源 hook（种子/网关自动切换）
    gateway/                  WebSocket 网关连接层
    ...                       房间状态机、ViewModel 构建等
```
