# 吉他指板音符训练器 (模块化版本)

一个用于训练吉他指板音符识别的 Web 应用，使用实时音频处理和 YIN 音高检测算法。

本项目的**教育目的版本** - 代码结构清晰，注释详尽，适合学习 Web Audio API 和音高检测算法。

## 功能特性

- ✅ **音符训练模式**: 随机显示音符，实时检测你弹奏的音高
- ✅ **吉他调音器**: Guitar Tuna 风格的调音器，带平滑指针和音分显示
- ✅ **YIN 算法**: 业界标准的音高检测算法，精确识别基频
- ✅ **实时波形显示**: 可视化音频输入
- ✅ **检测确认机制**: 需要连续检测 5 次以上才确认，减少误判
- ✅ **本地设置保存**: LocalStorage 记住你的选择

## 快速开始

### 运行应用

1. 使用 Web 服务器打开 `index.html`（不支持 `file://` 协议）
   
   ```bash
   # 使用 Python
   python3 -m http.server 8000
   
   # 或使用 Node.js
   npx http-server
   ```

2. 在浏览器中访问 `http://localhost:8000`

3. **推荐使用 Safari 浏览器**（作者测试环境）

### 使用说明

1. **设置**: 选择要训练的音符和训练时间
2. **调音**: 点击"调音器"确保吉他音准
3. **训练**: 弹奏显示的音符，系统自动识别
4. **结果**: 查看统计数据

## 项目结构

```
guitar-trainer-modular/
├── index.html                 # HTML 结构
├── css/
│   ├── main.css              # 基础样式、容器、按钮
│   ├── screens.css           # 设置/训练/结果屏幕样式
│   └── tuner.css             # 调音器专用样式
└── js/
    ├── constants.js          # 配置常量、音符定义
    ├── yin-algorithm.js      # ⭐ YIN 音高检测算法（核心）
    ├── audio-processing.js   # Web Audio API 封装
    ├── pitch-detection.js    # 音高转换工具函数
    ├── tuner.js              # 调音器模式逻辑
    ├── training.js           # 训练模式逻辑
    ├── ui.js                 # UI 更新和屏幕管理
    └── main.js               # 应用入口和事件绑定
```

## 学习路径

### 1. 从核心算法开始

**首先阅读**: `js/yin-algorithm.js`

这个文件包含完整的 YIN 算法实现，带详细中文注释：

```javascript
// 第一步: 差分函数 d(τ) = Σ(x[i] - x[i+τ])²
// 第二步: 累积归一化 d'(τ) = d(τ) / [(1/τ)Σd(j)]
// 第三步: 绝对阈值搜索 (threshold = 0.15)
// 第四步: 抛物线插值 (亚采样精度)
```

**为什么 YIN 算法优于自相关？**
- 谐波抑制：归一化步骤使得基频谷值最深
- 工业标准：GuitarTuna、Yousician 等都在用
- 吉他友好：能正确识别基频而不是谐波

### 2. 理解音频处理流程

**数据流向**:

```
麦克风 → Web Audio API → AnalyserNode → Float32Array
  ↓
YIN 算法 → 频率 (Hz)
  ↓
频率转音符 → 音符名称 (C, C#, D, ...)
  ↓
音分计算 → 偏差 (-50 ~ +50 cents)
  ↓
UI 更新 → 用户看到结果
```

**关键文件顺序**:
1. `audio-processing.js` - 获取音频数据
2. `yin-algorithm.js` - 检测音高
3. `pitch-detection.js` - 转换为音乐概念
4. `ui.js` - 显示结果

### 3. 调音器的平滑处理

**为什么需要平滑？**
- 音高检测有噪声 → 指针会抖动
- 人类期望平滑的视觉反馈

**如何实现？**
```javascript
// 指数移动平均 (Exponential Moving Average)
smoothedValue = oldValue * (1 - α) + newValue * α
// α = 0.3 (TUNER_SMOOTHING_FACTOR)
```

查看 `js/tuner.js` 中的 `updateTunerDisplay()` 函数。

### 4. 训练模式的检测确认

**问题**: 如何避免误检和重复检测？

**解决方案**:
1. **确认窗口** (500ms): 需要连续检测 5 次相同音符
2. **冷却期** (800ms): 确认后进入冷却，防止立即重复

查看 `js/training.js` 中的 `checkNote()` 函数。

## 关键配置

在 `js/constants.js` 中可以调整：

```javascript
// 音高检测
FFT_SIZE = 2048                    // FFT 大小（频率分辨率）
VOLUME_THRESHOLD = 0.003           // 音量阈值
YIN_THRESHOLD = 0.15               // YIN 阈值

// 训练模式
DETECTION_CONFIRMATION_TIME = 500  // 确认窗口 (ms)
REQUIRED_DETECTIONS = 5            // 需要检测次数
DETECTION_COOLDOWN_TIME = 800      // 冷却时间 (ms)

// 调音器
TUNER_SMOOTHING_FACTOR = 0.3       // 平滑系数 (0.1-0.5)
```

## 常见问题

### 为什么检测不准确？

1. **音量太小**: 增大音量或降低 `VOLUME_THRESHOLD`
2. **谐波干扰**: YIN 算法已经处理了，如果还有问题，调整 `YIN_THRESHOLD`
3. **吉他未调音**: 先使用调音器功能
4. **环境噪音**: 在安静环境中使用

### 为什么调音器指针抖动？

增大 `TUNER_SMOOTHING_FACTOR` (0.1-0.5 之间)。
- 更小 = 更平滑但响应慢
- 更大 = 响应快但更抖

### 训练模式误检太多？

增加 `REQUIRED_DETECTIONS` 或延长 `DETECTION_CONFIRMATION_TIME`。

## 技术细节

### YIN 算法原理

基于论文: *"YIN, a fundamental frequency estimator for speech and music"* (de Cheveigné & Kawahara, 2002)

**核心思想**: 
- 传统自相关找峰值 → 谐波容易干扰
- YIN 找谷值并归一化 → 基频谷值最深

**数学公式**:

```
差分函数:    d(τ) = Σ(x[i] - x[i+τ])²
累积归一化:   d'(τ) = d(τ) / [(1/τ)Σd(j)]
```

详见 `js/yin-algorithm.js` 中的注释。

### 音分 (Cents)

1 半音 = 100 音分
1 八度 = 1200 音分

```javascript
cents = 1200 * log2(freq1 / freq2)
```

- **±5 cents**: 非常准确（绿色）
- **±15 cents**: 可接受（橙色）
- **>±15 cents**: 需要调整（红色）

### 平滑算法

**指数移动平均 (EMA)**:

```javascript
y[n] = α * x[n] + (1 - α) * y[n-1]
```

- α 小 → 平滑但延迟高
- α 大 → 响应快但抖动多

## 浏览器兼容性

- ✅ Safari (推荐，作者测试环境)
- ✅ Chrome
- ✅ Firefox
- ✅ Edge

需要支持:
- Web Audio API
- `getUserMedia()`
- ES6 Modules

## 生产版本

单文件生产版本在 `../guitar-trainer.html`。

功能完全相同，但所有代码合并到一个文件，更易部署。

## 参考资源

- [YIN 算法论文](https://asa.scitation.org/doi/10.1121/1.1458024)
- [Web Audio API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [音高检测原理](https://en.wikipedia.org/wiki/Pitch_detection_algorithm)

## 许可证

MIT License

---

**学习建议**: 从 `yin-algorithm.js` 开始，然后按数据流向阅读其他文件。所有关键函数都有详细注释。
