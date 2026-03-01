/**
 * pitch-detection.js - 音高检测辅助函数
 * 
 * 功能:
 * - 频率到音符的转换
 * - 音分 (cents) 计算
 * - 八度音程处理
 * 
 * 依赖:
 * - constants.js (NOTES, NOTE_FREQUENCIES)
 * - yin-algorithm.js (音高检测核心算法)
 */

import { NOTES, NOTE_FREQUENCIES } from './constants.js';
import { autoCorrelate } from './yin-algorithm.js';

/**
 * 将频率转换为音符名称
 * 
 * 原理:
 * 1. 使用对数公式计算与 A4(440Hz) 的半音差
 * 2. 四舍五入到最近的半音
 * 3. 转换为音符名称 (C, C#, D, ...)
 * 
 * 公式: n = 12 * log2(f / 440)
 * - n: 与 A4 的半音差
 * - f: 输入频率
 * 
 * 例子:
 * - 440 Hz → A (基准)
 * - 220 Hz → A (低八度)
 * - 880 Hz → A (高八度)
 * - 261.63 Hz → C4
 * 
 * @param {number} frequency - 输入频率 (Hz)
 * @returns {string} 音符名称 (如 "C", "C#", "D")
 */
function frequencyToNote(frequency) {
    // 计算与 A4 的半音差
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    
    // 四舍五入到最近的半音
    const roundedNoteNum = Math.round(noteNum);
    
    // 转换为音符索引 (0=C, 1=C#, ..., 11=B)
    // +9 是因为 A 在数组中的索引是 9
    // +120 是为了避免负数取模
    const noteIndex = (roundedNoteNum + 9 + 120) % 12;
    
    return NOTES[noteIndex];
}

/**
 * 将频率转换为详细音符信息 (包含八度)
 * 
 * @param {number} frequency - 输入频率 (Hz)
 * @returns {Object} { note: "C", octave: 4, fullName: "C4" }
 */
function frequencyToNoteDetailed(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const roundedNoteNum = Math.round(noteNum);
    const noteIndex = (roundedNoteNum + 9 + 120) % 12;
    
    // 计算八度 (A4 = 440 Hz 是第 4 八度)
    const octave = Math.floor((roundedNoteNum + 9) / 12) + 4;
    
    const note = NOTES[noteIndex];
    return {
        note: note,
        octave: octave,
        fullName: note + octave
    };
}

/**
 * 计算频率与目标音符的音分偏差
 * 
 * 音分 (cents):
 * - 音乐中音高差的度量单位
 * - 1 半音 = 100 音分
 * - 1 八度 = 1200 音分
 * 
 * 公式: cents = 1200 * log2(f1 / f2)
 * 
 * 例子:
 * - 440 Hz vs 440 Hz → 0 cents (完全准确)
 * - 440 Hz vs 466.16 Hz → +100 cents (高一个半音)
 * - 440 Hz vs 415.30 Hz → -100 cents (低一个半音)
 * 
 * 调音标准:
 * - ±5 cents: 非常准确 (绿色)
 * - ±15 cents: 可接受 (橙色)
 * - >±15 cents: 需要调整 (红色)
 * 
 * @param {number} frequency - 当前频率 (Hz)
 * @param {string} targetNote - 目标音符名称 (如 "A")
 * @returns {number} 音分偏差 (正数=偏高，负数=偏低)
 */
function getCentsOff(frequency, targetNote) {
    const targetFreq = NOTE_FREQUENCIES[targetNote];
    let closestFreq = targetFreq;
    
    // 检查不同八度的频率，找到最接近的
    // 吉他音域: E2 (82 Hz) 到 E6 (1318 Hz)
    // 覆盖 4 个八度: 0.25x, 0.5x, 1x, 2x, 4x
    for (let octave = 0.25; octave <= 4; octave *= 2) {
        const freq = targetFreq * octave;
        if (Math.abs(frequency - freq) < Math.abs(frequency - closestFreq)) {
            closestFreq = freq;
        }
    }
    
    // 计算音分偏差
    return 1200 * Math.log2(frequency / closestFreq);
}

/**
 * 检测音频缓冲区的音高
 * 
 * 封装 YIN 算法，添加音量门限
 * 
 * @param {Float32Array} buffer - 音频样本数据
 * @param {number} sampleRate - 采样率 (Hz)
 * @param {number} volume - RMS 音量值
 * @param {number} threshold - 音量阈值 (默认 0.003)
 * @returns {number} 检测到的频率 (Hz)，如果检测失败返回 -1
 */
function detectPitch(buffer, sampleRate, volume, threshold = 0.003) {
    if (volume < threshold) {
        return -1; // 音量太小，不执行检测
    }
    
    return autoCorrelate(buffer, sampleRate);
}

/**
 * 判断音符是否接近目标音符
 * 
 * @param {string} detectedNote - 检测到的音符
 * @param {string} targetNote - 目标音符
 * @param {number} frequency - 检测到的频率
 * @param {number} centsThreshold - 音分阈值 (默认 50)
 * @returns {boolean} true = 接近目标
 */
function isNoteClose(detectedNote, targetNote, frequency, centsThreshold = 50) {
    if (detectedNote !== targetNote) {
        return false;
    }
    
    const centsOff = getCentsOff(frequency, targetNote);
    return Math.abs(centsOff) < centsThreshold;
}

/**
 * 判断音符是否在调音范围内
 * 
 * @param {number} centsOff - 音分偏差
 * @returns {string} 调音状态: 'in-tune', 'close', 'far'
 */
function getTuningStatus(centsOff) {
    const absCents = Math.abs(centsOff);
    
    if (absCents <= 5) {
        return 'in-tune';  // 非常准确
    } else if (absCents <= 15) {
        return 'close';    // 接近
    } else {
        return 'far';      // 需要调整
    }
}

/**
 * 获取音分偏差的显示文本
 * 
 * @param {number} centsOff - 音分偏差
 * @returns {string} 显示文本 (如 "+5", "-12")
 */
function getCentsDisplayText(centsOff) {
    const rounded = Math.round(centsOff);
    return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/**
 * 计算指针在调音指示器上的位置
 * 
 * 指示器范围: -50 到 +50 音分
 * 位置范围: 0% (左) 到 100% (右)
 * 
 * 例子:
 * - -50 cents → 0% (最左边)
 * - 0 cents → 50% (中间)
 * - +50 cents → 100% (最右边)
 * 
 * @param {number} centsOff - 音分偏差
 * @returns {number} 位置百分比 (0-100)
 */
function getNeedlePosition(centsOff) {
    // 限制范围到 -50 到 +50
    const clampedCents = Math.max(-50, Math.min(50, centsOff));
    
    // 转换为百分比: -50 → 0%, 0 → 50%, +50 → 100%
    return (clampedCents + 50) / 100 * 100;
}

/**
 * 将音符名称转换为频率 (基准八度)
 * 
 * @param {string} note - 音符名称 (如 "A")
 * @returns {number} 频率 (Hz)
 */
function noteToFrequency(note) {
    return NOTE_FREQUENCIES[note];
}

/**
 * 计算两个频率之间的半音差
 * 
 * @param {number} freq1 - 频率 1 (Hz)
 * @param {number} freq2 - 频率 2 (Hz)
 * @returns {number} 半音差
 */
function getSemitoneDistance(freq1, freq2) {
    return 12 * Math.log2(freq1 / freq2);
}

// ==================== 导出 ====================
export {
    frequencyToNote,
    frequencyToNoteDetailed,
    getCentsOff,
    detectPitch,
    isNoteClose,
    getTuningStatus,
    getCentsDisplayText,
    getNeedlePosition,
    noteToFrequency,
    getSemitoneDistance
};
