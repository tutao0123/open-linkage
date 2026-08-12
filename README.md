# OpenLinkage

[中文](README.md) | [English](README.en.md)

OpenLinkage 是一个开源、浏览器端的平面机构设计与自动综合平台。你可以快速分析经典机构，也可以从铰点和杆件开始搭建自己的平面机构。

## 功能概览

- 四杆机构参数编辑、运动分析、轨迹绘制与尺寸综合
- 六杆腿足端轨迹绘制、多候选方案综合与传动性能评价
- 克兰腿、简森腿等可变几何步行腿的多工况轨迹综合
- 瓦特、彻比雪夫、霍肯、波塞利耶等经典直线机构对比
- 支持任意平面拓扑的自由机构设计器

## 本地开发

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。

常用命令：

```bash
npm run lint   # 检查代码
npm test       # 运行测试
npm run build  # 构建生产版本
```

## 在线体验

- 官网：<https://linkage.wtt.autos>
- 四杆实验室：<https://linkage.wtt.autos/lab>
- 六杆腿实验室：<https://linkage.wtt.autos/leg>
- 可变几何步行腿：<https://linkage.wtt.autos/variable-leg>
- 自由机构设计器：<https://linkage.wtt.autos/designer>

## 路线图

- 0.1：四杆机构基础设计与分析（已上线）
- 0.2：通用平面约束机构
- 0.3：手绘闭合轨迹与浏览器端四杆自动拟合（基础版已上线）
- 0.4：Watt 类六杆腿轨迹综合与传动性能评价（已上线）
- 0.5：克兰/简森可变几何步行腿、多工况轨迹族综合与自由设计器传递（已上线）

## 许可证

本项目采用 [MIT License](LICENSE) 开源。
