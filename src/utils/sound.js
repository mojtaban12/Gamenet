// تولید صداهای نوتیف با Web Audio API — بدون نیاز به فایل صوتی

let audioCtx = null

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtx
}

function playTone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.value = freq

    const start = ctx.currentTime + delay
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(start)
    osc.stop(start + duration)
}

export const sounds = {
    notify() {
        playTone(660, 0.15, 'sine', 0.12, 0)
        playTone(880, 0.2, 'sine', 0.12, 0.1)
    },
    friendOnline() {
        playTone(523, 0.12, 'sine', 0.1, 0)
        playTone(659, 0.12, 'sine', 0.1, 0.08)
        playTone(784, 0.18, 'sine', 0.1, 0.16)
    },
    friendOffline() {
        playTone(440, 0.15, 'sine', 0.08, 0)
        playTone(330, 0.18, 'sine', 0.08, 0.1)
    },
    invite() {
        playTone(740, 0.12, 'triangle', 0.13, 0)
        playTone(740, 0.12, 'triangle', 0.13, 0.15)
        playTone(988, 0.2, 'triangle', 0.13, 0.3)
    },
    friendRequest() {
        playTone(587, 0.15, 'sine', 0.12, 0)
        playTone(880, 0.2, 'sine', 0.12, 0.12)
    },
    message() {
        playTone(800, 0.08, 'sine', 0.08, 0)
    },
}

// فعال‌سازی AudioContext بعد از اولین تعامل کاربر
export function initAudio() {
    const resume = () => {
        const ctx = getCtx()
        if (ctx.state === 'suspended') ctx.resume()
        document.removeEventListener('click', resume)
        document.removeEventListener('keydown', resume)
    }
    document.addEventListener('click', resume)
    document.addEventListener('keydown', resume)
}