// javascript
export default class MouseTracker {
    constructor(scene, {
        onFlick,
        getQDown = () => false,
        getVideoFlipped = () => false,
        canTrigger = () => true,
        sampleWindowMs = 80,           // shorter window for faster response
        speedThresholdPxPerMs = 0.8,   // higher threshold for consistency
        powerScale = 20,
        cooldownMs = 200               // prevent rapid repeated triggers
    } = {}) {
        this.scene = scene;
        this.onFlick = onFlick;
        this.getQDown = getQDown;
        this.getVideoFlipped = getVideoFlipped;
        this.canTrigger = canTrigger;
        this.SAMPLE_WINDOW_MS = sampleWindowMs;
        this.SPEED_THRESHOLD_PX_PER_MS = speedThresholdPxPerMs;
        this.POWER_SCALE = powerScale;
        this.COOLDOWN_MS = cooldownMs;

        this.pointerSamples = [];
        this.lastTriggerTime = 0;
        this._onMove = this._onMove.bind(this);

        scene.input.on('pointermove', this._onMove);
    }

    _pushSample(x, y, t) {
        this.pointerSamples.push({ x, y, t });
        const cutoff = t - this.SAMPLE_WINDOW_MS;
        while (this.pointerSamples.length && this.pointerSamples[0].t < cutoff) {
            this.pointerSamples.shift();
        }
    }

    _onMove(pointer) {
        const now = this.scene.time.now;
        this._pushSample(pointer.x, pointer.y, now);

        // ignore if scene not ready or on cooldown
        if (this.scene.gameOver || !this.scene.controlsEnabled ||
            !this.canTrigger() || (now - this.lastTriggerTime) < this.COOLDOWN_MS) {
            return;
        }

        if (this.pointerSamples.length < 3) return; // need enough samples

        const first = this.pointerSamples[0];
        const last = this.pointerSamples[this.pointerSamples.length - 1];
        const dt = last.t - first.t;
        if (dt <= 10) return; // avoid division by near-zero

        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const vy = dy / dt; // px/ms (positive = downward)
        const speed = Math.abs(vy);

        // trigger on downward flick above threshold
        if (vy < this.SPEED_THRESHOLD_PX_PER_MS && speed >= this.SPEED_THRESHOLD_PX_PER_MS) {
            this.lastTriggerTime = now;
            const power = Math.min(speed * this.POWER_SCALE, 200);

            const W = this.scene.cameras.main.width;
            const H = this.scene.cameras.main.height;
            let wristNorm = {
                x: Phaser.Math.Clamp(pointer.x / W, 0, 1),
                y: Phaser.Math.Clamp(pointer.y / H, 0, 1)
            };
            if (this.getVideoFlipped()) wristNorm.x = 1 - wristNorm.x;

            const qDown = !!this.getQDown();

            if (typeof this.onFlick === 'function') {
                this.onFlick({ power, wrist: wristNorm, qDown });
            }

            // clear samples after trigger to avoid double-fire
            this.pointerSamples.length = 0;
        }
    }

    destroy() {
        this.pointerSamples.length = 0;
        this.scene.input.off('pointermove', this._onMove);
    }
}