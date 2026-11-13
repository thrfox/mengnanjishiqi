# 猛男计时器

看看你有多久。

纯静态页面，无需安装依赖，适用于 GitHub Pages。

## 操作

- 回车：开始 / 结束并保存。
- 空格：掐表，显示本段用时与累计用时，并在曲线上标记。横轴同时显示累计时长与实际时间。
- 连接心率设备：读取标准蓝牙 Heart Rate Service（0x180D）及 Heart Rate Measurement（0x2A37）。
- 历史：按开始时间倒序显示，上方单独展示最长记录；可查看曲线、修改备注、删除。
- 导出 / 导入：CSV 包含完整采样点、掐表和备注；重复 ID 跳过，不覆盖已有记录。CSV 文本字段前的单引号用于防止表格公式执行，导入时自动移除。
- 分享图片：先生成预览，再保存 PNG；包含 Logo、标题、网址、记录时间、总时长、曲线、最高心率、掐表与备注。

记录存于当前浏览器 localStorage，没有服务端、账号同步或数据上传。计时中每秒保存草稿；意外关闭后恢复到最后一次保存的时长，并作为已结束记录保存。换浏览器或清理网站数据前请导出。导出仅包含已结束记录。

## 心率设备

需要 HTTPS（GitHub Pages 默认提供）或 localhost，以及支持 Web Bluetooth 的电脑 Chrome / Edge、Android Chrome。Safari / iOS 浏览器无法直接使用本页面的蓝牙连接。

- 小米、华为：仅适用于能够开放标准蓝牙心率广播的具体机型，需要先开启设备的心率广播。使用私有认证、未开放广播的型号无法通过此静态页面连接。
- Apple Watch：本页面不保证原生直连。需第三方应用或桥接设备转发为标准 BLE 心率服务，再在支持 Web Bluetooth 的浏览器上连接。桥接应用兼容性取决于具体方案。
- 设备没有发送读数超过 8 秒时，实时值显示为“—”；相邻采样超过 8 秒时曲线断开，不生成虚假心率。
- 无设备也可正常计时，心率留空。本项目没有用模拟数据冒充实时读数。

单次计时上限 7 天；每次最多 10000 个掐表和 100000 个心率采样点。CSV 导入上限 30 MB。图片最多显示前 800 个掐表，CSV 保留全部数据。实际可保存记录数量取决于浏览器存储配额，空间不足时页面会提示导出。

参考：[Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)、[华为心率广播说明](https://consumer.huawei.com/ca/support/content/en-us15827504/)、[Apple Watch 蓝牙心率转发应用说明](https://pulse-link.humblemars.com/guides/apple-watch-bluetooth-heart-rate/)。

## GitHub Pages

仓库：`thrfox/mengnanjishiqi`。

在仓库 Settings → Pages 中选择 GitHub Actions，提交到 main 后由 `.github/workflows/pages.yml` 自动发布。也可选 Deploy from a branch → main → / (root)，直接发布静态页面。

预计站点地址：<https://thrfox.github.io/mengnanjishiqi/>。

源文件：`index.html`、`style.css`、`core.js`、`app.js`、`logo.svg`。无构建步骤、CDN 或外部字体。
