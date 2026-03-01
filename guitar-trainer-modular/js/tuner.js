/**
 * tuner.js - 吉他调音器模式逻辑
 * 
 * 功能:
 * - 调音器音频处理循环
 * - 频率和音分的平滑处理 (指数移动平均)
 * - 调音指示器更新 (指针位置、颜色)
 * - 琴弦选择
 * 
 * 依赖:
 * - constants.js (GUITAR_STRINGS, TUNER_SMOOTHING_FACTOR, VOLUME_THRESHOLD)
 * - audio-processing.js (音频处理)
 * - pitch-detection.js (音高检测)
 * - ui.js (波形绘制)
 */

import { 
    GUITAR_STRINGS, 
    TUNER_SMOOTHING_FACTOR, 
    VOLUME_THRESHOLD, 
    NOTES,
    DEBUG_MODE 
} from './constants.js';

import { 
    getAudioBuffer, 
    calculateVolume, 
    getAudioContext, 
    setAnimationFrame 
} from './audio-processing.js';

import { detectPitch } from './pitch-detection.js';
import { drawWaveform } from './ui.js';

// ==================== 调音器状态 ====================
let isTunerMode = false;         // 是否处于调音器模式
let selectedString = null;       // 选中的琴弦索引
let smoothedFrequency = 0;       // 平滑后的频率
let smoothedCents = 0;           // 平滑后的音分偏差

// Canvas 引用
let tunerWaveformCanvas = null;
let tunerWaveformCtx = null;

/**
 * 初始化调音器模式
 */
function initTuner() {
    if (DEBUG_MODE) console.log('initTuner: Entering tuner mode');
    
    isTunerMode = true;
    
    // 初始化 canvas
    tunerWaveformCanvas = document.getElementById('tunerWaveform');
    tunerWaveformCtx = tunerWaveformCanvas ? tunerWaveformCanvas.getContext('2d') : null;
    
    // 重置平滑变量
    smoothedFrequency = 0;
    smoothedCents = 0;
    
    // 默认不选中任何琴弦
    selectedString = null;
}

/**
 * 开始调音器音频处理循环
 */
function startTunerLoop() {
    processTunerAudio();
    if (DEBUG_MODE) console.log('Tuner audio loop started');
}

/**
 * 调音器音频处理循环
 * 
 * 每帧执行:
 * 1. 获取音频数据
 * 2. 绘制波形
 * 3. 检测音高
 * 4. 平滑处理
 * 5. 更新调音指示器
 */
function processTunerAudio() {
    const audioContext = getAudioContext();
    if (!audioContext || audioContext.state === 'closed') {
        if (DEBUG_MODE) console.log('processTunerAudio: audioContext not ready');
        return;
    }
    
    // 请求下一帧
    const frameId = requestAnimationFrame(processTunerAudio);
    setAnimationFrame(frameId);
    
    // 如果不在调音器模式，停止
    if (!isTunerMode) return;
    
    try {
        // 获取音频数据
        const buffer = getAudioBuffer();
        const volume = calculateVolume(buffer);
        
        // 绘制波形
        if (tunerWaveformCanvas && tunerWaveformCtx) {
            drawWaveform(buffer, tunerWaveformCanvas, tunerWaveformCtx);
        }
        
        // 检测音高
        const frequency = detectPitch(buffer, audioContext.sampleRate, volume, VOLUME_THRESHOLD);
        
        if (frequency > 0) {
            updateTunerDisplay(frequency);
        } else {
            // 无有效音高
            clearTunerDisplay();
        }
        
    } catch (error) {
        console.error('processTunerAudio: Error', error);
    }
}

/**
 * 更新调音器显示
 * 
 * 工作流程:
 * 1. 计算音符和音分偏差
 * 2. 应用平滑处理 (指数移动平均)
 * 3. 更新频率显示
 * 4. 更新音符显示
 * 5. 更新音分显示和颜色
 * 6. 更新调音状态文字
 * 7. 移动指针
 * 
 * @param {number} frequency - 检测到的频率 (Hz)
 */
function updateTunerDisplay(frequency) {
    // 计算音符信息
    const noteInfo = frequencyToNoteDetailed(frequency);
    
    // 平滑处理 (指数移动平均)
    if (smoothedFrequency === 0) {
        // 首次检测，直接赋值
        smoothedFrequency = frequency;
        smoothedCents = noteInfo.cents;
    } else {
        // 应用平滑: new = old * (1 - α) + current * α
        // α = TUNER_SMOOTHING_FACTOR (0.3)
        // 较小的 α 产生更平滑的结果，但响应较慢
        smoothedFrequency = smoothedFrequency * (1 - TUNER_SMOOTHING_FACTOR) + frequency * TUNER_SMOOTHING_FACTOR;
        smoothedCents = smoothedCents * (1 - TUNER_SMOOTHING_FACTOR) + noteInfo.cents * TUNER_SMOOTHING_FACTOR;
    }
    
    // 更新频率显示
    const freqEl = document.getElementById('tunerFrequency');
    if (freqEl) {
        freqEl.textContent = smoothedFrequency.toFixed(2) + ' Hz';
    }
    
    // 更新音符显示
    const noteEl = document.getElementById('tunerNote');
    if (noteEl) {
        noteEl.textContent = noteInfo.note;
    }
    
    // 更新音分显示
    const centsEl = document.getElementById('tunerCents');
    if (centsEl) {
        const centsText = smoothedCents > 0 ? '+' + smoothedCents.toFixed(0) : smoothedCents.toFixed(0);
        centsEl.textContent = centsText;
        
        // 根据音准设置颜色
        if (Math.abs(smoothedCents) <= 5) {
            centsEl.className = 'cents-deviation in-tune';  // 绿色
        } else if (smoothedCents < 0) {
            centsEl.className = 'cents-deviation flat';      // 偏低 - 红色
        } else {
            centsEl.className = 'cents-deviation sharp';     // 偏高 - 橙色
        }
    }
    
    // 更新调音状态文字
    const statusEl = document.getElementById('tuningStatus');
    if (statusEl) {
        if (Math.abs(smoothedCents) <= 5) {
            statusEl.textContent = '✓ 已调准';
            statusEl.style.color = '#4CAF50';
        } else if (Math.abs(smoothedCents) <= 15) {
            statusEl.textContent = smoothedCents < 0 ? '↓ 偏低' : '↑ 偏高';
            statusEl.style.color = '#ff9800';
        } else {
            statusEl.textContent = smoothedCents < 0 ? '↓↓ 太低' : '↑↑ 太高';
            statusEl.style.color = '#f44336';
        }
    }
    
    // 移动指针
    updateNeedlePosition(smoothedCents);
}

/**
 * 清除调音器显示 (无有效音高时)
 */
function clearTunerDisplay() {
    const freqEl = document.getElementById('tunerFrequency');
    if (freqEl) freqEl.textContent = '-- Hz';
    
    const noteEl = document.getElementById('tunerNote');
    if (noteEl) noteEl.textContent = '--';
    
    const centsEl = document.getElementById('tunerCents');
    if (centsEl) {
        centsEl.textContent = '0';
        centsEl.className = 'cents-deviation';
    }
    
    const statusEl = document.getElementById('tuningStatus');
    if (statusEl) {
        statusEl.textContent = '等待音频输入...';
        statusEl.style.color = '#999';
    }
    
    // 指针回到中心
    updateNeedlePosition(0);
}

/**
 * 更新指针位置
 * 
 * 映射关系:
 * - -50 cents → 0% (最左边)
 * - 0 cents → 50% (中间)
 * - +50 cents → 100% (最右边)
 * 
 * @param {number} cents - 音分偏差
 */
function updateNeedlePosition(cents) {
    const needleEl = document.getElementById('tunerNeedle');
    if (!needleEl) return;
    
    // 计算位置百分比
    const needlePosition = 50 + (cents / 50) * 50;
    const clampedPosition = Math.max(0, Math.min(100, needlePosition));
    
    needleEl.style.left = clampedPosition + '%';
}

/**
 * 将频率转换为详细音符信息 (包含八度和音分)
 * 
 * 原理:
 * 1. 以 C0 (16.35 Hz) 为基准
 * 2. 计算与 C0 的半音差
 * 3. 四舍五入得到最近的音符
 * 4. 计算音分偏差
 * 
 * @param {number} frequency - 频率 (Hz)
 * @returns {Object} { note, noteName, octave, cents, frequency }
 */
function frequencyToNoteDetailed(frequency) {
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);  // C0 = 16.35 Hz
    
    // 计算与 C0 的半音差
    const halfStepsFromC0 = 12 * Math.log2(frequency / C0);
    const roundedHalfSteps = Math.round(halfStepsFromC0);
    
    // 计算音分偏差
    const cents = (halfStepsFromC0 - roundedHalfSteps) * 100;
    
    // 获取音符名称和八度
    const noteIndex = ((roundedHalfSteps % 12) + 12) % 12;  // 处理负数
    const octave = Math.floor(roundedHalfSteps / 12);
    const noteName = NOTES[noteIndex];
    
    return {
        note: noteName + octave,        // 完整音符 (如 "C4")
        noteName: noteName,             // 音符名称 (如 "C")
        octave: octave,                 // 八度
        cents: cents,                   // 音分偏差
        frequency: frequency            // 原始频率
    };
}

/**
 * 选择琴弦
 * 
 * @param {number} stringIndex - 琴弦索引 (0-5)
 */
function selectString(stringIndex) {
    // 更新按钮样式
    document.querySelectorAll('.string-btn').forEach((btn, idx) => {
        if (idx === stringIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    selectedString = stringIndex;
    const targetString = GUITAR_STRINGS[stringIndex];
    
    if (DEBUG_MODE) {
        console.log('Selected string:', targetString.name, targetString.frequency + ' Hz');
    }
}

/**
 * 退出调音器模式
 */
function exitTuner() {
    if (DEBUG_MODE) console.log('exitTuner: Leaving tuner mode');
    isTunerMode = false;
    smoothedFrequency = 0;
    smoothedCents = 0;
}

/**
 * 获取调音器状态 (用于外部访问)
 */
function getTunerState() {
    return {
        isTunerMode,
        selectedString,
        smoothedFrequency,
        smoothedCents
    };
}

// ==================== 导出 ====================
export {
    initTuner,
    startTunerLoop,
    exitTuner,
    selectString,
    getTunerState
};
