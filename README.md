# 猛男计时器

看看你有多久。

纯静态页面，无需安装依赖，适用于 GitHub Pages。

## 操作

- 回车：开始 / 结束并保存。
- 空格：掐表，显示本段用时与累计用时，并在曲线上标记。横轴同时显示累计时长与实际时间。
- 连接心率设备（高亮按钮）：采用已验证 demo 的全部设备选择方式，再订阅标准心率服务（0x180D）的心率通知（0x2A37）。页面打开会自动尝试连接已授权的手环；首次访问或无法恢复授权时提示点击选择设备。localhost demo 的授权不能直接用于正式网站。连接后立即显示实时心率，不需要先计时。断线最多自动重试 3 次，主动断开后不重试。
- 历史：按开始时间倒序显示，上方单独展示最长记录；可查看曲线、修改备注、删除。
- 导出 / 导入：CSV 包含完整采样点、掐表和备注；重复 ID 跳过，不覆盖已有记录。CSV 文本字段前的单引号用于防止表格公式执行，导入时自动移除。
- 分享图片：先生成预览，再保存 PNG；包含 Logo、标题、网址、记录时间、总时长、曲线、最高心率、掐表与备注。

记录存于当前浏览器 localStorage，没有服务端、账号同步或数据上传。计时中每秒保存草稿；意外关闭后恢复到最后一次保存的时长，并作为已结束记录保存。换浏览器或清理网站数据前请导出。导出仅包含已结束记录。

## 分组与分享

每次空格掐表结束一组，结束计时前的最后一段也算一组。图内显示各组时长，下方分组条保留所有组；很窄的组在图内用序号表示。历史记录可展开查看每组时长与最高心率，并显示全程最高心率所在组的时长。恰好在掐表边界收到的心率归于刚结束的一组；最高值并列时取最先出现的组。没有心率采样的组显示“—”，不会填造读数。旧记录和 CSV 会根据原有掐表与采样自动计算，无需迁移。

分享贺词使用默认娱乐估算：70 kg、活动强度 4 MET；能量为 `4 × 70 × 时长（小时）` kcal。文案中的“卡路里”按日常运动热量用法指千卡（大卡）。每次生成预览，从快走、慢跑、骑行、游泳、羽毛球、篮球、乒乓球、网球、排球、足球中随机选一种，并按对应 MET 换算等效时长。保存图片沿用这次预览的结果，不再抽选。按用户要求，图上不显示估算依据，仅用“约”表示。此估算不使用心率，也不是设备测得的能量。

参考：[2024 Adult Compendium](https://pacompendium.com/adult-compendium/)、[Sports](https://pacompendium.com/sports/)、[Walking](https://pacompendium.com/walking/)、[Running](https://pacompendium.com/running/)、[Bicycling](https://pacompendium.com/bicycling/)、[Water Activities](https://pacompendium.com/water-activities/)。

## 心率设备

需要 HTTPS（GitHub Pages 默认提供）或 localhost，以及支持 Web Bluetooth 的电脑 Chrome / Edge、Android Chrome。Safari / iOS 浏览器无法直接使用本页面的蓝牙连接。

- 小米、华为：仅适用于能够开放标准蓝牙心率广播的具体机型，需要先开启设备的心率广播。使用私有认证、未开放广播的型号无法通过此静态页面连接。
- Apple Watch：本页面不保证原生直连。需第三方应用或桥接设备转发为标准 BLE 心率服务，再在支持 Web Bluetooth 的浏览器上连接。桥接应用兼容性取决于具体方案。
- 设备没有发送读数超过 15 秒时，实时值显示为“—”；相邻采样超过 15 秒时曲线断开，不生成虚假心率。
- 无设备也可正常计时，心率留空。本项目没有用模拟数据冒充实时读数。

单次计时上限 7 天；每次最多 10000 个掐表和 100000 个心率采样点。CSV 导入上限 30 MB。图片最多显示前 800 组，CSV 保留全部数据。实际可保存记录数量取决于浏览器存储配额，空间不足时页面会提示导出。

参考：[Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)、[华为心率广播说明](https://consumer.huawei.com/ca/support/content/en-us15827504/)、[Apple Watch 蓝牙心率转发应用说明](https://pulse-link.humblemars.com/guides/apple-watch-bluetooth-heart-rate/)。

## GitHub Pages

仓库：`thrfox/mengnanjishiqi`。

在仓库 Settings → Pages 中选择 GitHub Actions，提交到 main 后由 `.github/workflows/pages.yml` 自动发布。也可选 Deploy from a branch → main → / (root)，直接发布静态页面。

预计站点地址：<https://thrfox.github.io/mengnanjishiqi/>。

源文件：`index.html`、`style.css`、`core.js`、`app.js`、`logo.svg`。无构建步骤、CDN 或外部字体。
