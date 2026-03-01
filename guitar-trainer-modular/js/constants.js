/**
 * ===============================================
 * 常量定义
 * ===============================================
 * 
 * 本文件定义所有全局常量，方便统一管理和修改
 */

// ==================== 音符定义 ====================

/**
 * 12个半音音符（西方音乐体系）
 * 从C到B，包含所有升号(#)
 */
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 标准音符频率 (Hz)
 * 基于 A4 = 440 Hz 的标准调音
 * 
 * 注意: 这里只列出了一个八度的频率
 * 实际使用中需要考虑不同八度（乘以2的n次方）
 */
const NOTE_FREQUENCIES = {
    'C':  261.63,  // C4 (中央C)
    'C#': 277.18,
    'D':  293.66,
    'D#': 311.13,
    'E':  329.63,
    'F':  349.23,
    'F#': 369.99,
    'G':  392.00,
    'G#': 415.30,
    'A':  440.00,  // A4 (国际标准音)
    'A#': 466.16,
    'B':  493.88
};


// ==================== 吉他调弦定义 ====================

/**
 * 吉他标准调弦 (EADGBE)
 * 从最低音的第6弦到最高音的第1弦
 * 
 * 用于调音器功能
 */
const GUITAR_STRINGS = [
    { name: 'E2', frequency: 82.41,  note: 'E', octave: 2 },  // 第6弦
    { name: 'A2', frequency: 110.00, note: 'A', octave: 2 },  // 第5弦
    { name: 'D3', frequency: 146.83, note: 'D', octave: 3 },  // 第4弦
    { name: 'G3', frequency: 196.00, note: 'G', octave: 3 },  // 第3弦
    { name: 'B3', frequency: 246.94, note: 'B', octave: 3 },  // 第2弦
    { name: 'E4', frequency: 329.63, note: 'E', octave: 4 }   // 第1弦
];


// ==================== 音频处理参数 ====================

/**
 * FFT大小 - 影响频率分辨率
 * 
 * 2048是常用值，平衡了:
 * - 频率分辨率 (分辨率 = 采样率 / FFT大小)
 * - 时间分辨率 (窗口越大，时间定位越差)
 * - 计算性能
 * 
 * 对于48000 Hz采样率:
 * - 频率分辨率 = 48000 / 2048 ≈ 23.4 Hz
 * - 时间窗口 = 2048 / 48000 ≈ 42.7 ms
 */
const FFT_SIZE = 2048;

/**
 * 分析器平滑常数 (0-1)
 * 
 * 控制Web Audio API分析器的时间平滑
 * - 0: 无平滑，实时响应
 * - 1: 完全平滑，变化很慢
 * - 0.8: 推荐值，平衡响应速度和稳定性
 */
const SMOOTHING_CONSTANT = 0.8;

/**
 * 音量阈值
 * 低于此值的信号被认为是噪音，不进行音高检测
 * 
 * 0.0005 是降低后的阈值，可以检测到未插电电吉他的微弱声音
 */
const VOLUME_THRESHOLD = 0.0005;


// ==================== 检测参数 ====================

/**
 * 持续检测确认时间 (毫秒)
 * 
 * 在此时间窗口内，需要连续检测到同一音符才确认成功
 * 防止短暂的误识别或噪音干扰
 */
const DETECTION_CONFIRMATION_TIME = 500;

/**
 * 检测冷却时间 (毫秒)
 * 
 * 成功识别一个音符后，进入此时长的冷却期
 * 防止同一个音符被重复计数
 */
const DETECTION_COOLDOWN_TIME = 800;

/**
 * 需要的连续检测次数
 * 
 * 在确认时间窗口内，至少需要这么多次检测到相同音符
 * 才认为是真实的弹奏
 */
const REQUIRED_DETECTIONS = 5;
/**
 * 默认每个音符超时时间 (秒)
 * 
 * 如果在这个时间内没有弹对，将自动跳过到下一个音符
 */
const NOTE_TIMEOUT_DEFAULT = 5;

/**
 * 音分容差 (cents)
 * 
 * 允许的音高偏差范围
 * - 100 cents = 1个半音
 * - 50 cents = 半个半音 (推荐值)
 * - 音分差 < 50 认为是"接近"目标音
 */
const CENTS_TOLERANCE = 50;


// ==================== 调音器参数 ====================

/**
 * 调音器指示针平滑系数 (0-1)
 * 
 * 控制指示针移动的平滑度（阻尼效果）
 * - 0.1: 很平滑，但反应慢
 * - 0.5: 反应快，但可能抖动
 * - 0.3: 推荐值，平衡平滑度和响应速度
 * 
 * 计算公式: 新值 = 旧值 × (1 - α) + 检测值 × α
 */
const TUNER_SMOOTHING_FACTOR = 0.3;

/**
 * 调音精度阈值 (cents)
 * 
 * 定义"已调准"的精度范围
 * - ±5 cents: 已调准（绿色）
 * - ±15 cents: 接近（橙色）
 * - >15 cents: 偏离（红色）
 */
const TUNING_THRESHOLD_IN_TUNE = 5;
const TUNING_THRESHOLD_CLOSE = 15;


// ==================== UI配置 ====================

/**
 * 波形画布配置
 */
const WAVEFORM_CONFIG = {
    training: {
        width: 800,
        height: 150,
        color: '#2a5298',
        backgroundColor: '#f5f5f5'
    },
    tuner: {
        width: 800,
        height: 100,
        color: '#2a5298',
        backgroundColor: '#f5f5f5'
    }
};


// ==================== 调试选项 ====================

/**
 * 是否显示调试信息
 * 开发时设为 true，生产环境设为 false
 */
const DEBUG_MODE = false;

/**
 * 调试日志函数
 * 只在 DEBUG_MODE = true 时输出
 */
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[Guitar Trainer]', ...args);
    }
}

// ==================== 导出所有常量 ====================

export {
    NOTES,
    NOTE_FREQUENCIES,
    GUITAR_STRINGS,
    FFT_SIZE,
    SMOOTHING_CONSTANT,
    VOLUME_THRESHOLD,
    DETECTION_CONFIRMATION_TIME,
    DETECTION_COOLDOWN_TIME,
    REQUIRED_DETECTIONS,
    NOTE_TIMEOUT_DEFAULT,
    CENTS_TOLERANCE,
    TUNER_SMOOTHING_FACTOR,
    TUNING_THRESHOLD_IN_TUNE,
    TUNING_THRESHOLD_CLOSE,
    WAVEFORM_CONFIG,
    DEBUG_MODE,
    debugLog
};
