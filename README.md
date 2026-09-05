# 向内生长 · 学习与复盘

暖白纸色、杂志排版的个人学习空间。电脑本地编辑，GitHub Pages 公开阅读。

## 使用

- 双击 `打开学习平台.cmd`，或运行 `npm start` 后打开 http://127.0.0.1:4186。
- 首页继续学习，资料库打开 PDF 原页，框选后建卡；卡片可以关联复盘、转成速记卡并安排复习。
- 在“设置与发布”点击“一键发布”。以“公网已更新”及版本号为成功依据。
- 公开网址：https://pf11223333.github.io/growth-study-platform/
- 公开版不具备上传、正式编辑或复习结果写入能力；阅读位置保存在当前浏览器。

## 安装与维护

Node.js 24、Python（Pillow）、Poppler（pdftoppm）和已登录的 GitHub CLI。当前机器使用 Codex bundled Python；换电脑可通过 `GROWTH_PYTHON` 指定已安装 Pillow 的 Python 路径。

```powershell
npm ci
npm run import
npm run previews
npm run build
npm test
npm run verify
npm start
```

`npm run publish` 与页面发布按钮使用同一脚本。GitHub 原文件附件使用 SHA-256 名称，代码使用 `main` 分支，通过 GitHub API 同步；已验证站点打包后由 GitHub Actions 部署，避免本机 Git 代理故障影响发布。整个发布过程有锁，重复点击不会并行发布。

## 数据与迁移

- `data/platform.json`：独立结构化数据，保留旧 ID、来源、AI 分层、导入指纹及编辑版本。
- `data/originals`：按 SHA-256 保存的原文件，任何界面编辑不修改原文件。
- `data/previews`：逐页轻量与高清预览，标注使用页面归一化坐标。
- `data/backups`：记录快照。完整灾备必须复制整个 `data`，不能只复制快照。
- `data/migration-report.json`：迁移数量与缺失源文件报告。
- `data/publish-status.json`：最后发布结果及公网验证版本。

首次导入保留旧网站不动。后续增量导入保留新平台编辑，冲突在设置页提供两个版本供选择。原有自动化继续生成旧站资料，发布前可通过“检查并导入”接入。

公开构建只导出内容字段，不导出本机路径和钥匙。原内容已按用户选择公开；不要将 GitHub 凭证填入任何资料字段。服务器绑定 127.0.0.1，并通过本机 Origin、Host 和会话令牌检查写入。

## 回退

本地：设置页先创建快照，再选择历史快照恢复；恢复前自动备份当前内容。
线上：本地恢复所需快照后重新发布。失败发布保留最后一个已经部署的版本；不要把“提交成功”当成“公网更新成功”。

已知边界：旧卡没有坐标时只定位到页，需手动框选补标；免费 GitHub 网络速度受访问地区和网络影响；手机不向电脑同步写入；不配置付费 AI 或云端服务。
