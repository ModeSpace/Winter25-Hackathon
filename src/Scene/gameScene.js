import { createHandLandmarker, detectThrow, setOnThrow, setOnLandmarks } from '../handTracker.js';
import { Network } from '../network.js';

var cooldown = 10;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        for (let i = 0; i <= 15; i++) {
            const idx = String(i).padStart(3, '0');
            this.load.image(`player${i}`, `Assests/first-character/tile${idx}.png`);
        }
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const SIZE = 50;

        const makeFrames = (start, end) => {
            const out = [];
            for (let i = start; i <= end; i++) out.push({ key: `player${i}` });
            return out;
        };
        this.anims.create({ key: 'walk-down', frames: makeFrames(0, 3), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-left', frames: makeFrames(12, 15), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-right', frames: makeFrames(4, 7), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: makeFrames(8, 11), frameRate: 8, repeat: -1 });

        // Player setup
        if (window.isMultiplayer) {
            const player1Y = H * 0.8;
            const player2Y = H * 0.2;
            // Host is player1 (bottom), Client is player2 (top)
            const myY = window.isHost ? player1Y : player2Y;
            const opponentY = window.isHost ? player2Y : player1Y;

            this.player = this.createPlayer(W / 2, myY);
            this.opponent = this.createPlayer(W / 2, opponentY);
            this.setupNetwork();
        } else {
            this.player = this.createPlayer(W / 2, H / 2);
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        this.chargeBarBg = this.add.rectangle(W - 100, H - 30, 84, 20, 0x333333).setOrigin(0, 0.5);
        this.chargeBar = this.add.rectangle(W - 98, H - 30, 0, 16, 0x00ff00).setOrigin(0, 0.5);
        this.charge = 0;

        this.video = document.getElementById('webcam');
        if (window.useCamera) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
                .then((stream) => {
                    this.video.srcObject = stream;
                    return this.video.play();
                })
                .catch((err) => console.warn('Webcam error:', err));

            const miniW = 160;
            const miniH = 120;
            Object.assign(this.video.style, {
                position: 'absolute', width: `${miniW}px`, height: `${miniH}px`,
                top: '10px', right: '10px', border: '3px solid rgba(255,255,255,0.9)',
                borderRadius: '6px', zIndex: 9999, objectFit: 'cover', pointerEvents: 'none'
            });

            createHandLandmarker().catch(e => console.warn('HandLandmarker init failed', e));
            setOnThrow((power, wrist) => {
                if (this.qKey.isDown) {
                    this.charge = Math.min(this.charge + ((0.1) * power) / 20, 1);
                    this.updateChargeBar();
                } else {
                    this.throwSnowball(power, wrist);
                }
            });
            this.latest = null;
            setOnLandmarks((data) => { this.latest = data; });
            this.overlay = this.add.graphics({ depth: 1000 });
        } else {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.spaceKey.on('down', () => {
                if (this.qKey.isDown) {
                    this.charge = Math.min(this.charge + 0.1, 1);
                    this.updateChargeBar();
                } else if (cooldown <= 0) {
                    cooldown = 40;
                    this.throwSnowball(20, { x: 0.5, y: 0.5 });
                }
            });
        }
    }

    createPlayer(x, y) {
        const player = this.add.sprite(x, y, 'player0');
        player.setOrigin(0.5, 0.5);
        this.physics.add.existing(player);
        player.body.setCollideWorldBounds(true);
        player.body.setSize(50, 50);
        player.lastDir = 'down';
        return player;
    }

    setupNetwork() {
        Network.setDataHandler((data) => {
            if (!this.opponent) return;

            switch (data.type) {
                case 'move':
                    this.opponent.setPosition(data.x, data.y);
                    this.updatePlayerAnimation(this.opponent, data.velX, data.velY, data.lastDir);
                    break;
                case 'throw':
                    this.spawnOpponentSnowball(data);
                    break;
            }
        });

        // Send our state periodically
        this.time.addEvent({
            delay: 100, // 10 times per second
            callback: () => {
                Network.send({
                    type: 'move',
                    x: this.player.x,
                    y: this.player.y,
                    velX: this.player.body.velocity.x,
                    velY: this.player.body.velocity.y,
                    lastDir: this.player.lastDir
                });
            },
            loop: true
        });
    }

    throwSnowball(power, wrist) {
        const multiplier = 1 + this.charge * 4;
        const px = this.player.x;
        const py = this.player.y;
        const velocity = (200 + power * 5) / multiplier;

        this.spawnSnowball(px, py, multiplier, velocity);

        if (window.isMultiplayer) {
            Network.send({
                type: 'throw',
                x: px,
                y: py,
                multiplier: multiplier,
                velocity: velocity
            });
        }

        this.charge = 0;
        this.updateChargeBar();
    }

    spawnSnowball(x, y, multiplier, velocity) {
        const ball = this.add.circle(x, y, 10 * multiplier, 0x88ccff);
        this.physics.add.existing(ball);
        ball.body.setCollideWorldBounds(true);
        ball.body.onWorldBounds = true;
        // In multiplayer, host throws up, client throws down
        const direction = (window.isMultiplayer && !window.isHost) ? 1 : -1;
        ball.body.setVelocity(0, velocity * direction);
        ball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === ball) ball.destroy();
        });
    }

    spawnOpponentSnowball({ x, y, multiplier, velocity }) {
        const ball = this.add.circle(x, y, 10 * multiplier, 0xff8888); // Different color
        this.physics.add.existing(ball);
        ball.body.setCollideWorldBounds(true);
        ball.body.onWorldBounds = true;
        // Invert direction for opponent's throw
        const direction = window.isHost ? 1 : -1;
        ball.body.setVelocity(0, velocity * direction);
        ball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === ball) ball.destroy();
        });
    }

    updateChargeBar() {
        this.chargeBar.width = this.charge * 80;
    }

    handlePlayerInput() {
        const playerSpeed = 200;
        this.player.body.setVelocity(0);
        if (this.cursors.left.isDown || this.wasd.A.isDown) this.player.body.setVelocityX(-playerSpeed);
        if (this.cursors.right.isDown || this.wasd.D.isDown) this.player.body.setVelocityX(playerSpeed);
        if (this.cursors.up.isDown || this.wasd.W.isDown) this.player.body.setVelocityY(-playerSpeed);
        if (this.cursors.down.isDown || this.wasd.S.isDown) this.player.body.setVelocityY(playerSpeed);
    }

    updatePlayerAnimation(player, velX, velY, lastDir) {
        if (velX < 0) {
            if (player.anims.currentAnim?.key !== 'walk-left') player.anims.play('walk-left', true);
            player.lastDir = 'left';
        } else if (velX > 0) {
            if (player.anims.currentAnim?.key !== 'walk-right') player.anims.play('walk-right', true);
            player.lastDir = 'right';
        } else if (velY < 0) {
            if (player.anims.currentAnim?.key !== 'walk-up') player.anims.play('walk-up', true);
            player.lastDir = 'up';
        } else if (velY > 0) {
            if (player.anims.currentAnim?.key !== 'walk-down') player.anims.play('walk-down', true);
            player.lastDir = 'down';
        } else {
            if (player.anims.isPlaying) player.anims.stop();
            const idleMap = { down: 'player0', left: 'player12', right: 'player4', up: 'player8' };
            const tex = idleMap[lastDir] || 'player0';
            if (player.texture.key !== tex) player.setTexture(tex);
        }
    }

    update() {
        cooldown--;
        this.handlePlayerInput();
        this.updatePlayerAnimation(this.player, this.player.body.velocity.x, this.player.body.velocity.y, this.player.lastDir);

        this.charge = Math.max(0, this.charge - 0.005);
        this.updateChargeBar();

        if (window.useCamera && this.video && this.video.readyState >= 2) {
            detectThrow(this.video);
            if (this.overlay && this.latest) {
                this.overlay.clear();
                const W = this.cameras.main.width;
                const H = this.cameras.main.height;
                const { wrist, elbow } = this.latest;
                const wristX = wrist.x * W; const wristY = wrist.y * H;
                const elbowX = elbow.x * W; const elbowY = elbow.y * H;
                this.overlay.lineStyle(2, 0xffff00).strokeRect(wristX - 10, wristY - 10, 20, 20);
                this.overlay.lineStyle(2, 0xff00ff).strokeRect(elbowX - 10, elbowY - 10, 20, 20);
            }
        }
    }
}
