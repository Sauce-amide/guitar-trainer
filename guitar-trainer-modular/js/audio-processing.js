/**
 * audio-processing.js - Web Audio API 音频处理模块
 * 
 * 功能:
 * - 初始化 AudioContext 和 AnalyserNode
 * - 管理麦克风输入流
 * - 加载和选择音频设备
 * - 实时音频数据采集
 * - 音量计算
 * 
 * 依赖:
 * - constants.js (FFT_SIZE, SMOOTHING_CONSTANT, VOLUME_THRESHOLD)
 */

import { FFT_SIZE, SMOOTHING_CONSTANT, VOLUME_THRESHOLD, DEBUG_MODE } from './constants.js';

// ==================== 模块状态 ====================
let audioContext = null;      // Web Audio API 上下文
let analyser = null;           // 分析器节点 - 用于获取音频数据
let microphone = null;         // 麦克风输入源
let animationFrame = null;     // requestAnimationFrame ID

/**
 * 初始化音频系统
 * 
 * 工作流程:
 * 1. 创建 AudioContext
 * 2. 创建 AnalyserNode 并配置 FFT 参数
 * 3. 请求麦克风权限
 * 4. 将麦克风连接到分析器
 * 
 * @returns {Promise<void>}
 * @throws {Error} 如果无法访问麦克风或浏览器不支持 Web Audio API
 */
async function initAudio() {
    if (DEBUG_MODE) console.log('initAudio: Starting...');
    
    try {
        // 创建 AudioContext (支持 webkit 前缀)
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (DEBUG_MODE) console.log('initAudio: AudioContext created', audioContext.state);
        
        // 创建分析器节点
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;                           // FFT 大小 - 影响频率分辨率
        analyser.smoothingTimeConstant = SMOOTHING_CONSTANT;   // 平滑常数 - 减少噪声
        if (DEBUG_MODE) console.log('initAudio: Analyser created');

        // 获取用户选择的设备ID
        const selectedDeviceId = document.getElementById('audioDeviceSelect').value;
        
        // 构建音频约束
        const constraints = { 
            audio: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                echoCancellation: false,   // 关闭回声消除 - 保留原始音频
                noiseSuppression: false,   // 关闭噪声抑制 - 保留吉他细节
                autoGainControl: false     // 关闭自动增益 - 保留动态范围
            }
        };
        
        // 请求麦克风权限并获取音频流
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (DEBUG_MODE) console.log('initAudio: Microphone stream obtained', stream.getAudioTracks());
        
        // 创建媒体流源节点
        microphone = audioContext.createMediaStreamSource(stream);
        
        // 连接音频图: 麦克风 → 分析器
        microphone.connect(analyser);
        if (DEBUG_MODE) console.log('initAudio: Microphone connected to analyser');
        
    } catch (error) {
        console.error('initAudio: Error', error);
        throw error;
    }
}

/**
 * 加载可用的音频输入设备列表
 * 
 * 注意:
 * - 必须先请求麦克风权限，才能获取设备名称
 * - 如果没有权限，只能看到 'audioinput' 类型但没有标签
 * - BlackHole 等虚拟设备可能显示但不适合使用
 * 
 * @returns {Promise<void>}
 */
async function loadAudioDevices() {
    const select = document.getElementById('audioDeviceSelect');
    
    try {
        if (DEBUG_MODE) console.log('Requesting microphone permission...');
        
        // 第一步: 请求临时流以获取权限
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false
        });
        if (DEBUG_MODE) console.log('Permission granted, stream:', tempStream);
        
        // 停止临时流 (只是为了获取权限)
        tempStream.getTracks().forEach(track => {
            if (DEBUG_MODE) console.log('Stopping track:', track.label);
            track.stop();
        });
        
        // 等待权限完全生效
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 第二步: 枚举设备 (现在可以看到名称了)
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (DEBUG_MODE) console.log('All devices:', devices);
        
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        if (DEBUG_MODE) console.log('Audio input devices:', audioInputs);
        
        // 清空现有选项
        select.innerHTML = '';
        
        if (audioInputs.length === 0) {
            select.innerHTML = '<option value="">未找到音频输入设备</option>';
            throw new Error('未找到音频输入设备');
        }
        
        // 过滤掉空deviceId的设备
        const validDevices = audioInputs.filter(d => d.deviceId);
        
        if (validDevices.length === 0) {
            select.innerHTML = '<option value="">无可用设备（权限可能被拒绝）</option>';
            throw new Error('无法访问音频设备，请检查浏览器权限设置');
        }
        
        // 填充设备列表
        validDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            const label = device.label || `设备 ${index + 1}`;
            option.textContent = label;
            
            // 标记默认设备
            if (device.deviceId === 'default' || index === 0) {
                option.textContent = '✅ ' + label + (device.deviceId === 'default' ? ' (系统默认)' : ' (推荐)');
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        if (DEBUG_MODE) console.log('Device list populated with', validDevices.length, 'devices');
        
    } catch (error) {
        console.error('Failed to load audio devices:', error);
        select.innerHTML = '<option value="">无法加载设备 - ' + error.message + '</option>';
        throw error;
    }
}

/**
 * 获取当前音频数据缓冲区
 * 
 * 从分析器获取时域数据 (waveform)
 * Float32Array 范围: -1.0 到 1.0
 * 
 * @returns {Float32Array} 音频样本数据
 */
function getAudioBuffer() {
    if (!analyser) {
        throw new Error('Analyser not initialized');
    }
    
    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(buffer);
    
    return buffer;
}

/**
 * 计算音频缓冲区的 RMS 音量
 * 
 * RMS (Root Mean Square) = 均方根
 * 公式: √(Σ(x²) / n)
 * 
 * 这是测量音频响度的标准方法
 * 
 * @param {Float32Array} buffer - 音频样本数据
 * @returns {number} RMS 音量值 (0.0 到 1.0)
 */
function calculateVolume(buffer) {
    const sum = buffer.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sum / buffer.length);
    return rms;
}

/**
 * 计算音频缓冲区的峰值
 * 
 * 峰值 = 绝对值的最大值
 * 用于显示波形的动态范围
 * 
 * @param {Float32Array} buffer - 音频样本数据
 * @returns {number} 峰值 (0.0 到 1.0)
 */
function calculatePeak(buffer) {
    return Math.max(...Array.from(buffer).map(Math.abs));
}

/**
 * 检查音量是否超过阈值
 * 
 * 用于决定是否执行音高检测
 * 太小的音量会导致误检
 * 
 * @param {number} volume - RMS 音量值
 * @returns {boolean} true = 音量足够
 */
function isVolumeAboveThreshold(volume) {
    return volume > VOLUME_THRESHOLD;
}

/**
 * 停止音频处理
 * 
 * 清理资源:
 * - 断开麦克风连接
 * - 关闭 AudioContext
 * - 取消动画帧
 */
function stopAudio() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    analyser = null;
}

/**
 * 获取音频上下文 (用于获取采样率)
 * 
 * @returns {AudioContext|null}
 */
function getAudioContext() {
    return audioContext;
}

/**
 * 获取分析器节点 (用于外部直接访问)
 * 
 * @returns {AnalyserNode|null}
 */
function getAnalyser() {
    return analyser;
}

/**
 * 设置动画帧 ID (用于外部管理)
 * 
 * @param {number} frameId - requestAnimationFrame 返回的 ID
 */
function setAnimationFrame(frameId) {
    animationFrame = frameId;
}

// ==================== 导出 ====================
export {
    initAudio,
    loadAudioDevices,
    getAudioBuffer,
    calculateVolume,
    calculatePeak,
    isVolumeAboveThreshold,
    stopAudio,
    getAudioContext,
    getAnalyser,
    setAnimationFrame
};
