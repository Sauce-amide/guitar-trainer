/**
 * 🎸 吉他指板音符训练器 | Guitar Fretboard Note Trainer
 * 
 * Copyright (c) 2026 Sauce-amide
 * Licensed under CC BY-NC 4.0 (Attribution-NonCommercial)
 * https://github.com/Sauce-amide/guitar-trainer
 * 
 * ====================================================================
 * main.js - 应用入口和事件监听器
 * 
 * 功能:
 * - 应用初始化
 * - 全局事件监听器绑定
 * - 模式切换 (设置 ↔ 训练 ↔ 调音器 ↔ 结果)
 * - 音符选择管理
 * 
 * 这是所有模块的协调中心
 */

import { NOTES, DEBUG_MODE } from './constants.js';
import { initAudio, loadAudioDevices, stopAudio } from './audio-processing.js';
import { initTraining, startTrainingLoop, togglePause, stopTraining, resetTraining } from './training.js';
import { initTuner, startTunerLoop, exitTuner, selectString } from './tuner.js';
import { 
    showScreen, 
    showError, 
    loadSettings, 
    applySettings, 
    saveSettings 
} from './ui.js';

// ==================== 应用初始化 ====================
/**
 * 应用启动入口
 * 
 * 执行顺序:
 * 1. 加载保存的设置
 * 2. 创建音符复选框
 * 3. 加载音频设备列表
 * 4. 绑定事件监听器
 */
async function init() {
    if (DEBUG_MODE) console.log('Application initializing...');
    
    try {
        // 加载设置
        const settings = loadSettings();
        if (settings) {
            applySettings(settings);
        }
        
        // 创建音符复选框
        createNoteCheckboxes();
        
        // 加载音频设备
        await loadAudioDevices();
        
        // 绑定事件监听器
        bindEventListeners();
        
        if (DEBUG_MODE) console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Initialization failed:', error);
        showError('初始化失败: ' + error.message);
    }
}

/**
 * 创建音符复选框
 * 
 * 为每个音符创建可点击的复选框按钮
 */
function createNoteCheckboxes() {
    const grid = document.getElementById('notesGrid');
    if (!grid) {
        console.error('Notes grid not found');
        return;
    }
    
    // 获取当前选中的音符
    const settings = loadSettings();
    const selectedNotes = settings?.selectedNotes || [...NOTES];
    
    NOTES.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note-checkbox';
        const isChecked = selectedNotes.includes(note);
        
        if (isChecked) {
            div.classList.add('checked');
        }
        
        div.innerHTML = `
            <input type="checkbox" id="note-${note}" value="${note}" ${isChecked ? 'checked' : ''}>
            <label for="note-${note}">${note}</label>
        `;
        
        // 整个 div 可点击
        div.onclick = function() {
            toggleNote(note);
        };
        
        grid.appendChild(div);
    });
}

/**
 * 绑定所有事件监听器
 */
function bindEventListeners() {
    // 设置屏幕
    const startBtn = document.getElementById('startTrainingBtn');
    if (startBtn) {
        startBtn.addEventListener('click', onStartTraining);
    }
    
    const tunerBtn = document.getElementById('showTunerBtn');
    if (tunerBtn) {
        tunerBtn.addEventListener('click', onShowTuner);
    }
    
    const selectAllBtn = document.querySelector('.quick-actions button:nth-child(1)');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllNotes);
    }
    
    const deselectAllBtn = document.querySelector('.quick-actions button:nth-child(2)');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllNotes);
    }
    
    // 训练屏幕
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
    }
    
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopTraining);
    }
    
    // 调音器屏幕
    const stringButtons = document.querySelectorAll('.string-btn');
    stringButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => selectString(index));
    });
    
    const backToSetupBtn = document.getElementById('backToSetupBtn');
    if (backToSetupBtn) {
        backToSetupBtn.addEventListener('click', onBackToSetup);
    }
    
    const startFromTunerBtn = document.getElementById('startFromTunerBtn');
    if (startFromTunerBtn) {
        startFromTunerBtn.addEventListener('click', onStartFromTuner);
    }
    
    // 结果屏幕
    const trainAgainBtn = document.getElementById('trainAgainBtn');
    if (trainAgainBtn) {
        trainAgainBtn.addEventListener('click', resetTraining);
    }
    
    const durationInput = document.getElementById('durationInput');
    if (durationInput) {
        durationInput.addEventListener('change', autoSaveSettings);
    }
    
    const noteTimeoutInput = document.getElementById('noteTimeoutInput');
    if (noteTimeoutInput) {
        noteTimeoutInput.addEventListener('change', autoSaveSettings);
    }
}

// ==================== 音符选择 ====================
/**
 * 切换音符选中状态
 */
function toggleNote(note) {
    const checkbox = document.getElementById(`note-${note}`);
    const div = checkbox?.parentElement;
    
    if (!checkbox || !div) return;
    
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        div.classList.add('checked');
    } else {
        div.classList.remove('checked');
    }
    
    updateSelectedNotes();
    autoSaveSettings();
}

/**
 * 全选音符
 */
function selectAllNotes() {
    NOTES.forEach(note => {
        const checkbox = document.getElementById(`note-${note}`);
        const div = checkbox?.parentElement;
        
        if (checkbox) checkbox.checked = true;
        if (div) div.classList.add('checked');
    });
    
    updateSelectedNotes();
    autoSaveSettings();
}

/**
 * 全不选音符
 */
function deselectAllNotes() {
    NOTES.forEach(note => {
        const checkbox = document.getElementById(`note-${note}`);
        const div = checkbox?.parentElement;
        
        if (checkbox) checkbox.checked = false;
        if (div) div.classList.remove('checked');
    });
    
    updateSelectedNotes();
    autoSaveSettings();
}

/**
 * 获取当前选中的音符
 */
function getSelectedNotes() {
    return NOTES.filter(note => {
        const checkbox = document.getElementById(`note-${note}`);
        return checkbox?.checked;
    });
}

/**
 * 更新选中音符 (供内部使用)
 */
function updateSelectedNotes() {
    // 触发自动保存
    autoSaveSettings();
}

/**
 * 自动保存设置
 */
function autoSaveSettings() {
    const selectedNotes = getSelectedNotes();
    const durationInput = document.getElementById('durationInput');
    const duration = durationInput ? parseInt(durationInput.value) : 5;
    const noteTimeoutInput = document.getElementById('noteTimeoutInput');
    const noteTimeout = noteTimeoutInput ? parseInt(noteTimeoutInput.value) : 5;
    
    saveSettings(selectedNotes, duration, noteTimeout);
}

// ==================== 模式切换 ====================
/**
 * 开始训练
 */
async function onStartTraining() {
    const selectedNotes = getSelectedNotes();
    const durationInput = document.getElementById('durationInput');
    const duration = durationInput ? parseInt(durationInput.value) : 5;
    const noteTimeoutInput = document.getElementById('noteTimeoutInput');
    const noteTimeout = noteTimeoutInput ? parseInt(noteTimeoutInput.value) : 5;
    
    // 验证
    if (selectedNotes.length === 0) {
        showError('请至少选择一个音符！');
        return;
    }
    
    if (duration < 1 || duration > 60) {
        showError('训练时长必须在1-60分钟之间！');
        return;
    }
    
    if (noteTimeout < 1 || noteTimeout > 30) {
        showError('超时时间必须在1-30秒之间！');
        return;
    }
    
    try {
        // 初始化音频
        await initAudio();
        
        // 初始化训练
        initTraining(selectedNotes, duration, noteTimeout);
        
        // 切换到训练屏幕
        showScreen('trainingScreen');
        
        // 开始训练循环
        startTrainingLoop();
        
        if (DEBUG_MODE) console.log('Training started');
        
    } catch (error) {
        showError('无法访问麦克风：' + error.message);
        console.error('Failed to start training:', error);
    }
}

/**
 * 显示调音器
 */
async function onShowTuner() {
    try {
        // 初始化音频
        await initAudio();
        
        // 初始化调音器
        initTuner();
        
        // 切换到调音器屏幕
        showScreen('tunerScreen');
        
        // 开始调音器循环
        startTunerLoop();
        
        if (DEBUG_MODE) console.log('Tuner started');
        
    } catch (error) {
        showError('无法访问麦克风：' + error.message);
        console.error('Failed to start tuner:', error);
    }
}

/**
 * 从调音器返回设置
 */
function onBackToSetup() {
    exitTuner();
    stopAudio();
    showScreen('setupScreen');
    
    if (DEBUG_MODE) console.log('Returned to setup from tuner');
}

/**
 * 从调音器开始训练
 */
async function onStartFromTuner() {
    exitTuner();
    stopAudio();
    
    // 直接调用开始训练
    await onStartTraining();
}

// ==================== 应用启动 ====================
// 等待 DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 导出供调试使用
if (DEBUG_MODE) {
    window.guitarTrainerDebug = {
        init,
        getSelectedNotes,
        showScreen,
        stopAudio
    };
}
