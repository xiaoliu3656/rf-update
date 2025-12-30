# RF Update Template

本 ZIP 里包含两部分：

1) `rf-update-remote/`：这是“远程发布仓库”的根目录内容，把里面的文件上传到 GitHub 仓库根目录即可。
2) `shell/`：壳脚本（Tampermonkey/Greasemonkey），安装在浏览器里。

## 远程仓库必须文件
- `manifest.json`（必须）
- `modules/*`（manifest 引用到的模块必须存在）

可选但推荐
- `about.json`
- `changelog.json`

## 你给的 changelog 链接（完整同路径）
- changelog: https://raw.githubusercontent.com/xiaoliu3656/rf-update/refs/heads/main/changelog.json
- manifest:  https://raw.githubusercontent.com/xiaoliu3656/rf-update/refs/heads/main/manifest.json
- about:     https://raw.githubusercontent.com/xiaoliu3656/rf-update/refs/heads/main/about.json
- module:    https://raw.githubusercontent.com/xiaoliu3656/rf-update/refs/heads/main/modules/sidebar-admin.js

## 模板内示例
- `modules/sidebar-admin.js`：根据你提供的截图注入一个“后台侧边菜单”（可折叠 + 子菜单）。

## sha256（可选）
如果你在壳里开启 strictVerify，就需要 manifest.json 里为每个模块提供 sha256。
- `tools/sha256.js`：Node 计算工具
