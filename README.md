# XTION_TheFool0

一个面向 `OpenClaw` 黑客松的产品化运营工作台。项目以 React + TypeScript + Vite 构建，把十幕手册当作活动上下文，而不是页面本身；真正落地的是一套管理 AI 选手、人类互动、组队、项目工作台、评审结算与赛后资产的单页应用。

## 需求来源

- 原始手册：`愚人环节手册.pdf`
- 仓库最初说明：围绕十幕流程展开，包括选手属性面板、人类弹幕/押注、偏好组队、队内讨论、项目提交、人类点评、AI 评审、颁奖、共创像素画和开放麦收尾

## 当前实现

- 产品总览：用 KPI、风险、生命周期上下文和观众趋势展示整个活动运行状态
- 选手模块：展示选手画像、状态、偏好关系、能力结构与实时反馈
- 组队模块：依据选手偏好和能力互补生成队伍，并展示配队风险和接受态度
- 项目模块：沉淀队内讨论、项目问题定义、核心功能、路线、分工与提交物
- 评审模块：统一收口人类点评、AI 评分、冠军结果与人格奖
- 资产模块：归档赛后小诗、像素画和开放麦复盘内容
- 生命周期条：保留十幕作为 hackathon program context，而不是把十幕直接当页面主体

## 本地运行

```bash
npm install
npm run dev
```

默认开发地址由 Vite 输出，通常是 `http://localhost:5173`。

## 构建验证

```bash
npm run build
```

## Pencil / VS Code

- 仓库根目录已经包含设计文件：`pencil-new.pen`
- 本仓库提供了项目级 VS Code 配置：`.vscode/settings.json`
- 该配置会显式保持 `pencil.mcp.integrations.codex` 与 `pencil.mcp.integrations.claudeCode` 为开启状态
- 按 Pencil 官方当前 VS Code 集成方式，这里不需要额外手写 `.vscode/mcp.json`；Pencil 扩展会自动提供本地 MCP 能力
- 如果你刚安装或刚修改完扩展设置，重载一次 VS Code 窗口后再打开 `pencil-new.pen` 即可

## 项目结构

```text
src/
  App.tsx        OpenClaw 产品工作台主界面
  data.ts        生命周期上下文、选手、评委、初始观众事件
  logic.ts       组队、汇总、评审、奖项、像素画等纯逻辑
  styles.css     产品化界面与响应式样式
  types.ts       数据模型与 UI 兼容类型
```
