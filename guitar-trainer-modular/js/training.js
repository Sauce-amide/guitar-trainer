/**
 * training.js - 训练模式逻辑
 * 
 * 功能:
 * - 训练循环和状态管理
 * - 音符检测确认机制 (需要连续检测)
 * - 冷却机制 (防止重复检测)
 * - 计时器管理
 * - 进度跟踪
 * 
 * 依赖:
 * - constants.js (DETECTION_CONFIRMATION_TIME, DETECTION_COOLDOWN_TIME, REQUIRED_DETECTIONS)
 * - audio-processing.js (音频处理)
 * - pitch-detection.js (音高检测)
 * - ui.js (UI 更新)
 */

import { 
    DETECTION_CONFIRMATION_TIME, 
    DETECTION_COOLDOWN_TIME, 
    REQUIRED_DETECTIONS,
    VOLUME_THRESHOLD,
    DEBUG_MODE
} from './constants.js';

import { 
    getAudioBuffer, 
    calculateVolume, 
    getAudioContext, 
    setAnimationFrame 
} from './audio-processing.js';

import { 
    detectPitch, 
    frequencyToNote, 
    getCentsOff 
} from './pitch-detection.js';

import { 
    updateFrequencyDisplay, 
    updateDetectedNote, 
    updateTargetNote, 
    updateTimerDisplay, 
    updateProgressDisplay, 
    flashCorrect, 
    showScreen,
    showResults as showResultsScreen,
    drawWaveform
} from './ui.js';

// ==================== 训练状态 ====================
let selectedNotes = [];          // 用户选择的音符
let currentNote = '';            // 当前目标音符
let lastNote = '';               // 上一个音符 (避免连续重复)
let correctCount = 0;            // 正确识别数
let totalAttempts = 0;           // 总尝试数
let trainingDuration = 0;        // 训练总时长 (秒)
let remainingTime = 0;           // 剩余时间 (秒)
let startTime = 0;               // 开始时间戳
let endTime = 0;                 // 结束时间戳
let isPaused = false;            // 是否暂停
let timerInterval = null;        // 计时器 interval ID

let detectionHistory = [];       // 检测历史: [{note, timestamp}, ...]
let isInCooldown = false;        // 是否在冷却期
let lastDetectionTime = 0;       // 上次检测时间

// 音符超时机制
let noteTimeout = 5;             // 每个音符的超时时间 (秒)
let noteStartTime = 0;           // 当前音符开始时间
let noteTimeoutInterval = null;  // 超时计时器

// Canvas 引用
let waveformCanvas = null;
let waveformCtx = null;

/**
 * 初始化训练模式
 * 
 * @param {Array<string>} notes - 选中的音符列表
 * @param {number} duration - 训练时长 (分钟)
 * @param {number} timeout - 每个音符超时时间 (秒)
 */
function initTraining(notes, duration, timeout = 5) {
    selectedNotes = [...notes];
    trainingDuration = duration * 60;
    remainingTime = trainingDuration;
    correctCount = 0;
    totalAttempts = 0;
    startTime = Date.now();
    isPaused = false;
    noteTimeout = timeout;
    
    // Reset detection state
    detectionHistory = [];
    isInCooldown = false;
    lastDetectionTime = 0;
    noteStartTime = 0;
    
    // Initialize canvas
    waveformCanvas = document.getElementById('waveformCanvas');
    waveformCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;
    
    if (DEBUG_MODE) console.log('Training initialized:', { notes, duration, timeout });
}

/**
 * 开始训练循环
 * 
 * 启动:
 * 1. 显示第一个音符
 * 2. 启动计时器
 * 3. 开始音频处理循环
 */
function startTrainingLoop() {
    nextNote();
    startTimer();
    processTrainingAudio();
    
    if (DEBUG_MODE) console.log('Training loop started');
}

/**
 * 训练音频处理循环
 * 
 * 每帧执行:
 * 1. 获取音频数据
 * 2. 绘制波形
 * 3. 检测音高
 * 4. 更新显示
 * 5. 检查音符匹配
 */
function processTrainingAudio() {
    const audioContext = getAudioContext();
    if (!audioContext || audioContext.state === 'closed') {
        if (DEBUG_MODE) console.log('processTrainingAudio: audioContext not ready');
        return;
    }
    
    // 请求下一帧
    const frameId = requestAnimationFrame(processTrainingAudio);
    setAnimationFrame(frameId);
    
    // 如果暂停，跳过处理
    if (isPaused) return;
    
    try {
        // 获取音频数据
        const buffer = getAudioBuffer();
        const volume = calculateVolume(buffer);
        // 绘制波形
        if (waveformCanvas && waveformCtx) {
            drawWaveform(buffer, waveformCanvas, waveformCtx);
        }
        
        // 检测音高
        const frequency = detectPitch(buffer, audioContext.sampleRate, volume, VOLUME_THRESHOLD);
        
        if (frequency > 0) {
            // 有效频率
            const note = frequencyToNote(frequency);
            const centsOff = getCentsOff(frequency, currentNote);
            
            updateFrequencyDisplay(frequency, note, volume);
            updateDetectedNote(note, currentNote, centsOff);
            checkNote(note);
        } else {
            // 无有效频率
            updateFrequencyDisplay(-1, '', volume);
        }
        
    } catch (error) {
        console.error('processTrainingAudio: Error', error);
    }
}

/**
 * 检查检测到的音符是否匹配目标
 * 
 * 确认机制:
 * 1. 将检测结果加入历史记录
 * 2. 清除过期的历史记录 (超出确认时间窗口)
 * 3. 统计正确检测的数量
 * 4. 如果达到要求数量 → 确认成功 → 进入冷却 → 下一个音符
 * 
 * @param {string} detectedNote - 检测到的音符
 */
function checkNote(detectedNote) {
    const now = Date.now();
    
    // 如果在冷却期，忽略检测
    if (isInCooldown) {
        return;
    }
    
    // 加入检测历史
    detectionHistory.push({
        note: detectedNote,
        timestamp: now
    });
    
    // 清除过期的检测记录
    detectionHistory = detectionHistory.filter(d => 
        now - d.timestamp < DETECTION_CONFIRMATION_TIME
    );
    
    // 统计正确检测数
    const correctDetections = detectionHistory.filter(d => d.note === currentNote);
    
    // 判断是否达到确认要求
    if (correctDetections.length >= REQUIRED_DETECTIONS) {
        onNoteConfirmed();
    }
}

/**
 * 音符确认成功时的处理
 * 
 * 1. 更新计数器
 * 2. 显示成功反馈 (闪烁动画)
 * 3. 进入冷却期
 * 4. 延迟显示下一个音符
 */
function onNoteConfirmed() {
    correctCount++;
    totalAttempts++;
    
    // 停止超时计时器
    if (noteTimeoutInterval) {
        clearInterval(noteTimeoutInterval);
        noteTimeoutInterval = null;
    }
    
    // 进入冷却
    isInCooldown = true;
    lastDetectionTime = Date.now();
    detectionHistory = [];
    
    // 闪烁反馈
    flashCorrect();
    
    // 延迟显示下一个音符 (冷却期)
    setTimeout(() => {
        isInCooldown = false;
        nextNote();
    }, DETECTION_COOLDOWN_TIME);
    
    if (DEBUG_MODE) console.log('Note confirmed:', currentNote);
}

/**
 * 启动音符超时计时器
 * 
 * 每 100ms 更新一次进度条，超时后自动跳过
 */
function startNoteTimeout() {
    // 清除之前的计时器
    if (noteTimeoutInterval) {
        clearInterval(noteTimeoutInterval);
    }
    
    // 重置进度条
    updateNoteProgress(100);
    
    // 启动新的计时器
    noteTimeoutInterval = setInterval(() => {
        if (isPaused) return;
        
        const elapsed = (Date.now() - noteStartTime) / 1000; // 秒
        const progress = Math.max(0, ((noteTimeout - elapsed) / noteTimeout) * 100);
        
        updateNoteProgress(progress);
        
        // 超时处理
        if (elapsed >= noteTimeout) {
            clearInterval(noteTimeoutInterval);
            handleNoteTimeout();
        }
    }, 100);
}

/**
 * 更新音符超时进度条
 * 
 * @param {number} progress - 进度百分比 (0-100)
 */
function updateNoteProgress(progress) {
    const progressBar = document.getElementById('timeoutProgress');
    if (!progressBar) return;
    
    progressBar.style.width = `${progress}%`;
    
    // 根据剩余时间添加预警样式
    progressBar.classList.remove('warning', 'danger');
    if (progress < 30) {
        progressBar.classList.add('danger');
    } else if (progress < 60) {
        progressBar.classList.add('warning');
    }
}

/**
 * 处理音符超时
 * 
 * 超时后计为失败，跳转到下一个音符
 */
function handleNoteTimeout() {
    totalAttempts++;
    
    // 显示超时提示
    const detectedEl = document.getElementById('detectedNote');
    if (detectedEl) {
        detectedEl.textContent = '超时！';
        detectedEl.className = 'detected-note error';
    }
    
    // 短暂延迟后跳转下一个
    setTimeout(() => {
        nextNote();
    }, 500);
    
    if (DEBUG_MODE) console.log('Note timeout:', currentNote);
}

/**
 * 切换到下一个音符
 * 
 * 规则:
 * - 从选中的音符中随机选择
 * - 不与上一个音符相同 (如果有多个音符可选)
 */
function nextNote() {
    let newNote;
    
    // 随机选择，避免连续重复
    do {
        newNote = selectedNotes[Math.floor(Math.random() * selectedNotes.length)];
    } while (newNote === lastNote && selectedNotes.length > 1);
    
    lastNote = newNote;
    currentNote = newNote;
    
    // 重置检测状态
    detectionHistory = [];
    isInCooldown = false;
    
    // 重置超时计时器
    noteStartTime = Date.now();
    startNoteTimeout();
    
    // 更新显示
    updateTargetNote(newNote);
    updateProgressDisplay(correctCount);
    
    // 清除检测显示
    const detectedEl = document.getElementById('detectedNote');
    if (detectedEl) {
        detectedEl.textContent = '等待检测...';
        detectedEl.className = 'detected-note';
    }
    
    if (DEBUG_MODE) console.log('Next note:', newNote);
}

/**
 * 启动倒计时器
 */
function startTimer() {
    updateTimerDisplay(remainingTime);
    
    timerInterval = setInterval(() => {
        if (!isPaused) {
            remainingTime--;
            updateTimerDisplay(remainingTime);
            
            if (remainingTime <= 0) {
                endTraining();
            }
        }
    }, 1000);
}

/**
 * 暂停/继续训练
 */
function togglePause() {
    isPaused = !isPaused;
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? '继续' : '暂停';
    }
    
    if (DEBUG_MODE) console.log('Training paused:', isPaused);
}

/**
 * 停止训练 (用户主动结束)
 */
function stopTraining() {
    if (confirm('确定要结束训练吗？')) {
        endTraining();
    }
}

/**
 * 结束训练
 * 
 * 清理:
 * 1. 停止计时器
 * 2. 停止动画帧
 * 3. 关闭音频上下文
 * 4. 显示结果
 */
function endTraining() {
    // 停止计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 停止超时计时器
    if (noteTimeoutInterval) {
        clearInterval(noteTimeoutInterval);
        noteTimeoutInterval = null;
    }
    
    endTime = Date.now();
    
    // 音频清理在 audio-processing.js 的 stopAudio() 中处理
    
    // 显示结果
    const actualTime = Math.floor((endTime - startTime) / 1000);
    showResultsScreen(correctCount, totalAttempts, actualTime);
    
    if (DEBUG_MODE) console.log('Training ended:', { correctCount, totalAttempts, actualTime });
}

/**
 * 重新开始训练 (返回设置界面)
 */
function resetTraining() {
    showScreen('setupScreen');
}

/**
 * 获取当前训练状态 (用于外部访问)
 */
function getTrainingState() {
    return {
        selectedNotes,
        currentNote,
        correctCount,
        totalAttempts,
        remainingTime,
        isPaused,
        isInCooldown
    };
}

// ==================== 导出 ====================
export {
    initTraining,
    startTrainingLoop,
    processTrainingAudio,
    togglePause,
    stopTraining,
    resetTraining,
    getTrainingState
};
