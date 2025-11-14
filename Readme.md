# CustomizeChromePlugin - Chrome标签页冻结插件

一个用于管理和冻结Chrome标签页的浏览器插件，帮助用户优化浏览体验并节省系统资源。

## 📚 文档导航

### 快速开始
- **[用户指南 (中文)](docs/guides/README-zh.md)** - 中文版使用说明
- **[User Guide (English)](docs/guides/README.md)** - English user guide

### 开发计划与路线图
- **[开发计划](docs/planning/DEVELOPMENT_PLAN.md)** - 项目开发计划和阶段目标
- **[开发路线图](docs/planning/DEVELOPMENT_ROADMAP.md)** - 长期发展路线图
- **[项目里程碑](docs/planning/PROJECT_MILESTONES.md)** - 关键里程碑和交付物
- **[技术路线图](docs/planning/TECHNICAL_ROADMAP.md)** - 技术架构和发展规划

### 项目报告
- **[最终测试报告](docs/reports/FINAL_TEST_REPORT.md)** - 完整测试结果和性能分析
- **[页面可见性修复报告](docs/reports/PAGE_VISIBILITY_FIX_REPORT.md)** - Page Visibility API集成详情
- **[实时更新优化报告](docs/reports/REAL_TIME_UPDATE_OPTIMIZATION_REPORT.md)** - 性能优化实施报告
- **[活动标签状态修复报告](docs/reports/ACTIVE_TAB_STATUS_FIX_REPORT.md)** - 标签状态检测优化
- **[白名单集成报告](docs/reports/WHITELIST_INTEGRATION_REPORT.md)** - 白名单功能实现报告
- **[冻结逻辑测试报告](docs/reports/FREEZE_LOGIC_TEST.md)** - 标签冻结功能测试结果
- **[代码审查记录 (2025-08-05)](docs/reports/2025-08-05-review-code.txt)** - 代码审查和优化记录

## 🚀 功能特性

- ✅ 标签页冻结/解冻
- ✅ 实时活动状态检测
- ✅ 白名单管理
- ✅ 一键恢复所有冻结标签
- ✅ Page Visibility API集成

## 📦 项目结构

```
├── src/                    # 源代码
├── public/                 # 静态资源
│   ├── icon/              # 图标文件 (SVG/PNG)
│   └── icons/             # 备用图标
├── dist/                  # 构建输出
├── docs/                  # 项目文档
│   ├── guides/           # 用户指南
│   ├── planning/         # 开发计划
│   └── reports/          # 项目报告
└── package.json           # 项目配置
```

## 🔧 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 📄 许可证

MIT License

---

*本文档索引最后更新: 2025-11-14*