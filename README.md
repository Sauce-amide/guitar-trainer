# 🎸 吉他指板音符训练器

一个帮助吉他学习者训练指板音符识别的 Web 应用。

## 🌟 功能特点

- **音符识别训练**：随机显示音符，通过麦克风实时识别你弹奏的音符
- **吉他调音器**：内置专业调音器，支持标准六弦调音
- **自定义训练**：
  - 选择要训练的音符（12 个半音可选）
  - 设置训练时长（1-60 分钟）
  - 设置每个音符超时时间（1-30 秒）
- **实时反馈**：
  - 波形可视化
  - 频率显示
  - 音高偏差指示
  - 超时倒计时进度条
- **训练统计**：完成后显示准确率和用时

## 🚀 在线使用

访问：[https://sauce-amide.github.io/guitar-trainer/](https://sauce-amide.github.io/guitar-trainer/)

## 💻 本地运行

1. 克隆仓库：
```bash
git clone https://github.com/Sauce-amide/guitar-trainer.git
cd guitar-trainer
```

2. 启动本地服务器：
```bash
python3 -m http.server 8000
```

3. 在浏览器中打开：`http://localhost:8000`

## 📱 浏览器支持

- ✅ Safari (推荐)
- ✅ Chrome
- ✅ Edge
- ⚠️ 需要 HTTPS 才能访问麦克风

## 🛠️ 技术栈

- 纯原生 JavaScript（无外部依赖）
- Web Audio API（音频处理）
- YIN 算法（音高检测）
- HTML5 Canvas（波形可视化）
- LocalStorage（设置持久化）

## 📂 项目结构

```
.
├── index.html              # 单体版本（用于部署）
├── guitar-trainer.html     # 单体版本（原始文件）
└── guitar-trainer-modular/ # 模块化版本（用于学习）
    ├── index.html
    ├── css/
    │   ├── main.css
    │   ├── screens.css
    │   └── tuner.css
    └── js/
        ├── constants.js
        ├── yin-algorithm.js
        ├── audio-processing.js
        ├── pitch-detection.js
        ├── tuner.js
        ├── training.js
        ├── ui.js
        └── main.js
```

## 📖 使用说明

### 训练模式

1. 选择要训练的音符
2. 设置训练时长和超时时间
3. 允许浏览器访问麦克风
4. 点击"开始训练"
5. 根据显示的音符弹奏对应的音

### 调音器模式

1. 点击"🎸 调音器"进入调音模式
2. 选择要调的弦
3. 弹奏该弦，根据指针调整音高
4. 指针居中且显示绿色即为音准

## 🎯 超时功能

- 每个音符有独立的倒计时
- 进度条颜色变化：绿色 → 黄色 → 红色
- 超时自动跳过到下一个音符
- 可在设置中调整超时时间（1-30 秒）

## 📝 开发说明

该项目提供两个版本：

- **单体版本** (`index.html`)：适合部署，所有代码在一个文件中
- **模块化版本** (`guitar-trainer-modular/`)：适合学习和维护，代码分模块组织

## ⚖️ 许可证

本项目采用 **CC BY-NC 4.0**（知识共享 署名-非商业性使用 4.0 国际许可协议）。

**这意味着：**
- ✅ 可以自由学习、研究代码
- ✅ 可以为个人、教育目的使用
- ✅ 可以修改和分享（需注明原作者）
- ❌ **不可用于任何商业用途**
- ❌ 不可在付费产品/服务中使用
- ❌ 不可用于盈利目的

**商业使用需获得授权**。如需商业许可，请通过 GitHub Issues 联系。

查看完整许可证：[LICENSE](./LICENSE) | [CC BY-NC 4.0 说明](https://creativecommons.org/licenses/by-nc/4.0/deed.zh)

## 🤝 贡献

## 🙏 致谢

## 🙏 致谢

- YIN 算法：[YIN Paper](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)
- 音频处理参考：Web Audio API 社区

---

**开发者**: 使用 ❤️ 和 🎸 制作
# guitar-trainer

---

© 2026 Sauce-amide. Licensed under CC BY-NC 4.0.
