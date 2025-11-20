// File: `src/Scene/gameScene.js`
import { createHandLandmarker, detectThrow, setOnThrow, setOnLandmarks } from '../handTracker.js';

var cooldown = 10;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load individual tile images from Assests/first-character as separate frames.
        // Files are named tile000.png .. tile015.png in the repo.
        for (let i = 0; i <= 15; i++) {
            const idx = String(i).padStart(3, '0');
            this.load.image(`player${i}`, `Assests/first-character/tile${idx}.png`);
        }
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const SIZE = 50;

        // animations for player (assumption: tiles are arranged as 4 frames per direction)
        // mapping assumption (common layout):
        // 0-3   : walk down
        // 4-7   : walk left
        // 8-11  : walk right
        // 12-15 : walk up
        const makeFrames = (start, end) => {
            const out = [];
            for (let i = start; i <= end; i++) out.push({ key: `player${i}` });
            return out;
        };
        this.anims.create({ key: 'walk-down', frames: makeFrames(0, 3), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-left', frames: makeFrames(12, 15), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-right', frames: makeFrames(4, 7), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: makeFrames(8, 11), frameRate: 8, repeat: -1 });

        // player square
        const startX = W / 2 - SIZE / 2;
        const startY = H / 2 - SIZE / 2;
        // Create the player using the first frame as the initial texture.
        this.player = this.add.sprite(startX, startY, 'player0');
        // Use top-left origin so positioning and body sizes align with earlier code that used x/y offsets.
        this.player.setOrigin(0, 0);
        // track last facing direction for idle frame
        this.lastDir = 'down';
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(SIZE, SIZE);

        // controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        this.chargeBarBg = this.add.rectangle(W - 50, H - 20, 100, 20, 0x3333333).setOrigin(1, 0.5);
        this.chargeBar = this.add.rectangle(W - 100, H - 20, 0, 16, 0x00ff00).setOrigin(0)
        this.charge = 0;
        this.isCharging = false;

        // webcam video element (existing in DOM)
        this.video = document.getElementById('webcam');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
            .then((stream) => {
                this.video.srcObject = stream;
                return this.video.play();
            })
            .catch((err) => console.warn('Webcam error:', err));

        // style video to be a small camera in top-right corner (DOM overlay)
        const miniW = 160;
        const miniH = 120;
        Object.assign(this.video.style, {
            position: 'absolute',
            width: `${miniW}px`,
            height: `${miniH}px`,
            top: '10px',
            right: '10px',
            border: '3px solid rgba(255,255,255,0.9)',
            borderRadius: '6px',
            zIndex: 9999,
            objectFit: 'cover',
            pointerEvents: 'none'
        });

        // hand landmarker setup (only if using camera)
        if (window.useCamera) {
            createHandLandmarker().catch(e => console.warn('HandLandmarker init failed', e));
            setOnThrow((power, wrist) => {
                if (this.qKey.isDown) {
                    this.charge = Math.min(this.charge + ((0.1) * power)/20, 1); // Increment on throw action
                    this.updateChargeBar();
                } else {
                    this.throwSnowball(power, wrist);
                }
            });
            this.latest = null;
            setOnLandmarks((data) => {
                this.latest = data;
            });
        } else {
            // space key for shooting or charging
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.spaceKey.on('down', () => {
                if (this.qKey.isDown) {
                    // Charge instead of throw
                    this.charge = Math.min(this.charge + 0.1, 1);
                    this.updateChargeBar();
                } else if (cooldown <= 0) {
                    cooldown = 40;
                    this.throwSnowball(20, { x: 0.5, y: 0.5 });
                }
            });

        }

        // graphics for overlays (only if using camera)
        if (window.useCamera) {
            this.overlay = this.add.graphics();
            this.overlay.setDepth(1000);
        }
    }

    throwSnowball(power, wrist) {
        const multiplier = 1 + this.charge * 4;
        const px = this.player.x + this.player.width / 2;
        const py = this.player.y + this.player.height / 2;
        const ball = this.add.circle(px, py, 10 * multiplier, 0x88ccff);
        this.physics.add.existing(ball);
        ball.body.setCollideWorldBounds(true);
        ball.body.onWorldBounds = true;
        const velocity = (200 + power * 5)/multiplier;
        ball.body.setVelocity(0, -velocity);
        ball.body.world.on('worldbounds', function(body) {
            if (body.gameObject === ball) {
                ball.destroy();
            }
        });
        this.charge = 0;
        this.updateChargeBar();
    }
    updateChargeBar() {
        const W = this.cameras.main.width;
        this.chargeBar.width = this.charge * 80;
        this.chargeBar.x = W - 100;
    }

    update() {
        cooldown--;
        const playerSpeed = 200;
        this.player.body.setVelocity(0);
        // movement input
        if (this.cursors.left.isDown)        this.player.body.setVelocityX(-playerSpeed);
        if (this.cursors.right.isDown)       this.player.body.setVelocityX(playerSpeed);
        if (this.cursors.up.isDown)          this.player.body.setVelocityY(-playerSpeed);
        if (this.cursors.down.isDown)        this.player.body.setVelocityY(playerSpeed);
        if (this.wasd.A.isDown)              this.player.body.setVelocityX(-playerSpeed);
        if (this.wasd.D.isDown)              this.player.body.setVelocityX(playerSpeed);
        if (this.wasd.W.isDown)              this.player.body.setVelocityY(-playerSpeed);
        if (this.wasd.S.isDown)              this.player.body.setVelocityY(playerSpeed);

        // choose animation based on velocity (horizontal priority for diagonals)
        const vx = this.player.body.velocity.x;
        const vy = this.player.body.velocity.y;
        if (vx < 0) {
            if (this.player.anims.currentAnim?.key !== 'walk-left') this.player.anims.play('walk-left', true);
            this.lastDir = 'left';
        } else if (vx > 0) {
            if (this.player.anims.currentAnim?.key !== 'walk-right') this.player.anims.play('walk-right', true);
            this.lastDir = 'right';
        } else if (vy < 0) {
            if (this.player.anims.currentAnim?.key !== 'walk-up') this.player.anims.play('walk-up', true);
            this.lastDir = 'up';
        } else if (vy > 0) {
            if (this.player.anims.currentAnim?.key !== 'walk-down') this.player.anims.play('walk-down', true);
            this.lastDir = 'down';
        } else {
            // idle: stop anim and show first frame of last direction
            if (this.player.anims.isPlaying) this.player.anims.stop();
            const idleMap = { down: 'player0', left: 'player12', right: 'player4', up: 'player8' };
            const tex = idleMap[this.lastDir] || 'player0';
            if (this.player.texture.key !== tex) this.player.setTexture(tex);
        }


        //charging time
        this.charge = Math.max(0, this.charge - 0.005);
        this.updateChargeBar();

        // call detector only if using camera
        if (window.useCamera && this.video && this.video.readyState >= 2) {
            detectThrow(this.video);
        }

        // draw overlays only if using camera
        if (window.useCamera && this.overlay) {
            this.overlay.clear();
            const W = this.cameras.main.width;
            const H = this.cameras.main.height;

            if (!this.latest) return;

            const { wrist, elbow } = this.latest;
            const wristX = wrist.x * W;
            const wristY = wrist.y * H;
            const elbowX = elbow.x * W;
            const elbowY = elbow.y * H;

            this.overlay.lineStyle(2, 0xffff00);
            this.overlay.strokeRect(wristX - 10, wristY - 10, 20, 20);
            this.overlay.lineStyle(2, 0xff00ff);
            this.overlay.strokeRect(elbowX - 10, elbowY - 10, 20, 20);
        }
    }
}