# Model Rumble

Three.js + TypeScript + Vite 浏览器平台格斗游戏；正式代码在 `game/src/`，旧版在 `game/legacy/`，不参与构建。

- 保留角色梗与现有工作区改动；模型资料以可核验官方来源为准。AI 难度只影响决策，不改变角色属性。
- 模型材质存在共享缓存，替代配色必须克隆材质，不能污染另一玩家或预览。
- 修改前阅读 `README.md`；角色与技能资料见 `game/src/rumble/roster.ts`；音效任务参考 `game/public/assets/audio/arcade-v3/manifest.json` 及按需使用 media-generation skill。
- 验证：在 `game/` 执行 `npm run build`、`npm test`；交互或音频改动按需运行 `npm run test:browser`，复用 tmux `model-rumble-game-dev`（5188）。
- 临时文件复用 `scratchpad/`，完成后清理本次无用中间文件。
