/**
 * ui.js - UI辅助函数和屏幕管理
 * 
 * 功能:
 * - 屏幕切换
 * - 波形绘制
 * - 错误消息显示
 * - DOM 元素更新
 * - LocalStorage 设置管理
 * 
 * 依赖:
 * - constants.js (NOTES, DEBUG_MODE)
 */

import { NOTES, DEBUG_MODE } from './constants.js';

/**
 * 切换到指定屏幕
 * 
 * 应用中有 4 个屏幕:
 * - setupScreen: 设置屏幕 (选择音符、时间、设备)
 * - trainingScreen: 训练屏幕 (显示音符、检测音高)
 * - tunerScreen: 调音器屏幕 (调音模式)
 * - resultsScreen: 结果屏幕 (显示统计数据)
 * 
 * @param {string} screenId - 屏幕元素的 ID
 */
function showScreen(screenId) {
    // 移除所有屏幕的 active 类
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // 激活目标屏幕
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error(`Screen not found: ${screenId}`);
    }
}

/**
 * 显示错误消息
 * 
 * @param {string} message - 错误消息文本
 * @param {number} duration - 显示时长 (毫秒，默认 5000)
 */
function showError(message, duration = 5000) {
    const errorEl = document.getElementById('errorMessage');
    if (!errorEl) {
        console.error('Error message element not found');
        return;
    }
    
    errorEl.textContent = message;
    errorEl.classList.add('show');
    
    // 自动隐藏
    setTimeout(() => {
        errorEl.classList.remove('show');
    }, duration);
}

/**
 * 清除错误消息
 */
function clearError() {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.classList.remove('show');
    }
}

/**
 * 绘制音频波形到 Canvas
 * 
 * 绘制内容:
 * 1. 背景填充
 * 2. 中心线 (0 振幅线)
 * 3. 波形曲线
 * 4. 调试信息 (RMS 和峰值)
 * 
 * @param {Float32Array} buffer - 音频样本数据 (-1.0 到 1.0)
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 */
function drawWaveform(buffer, canvas, ctx) {
    if (!canvas || !ctx) {
        console.error('drawWaveform: canvas not initialized');
        return;
    }
    
    const width = canvas.width;
    const height = canvas.height;
    
    // 1. 清空画布 (灰色背景)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);
    
    // 2. 绘制中心线 (0 振幅线)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // 3. 绘制波形
    ctx.strokeStyle = '#2a5298';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = width / buffer.length;
    let x = 0;
    
    for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];  // 范围: -1.0 到 1.0
        const y = (v + 1) * height / 2;  // 转换为像素坐标
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.stroke();
    
    // 4. 绘制调试信息 (可选)
    if (DEBUG_MODE) {
        const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);
        const peak = Math.max(...Array.from(buffer).map(Math.abs));
        
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.fillText(
            `RMS: ${(rms * 100).toFixed(2)}% | Peak: ${(peak * 100).toFixed(2)}%`,
            10,
            20
        );
    }
}

/**
 * 更新频率显示文本
 * 
 * 根据检测结果显示不同的文本:
 * - 有效频率: 显示频率、音符、音量
 * - 音量太小: 提示音量不足
 * - 无输入: 显示等待状态
 * 
 * @param {number} frequency - 检测到的频率 (Hz)，-1 表示检测失败
 * @param {string} note - 音符名称
 * @param {number} volume - RMS 音量值
 */
function updateFrequencyDisplay(frequency, note, volume) {
    const display = document.getElementById('frequencyDisplay');
    if (!display) return;
    
    if (frequency > 0) {
        // 有效频率
        display.textContent = `频率: ${frequency.toFixed(2)} Hz | 音符: ${note} | 音量: ${(volume * 100).toFixed(1)}%`;
        display.style.color = '#2a5298';
    } else if (volume > 0.005) {
        // 音量太小
        display.textContent = `音量: ${(volume * 100).toFixed(1)}% | 音量太小或频率不明确`;
        display.style.color = '#999';
    } else {
        // 无输入
        display.textContent = '等待音频输入...';
        display.style.color = '#999';
    }
}

/**
 * 更新检测到的音符显示
 * 
 * 根据音符与目标的关系显示不同样式:
 * - 正确且音准好: 绿色 + 脉冲动画
 * - 音符正确但音准差: 橙色 + "接近"提示
 * - 音符错误: 灰色
 * 
 * @param {string} detectedNote - 检测到的音符
 * @param {string} targetNote - 目标音符
 * @param {number} centsOff - 音分偏差
 */
function updateDetectedNote(detectedNote, targetNote, centsOff) {
    const detectedEl = document.getElementById('detectedNote');
    if (!detectedEl) return;
    
    if (detectedNote === targetNote && Math.abs(centsOff) < 50) {
        // 正确且音准好
        const centsText = centsOff > 0 ? `+${centsOff.toFixed(0)}` : centsOff.toFixed(0);
        detectedEl.textContent = `♪ ${detectedNote} (${centsText} 音分)`;
        detectedEl.className = 'detected-note correct';
    } else if (Math.abs(centsOff) < 100) {
        // 接近目标音符
        detectedEl.textContent = `♪ ${detectedNote} (接近 ${targetNote})`;
        detectedEl.className = 'detected-note close';
    } else {
        // 其他音符
        detectedEl.textContent = `♪ ${detectedNote}`;
        detectedEl.className = 'detected-note';
    }
}

/**
 * 更新目标音符显示
 * 
 * @param {string} note - 音符名称
 */
function updateTargetNote(note) {
    const targetEl = document.getElementById('targetNote');
    if (targetEl) {
        targetEl.textContent = note;
    }
}

/**
 * 更新训练计时器显示
 * 
 * 格式: MM:SS
 * 
 * @param {number} seconds - 剩余秒数
 */
function updateTimerDisplay(seconds) {
    const timerEl = document.getElementById('timerDisplay');
    if (!timerEl) return;
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 更新训练进度显示
 * 
 * @param {number} correctCount - 正确识别数
 */
function updateProgressDisplay(correctCount) {
    const progressEl = document.getElementById('progressDisplay');
    if (progressEl) {
        progressEl.textContent = `已完成: ${correctCount} 个音符`;
    }
}

/**
 * 更新暂停按钮文本
 * 
 * @param {boolean} isPaused - 是否暂停
 */
function updatePauseButton(isPaused) {
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? '继续' : '暂停';
    }
}

/**
 * 添加正确识别的闪烁效果
 */
function flashCorrect() {
    const container = document.querySelector('.container');
    if (container) {
        container.classList.add('flash-correct');
        setTimeout(() => {
            container.classList.remove('flash-correct');
        }, 500);
    }
}

/**
 * 保存设置到 LocalStorage
 * 
 * 保存的内容:
 * - selectedNotes: 选中的音符数组
 * - duration: 训练时长 (分钟)
 * 
 * @param {Array<string>} selectedNotes - 选中的音符
 * @param {number} duration - 训练时长
 */
function saveSettings(selectedNotes, duration, noteTimeout) {
    const settings = {
        selectedNotes: selectedNotes,
        duration: duration,
        noteTimeout: noteTimeout
    };
    
    try {
        localStorage.setItem('guitarTrainerSettings', JSON.stringify(settings));
        if (DEBUG_MODE) console.log('Settings saved:', settings);
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

/**
 * 从 LocalStorage 加载设置
 * 
 * @returns {Object|null} { selectedNotes, duration, noteTimeout } 或 null
 */
function loadSettings() {
    const saved = localStorage.getItem('guitarTrainerSettings');
    if (!saved) return null;
    
    try {
        const settings = JSON.parse(saved);
        if (DEBUG_MODE) console.log('Settings loaded:', settings);
        return settings;
    } catch (e) {
        console.error('Failed to load settings:', e);
        return null;
    }
}

/**
 * 应用加载的设置到 UI
 * 
 * @param {Object} settings - { selectedNotes, duration }
 */
function applySettings(settings) {
    if (!settings) return;
    
    // 应用音符选择
    if (settings.selectedNotes && Array.isArray(settings.selectedNotes)) {
        NOTES.forEach(note => {
            const checkbox = document.querySelector(`input[value="${note}"]`);
            const noteBox = checkbox?.closest('.note-checkbox');
            
            if (settings.selectedNotes.includes(note)) {
                if (checkbox) checkbox.checked = true;
                if (noteBox) noteBox.classList.add('checked');
            } else {
                if (checkbox) checkbox.checked = false;
                if (noteBox) noteBox.classList.remove('checked');
            }
        });
    }
    
    // 应用训练时长
    if (settings.duration) {
        const durationInput = document.getElementById('durationInput');
        if (durationInput) {
            durationInput.value = settings.duration;
        }
    }
    
    // 应用音符超时时间
    if (settings.noteTimeout) {
        const noteTimeoutInput = document.getElementById('noteTimeoutInput');
        if (noteTimeoutInput) {
            noteTimeoutInput.value = settings.noteTimeout;
        }
    }
}

/**
 * 显示结果屏幕统计数据
 * 
 * @param {number} correctCount - 正确识别数
 * @param {number} totalAttempts - 总尝试数
 * @param {number} timeSpent - 用时 (秒)
 */
function showResults(correctCount, totalAttempts, timeSpent) {
    // 更新统计数据
    const correctEl = document.getElementById('finalCorrect');
    if (correctEl) correctEl.textContent = correctCount;
    
    const accuracyEl = document.getElementById('finalAccuracy');
    if (accuracyEl) {
        const accuracy = totalAttempts > 0 ? (correctCount / totalAttempts * 100).toFixed(1) : 0;
        accuracyEl.textContent = accuracy + '%';
    }
    
    const timeEl = document.getElementById('finalTime');
    if (timeEl) {
        const minutes = Math.floor(timeSpent / 60);
        const seconds = timeSpent % 60;
        timeEl.textContent = `${minutes}分${seconds}秒`;
    }
    
    // 切换到结果屏幕
    showScreen('resultsScreen');
}

// ==================== 导出 ====================
export {
    showScreen,
    showError,
    clearError,
    drawWaveform,
    updateFrequencyDisplay,
    updateDetectedNote,
    updateTargetNote,
    updateTimerDisplay,
    updateProgressDisplay,
    updatePauseButton,
    flashCorrect,
    saveSettings,
    loadSettings,
    applySettings,
    showResults
};
