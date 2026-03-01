/**
 * ===============================================
 * YIN 音高检测算法 - 核心实现
 * ===============================================
 * 
 * 论文: "YIN, a fundamental frequency estimator for speech and music"
 * 作者: Alain de Cheveigné and Hideki Kawahara (2002)
 * 
 * YIN算法是音乐音高检测的业界标准，被以下应用使用：
 * - GuitarTuna (吉他调音器)
 * - Yousician (音乐学习应用)
 * - Praat (语音分析软件)
 * 
 * 为什么YIN比传统自相关算法更好？
 * 1. 对谐波有更好的抑制能力 - 吉他的声音包含基频和多个谐波
 * 2. 更适合周期性信号 - 音乐是周期性的
 * 3. 数学上更稳定 - 归一化步骤使结果更可靠
 */

/**
 * YIN算法主函数
 * 
 * @param {Float32Array} buffer - 音频时域信号缓冲区
 * @param {number} sampleRate - 采样率 (Hz)，通常是 48000
 * @returns {number} 检测到的基频 (Hz)，如果检测失败返回 -1
 * 
 * 工作流程：
 * 1. 计算差分函数 - 衡量信号与自身偏移后的差异
 * 2. 累积平均归一化 - 抑制谐波的关键步骤
 * 3. 绝对阈值搜索 - 找到第一个明显的周期
 * 4. 抛物线插值 - 提高精度到亚采样级别
 */
function yinPitchDetection(buffer, sampleRate) {
    // ==================== 配置参数 ====================
    
    /**
     * 阈值: 控制检测的严格程度
     * - 0.05: 非常严格，只检测非常清晰的音高
     * - 0.10: 较严格，适合干净的录音
     * - 0.15: 标准值，平衡准确性和检测率（推荐）
     * - 0.20: 宽松，在嘈杂环境下也能检测
     */
    const threshold = 0.15;
    
    /**
     * 缓冲区大小
     * 通常使用一半的buffer来计算，因为需要与偏移后的信号比较
     */
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);
    
    // YIN算法的输出缓冲区
    const yinBuffer = new Float32Array(halfBufferSize);
    
    
    // ==================== 步骤1: 差分函数 ====================
    /**
     * 计算 d(τ) = Σ (x[j] - x[j+τ])²
     * 
     * 物理意义:
     * - τ (tau) 代表一个候选周期（以采样点为单位）
     * - 如果 τ 是真实周期，信号 x[j] 和 x[j+τ] 应该几乎相同
     * - 差异越小，d(τ) 的值越小
     * 
     * 例子（假设采样率 48000 Hz）:
     * - 检测 A4 (440 Hz)
     * - 周期 T = 1/440 ≈ 0.00227 秒
     * - τ = T × 48000 ≈ 109 个采样点
     * - 如果 buffer[0] ≈ buffer[109]，说明找到了周期
     */
    yinBuffer[0] = 1;  // 第0项特殊处理，后面会在归一化步骤设为1
    
    for (let tau = 1; tau < halfBufferSize; tau++) {
        let sum = 0;
        
        // 计算信号与自身偏移 tau 后的平方差之和
        for (let i = 0; i < halfBufferSize; i++) {
            const delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;  // 平方差
        }
        
        yinBuffer[tau] = sum;
    }
    
    
    // ==================== 步骤2: 累积平均归一化 ====================
    /**
     * 这是YIN的核心创新！
     * 
     * 计算 d'(τ) = d(τ) / [ (1/τ) Σ d(j) ]
     *                         j=1..τ
     * 
     * 为什么需要归一化？
     * 
     * 问题: 吉他弹 E2 (82 Hz) 时，信号包含：
     *   - 基频: 82 Hz
     *   - 2次谐波: 164 Hz (2倍频率)
     *   - 3次谐波: 246 Hz (3倍频率)
     * 
     * 传统自相关可能会被谐波迷惑，因为：
     * - τ₁ = 109 (对应 440 Hz)  → d(τ₁) = 0.05
     * - τ₂ = 218 (对应 220 Hz, 2次谐波) → d(τ₂) = 0.03 更小！
     * 
     * 归一化后：
     * - d'(τ₁) = 0.05 / (平均前109项)
     * - d'(τ₂) = 0.03 / (平均前218项) ← 这个平均值更大
     * 
     * 结果: 基频的归一化值反而更小，成功抑制谐波
     */
    yinBuffer[0] = 1;  // 设置第0项为1（约定）
    let runningSum = 0;
    
    for (let tau = 1; tau < halfBufferSize; tau++) {
        runningSum += yinBuffer[tau];  // 累加
        
        // 防止除以0
        if (runningSum === 0) {
            yinBuffer[tau] = 1;
        } else {
            // 归一化: 当前值 × (τ / 累积和)
            yinBuffer[tau] *= tau / runningSum;
        }
    }
    
    
    // ==================== 步骤3: 绝对阈值搜索 ====================
    /**
     * 在吉他频率范围内搜索第一个低于阈值的"谷"
     * 
     * 吉他标准调弦范围:
     * - 最低音: E2 = 82.41 Hz (第6弦空弦)
     * - 最高音: E6 ≈ 1318 Hz (第1弦第24品)
     * 
     * 搜索策略:
     * 1. 从低频到高频搜索（对应从小 τ 到大 τ）
     * 2. 找到第一个 yinBuffer[τ] < threshold 的点
     * 3. 继续找该区域的局部最小值（谷底）
     * 4. 第一个明显的谷就是基频！
     */
    const MIN_FREQ = 75;    // 稍低于 E2，留有余地
    const MAX_FREQ = 1400;  // 稍高于 E6，留有余地
    
    // 频率与 τ 的关系: frequency = sampleRate / τ
    // 所以: τ = sampleRate / frequency
    const minTau = Math.max(Math.floor(sampleRate / MAX_FREQ), 2);
    const maxTau = Math.min(Math.floor(sampleRate / MIN_FREQ), halfBufferSize - 1);
    
    let tau = minTau;
    
    // 搜索第一个低于阈值的点
    while (tau < maxTau) {
        if (yinBuffer[tau] < threshold) {
            // 找到了一个候选！
            // 现在找这个区域的局部最小值（谷底）
            while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
                tau++;  // 继续向右找更小的值
            }
            
            // ==================== 步骤4: 抛物线插值 ====================
            /**
             * 提高精度到亚采样级别
             * 
             * 问题: 我们只能检测整数 τ (109, 110, 111...)
             * 但真实周期可能是 109.3 个采样点
             * 
             * 解决: 用三个点拟合抛物线，找抛物线的最低点
             * 
             * 数学公式:
             * 给定三点 (τ-1, s₀), (τ, s₁), (τ+1, s₂)
             * 拟合抛物线 y = ax² + bx + c
             * 最低点在: τ + (s₂ - s₀) / (2(2s₁ - s₂ - s₀))
             */
            let betterTau = tau;
            
            if (tau > 0 && tau < halfBufferSize - 1) {
                const s0 = yinBuffer[tau - 1];  // 左边的点
                const s1 = yinBuffer[tau];      // 谷底
                const s2 = yinBuffer[tau + 1];  // 右边的点
                
                // 抛物线插值公式
                const adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
                
                // 检查计算结果有效
                if (!isNaN(adjustment) && isFinite(adjustment)) {
                    betterTau = tau + adjustment;
                }
            }
            
            // 转换 τ 到频率 (Hz)
            const frequency = sampleRate / betterTau;
            
            // 最后验证: 确保频率在吉他范围内
            if (frequency >= MIN_FREQ && frequency <= MAX_FREQ) {
                return frequency;
            }
        }
        
        tau++;
    }
    
    // 没有找到满足条件的周期
    return -1;
}


/**
 * ===============================================
 * 包装函数 - 添加噪声门控
 * ===============================================
 */

/**
 * 主音高检测入口函数
 * 
 * @param {Float32Array} buffer - 音频信号
 * @param {number} sampleRate - 采样率
 * @returns {number} 频率 (Hz) 或 -1
 */
function autoCorrelate(buffer, sampleRate) {
    // ==================== 噪声门控 ====================
    /**
     * RMS (Root Mean Square) - 均方根
     * 衡量信号的"平均能量"
     * 
     * 如果信号太弱（RMS < 0.003），可能只是背景噪音
     * 直接返回 -1 避免误检测
     */
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
        rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    
    // 噪声门: 信号太弱就不处理 (降低阈值以支持未插电电吉他)
    if (rms < 0.0005) {
    if (rms < 0.003) {
        return -1;
    }
    
    // 调用YIN算法
    return yinPitchDetection(buffer, sampleRate);
}


/**
 * ===============================================
 * 使用示例
 * ===============================================
 * 
 * // 1. 获取音频数据（Web Audio API）
 * const analyser = audioContext.createAnalyser();
 * analyser.fftSize = 2048;
 * const buffer = new Float32Array(analyser.fftSize);
 * analyser.getFloatTimeDomainData(buffer);
 * 
 * // 2. 检测音高
 * const frequency = autoCorrelate(buffer, audioContext.sampleRate);
 * 
 * // 3. 处理结果
 * if (frequency > 0) {
 *     console.log('检测到频率:', frequency.toFixed(2), 'Hz');
 *     const note = frequencyToNote(frequency);
 *     console.log('对应音符:', note);
 * } else {
 *     console.log('未检测到音高');
 * }
 */

// ==================== 导出函数 ====================

export { autoCorrelate };
