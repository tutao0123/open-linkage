# OpenLinkage

**直接在浏览器中设计、仿真并综合平面连杆机构。**

[在线体验](https://linkage.wtt.autos/zh) · [English](README.md) · [反馈问题](https://github.com/tutao0123/open-linkage/issues)

OpenLinkage 是一个开源的平面机构设计工作台，将交互式运动学仿真、轨迹分析和目标驱动的机构综合整合在浏览器中，覆盖四杆机构、步行腿和自由拓扑机构。

在线版本无需安装，主要设计计算直接在浏览器本地完成。

## 设计工作台

| 工作台 | 可以做什么 | 打开 |
| --- | --- | --- |
| 四杆机构设计 | 分析曲柄摇杆、双曲柄和双摇杆机构；绘制目标轨迹并自动拟合杆长。 | [进入](https://linkage.wtt.autos/zh/lab) |
| 六杆腿机构综合 | 绘制足端轨迹，按照精度和传动性能比较多套 Watt 类六杆方案。 | [进入](https://linkage.wtt.autos/zh/leg) |
| 可变几何步行腿 | 通过移动固定铰点或可锁止伸缩杆，让克兰腿和简森腿适配巡航、高速和越障工况。 | [进入](https://linkage.wtt.autos/zh/variable-leg) |
| 经典直线机构 | 比较瓦特、彻比雪夫、霍肯和波塞利耶–利普金机构的行程与直线度。 | [进入](https://linkage.wtt.autos/zh/straight-line) |
| 自由机构设计器 | 从铰点和杆件开始自由搭建平面机构，指定主动件并观察运动和轨迹。 | [进入](https://linkage.wtt.autos/zh/designer) |

## 主要特点

- 可直接拖动和播放运动的交互式 SVG 工作台
- 在浏览器中完成运动学分析和机构综合
- 支持目标轨迹绘制、候选生成、方案比较和工程指标
- 使用预计算的可行走参考轨迹，提高可变几何腿首次运行成功率
- 支持的工作台可导入、导出项目 JSON
- 提供英文和简体中文界面

## 本地运行

### 环境要求

- Node.js 20.9 或更高版本
- npm

```bash
git clone https://github.com/tutao0123/open-linkage.git
cd open-linkage
npm ci
npm run dev
```

打开 [http://localhost:3000/zh](http://localhost:3000/zh)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm test` | 运行测试 |
| `npm run lint` | 运行 ESLint |
| `npm run build` | 创建生产构建 |
| `npm run i18n:generate` | 重新生成翻译字典 |
| `npm run reference-library` | 重新生成可变几何腿参考轨迹库 |

## 项目状态

OpenLinkage 正在持续开发，适合学习、机构探索和早期方案设计，不能替代公差分析、结构校核、安全评审和实物验证。

欢迎提交想法、问题和 Pull Request。参与贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按照 [SECURITY.md](SECURITY.md) 私密报告。

## 许可证

OpenLinkage 使用 [MIT License](LICENSE)。
