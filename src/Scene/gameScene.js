import { createHandLandmarker, detectThrow, setOnThrow, setOnLandmarks } from '../handTracker.js';
import { Network } from '../network.js';
import { AiController } from "../aiController.js";
import MouseTracker from "../mouseTracker.js";

var cooldown = 10;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        for (let i = 0; i <= 22; i++) {
            const idx = String(i).padStart(3, '0');
            this.load.image(`player${i}`, `Assets/first-character/${i}_elf-sprite.png`);
        }
        // wrist marker: replace with the attached image file (put the file at this path)
        this.load.image('wristMarker', 'Assets/markers/wrist-custom.png');
        this.load.image('snowball1', 'Assets/snowball/Snowball-1.png');
        this.load.image('snowball2', 'Assets/snowball/Snowball-2.png');
        this.load.image('background', 'Assets/background/snowy-ground.png');
        this.load.image('snowWall', 'Assets/wall/snow-wall.png');
        this.load.image('hpBar', 'Assets/bars/health_bar.png');
        this.load.image('chargeBar', 'Assets/bars/energy-bar.png');
    }

    init(data) {
        this.startCountdown = data ? data.startCountdown : false;

        if (!window.isMultiplayer) {
            this.level = (data && typeof data.level === 'number') ? data.level : 1;
        } else {
            this.level = 0; // multiplayer doesn't use levels
        }
    }

    create() {
        this.gameOver = false;
        this.localRequestedRematch = false;
        this.opponentRequestedRematch = false;
        this._ended = false;
        this.aiHealth = 1;
        this.opponentTargetX = 0;
        this.opponentTargetY = 0;
        this.interpolationSpeed = 0.2;
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const thickness = 64;
        const g = this.add.graphics();
        this.mySnowballs = this.physics.add.group();

        //scale player character
        

        const makeFrames = (start, end) => {
            const out = [];
            for (let i = start; i <= end; i++) out.push({ key: `player${i}` });
            return out;
        };
        this.anims.create({ key: 'walk-down', frames: makeFrames(0, 3), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-left', frames: makeFrames(12, 15), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-right', frames: makeFrames(4, 7), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: makeFrames(8, 11), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'snowball-throw-front', frames: makeFrames(17, 18), frameRate: 8, repeat: false });
        this.anims.create({ key: 'snowball-throw-back', frames: makeFrames(21, 22), frameRate: 8, repeat: false });
        // Border setup

        g.lineStyle(6, 0xffffff, 1);
        g.strokeRect(thickness / 2, thickness / 2, W - thickness, H - thickness);
        this.add.circle(W / 2, H / 2, 6, 0xffffff);

        this.walls = this.add.group();
        const makeWall = (x, y, w, h, side) => {
            const rect = this.add.sprite(x, y, 'snowWall');
            rect.displayWidth = w;
            rect.displayHeight = h;
            if (side === 1) rect.angle = 90;
            if (side === 2) rect.angle = -90;
            if (side === 3) rect.angle = 180;
            this.physics.add.existing(rect, true);
            this.walls.add(rect);
            return rect;
        }
        makeWall(W / 2, thickness / 2, W , thickness, 3); // top
        makeWall(W / 2, H - thickness / 2, W , thickness, 0); // bottom
        makeWall(thickness / 2, H / 2, H , thickness, 1); // left
        makeWall(W - thickness / 2, H / 2, H , thickness, 2); // right
        this.centerWall = makeWall(W / 2 - 3, H / 2, W - thickness - 25, thickness);

        //make snowy background
        const bg = this.add.tileSprite(W / 2, H / 2, W - thickness, H - thickness, 'background');
        bg.setDepth(-1);

        // Player setup
        if (window.isMultiplayer) {
            const player1Y = H * 0.8;
            const player2Y = H * 0.2;
            // Host is player1 (bottom), Client is player2 (top)
            const myY = window.isHost ? player1Y : player2Y;
            const opponentY = window.isHost ? player2Y : player1Y;

            this.player = this.createPlayer(W / 2, myY).setScale(2);
            this.opponent = this.createPlayer(W / 2, opponentY).setScale(2);
            this.setupNetwork();
        } else {
            this.player = this.createPlayer(W / 2, H * 0.8).setScale(2);
            this.opponent = this.createPlayer(W / 2, H * 0.2).setScale(2);
            const padding = 10;
            const aiBounds = { minX: thickness + padding, maxX: W - thickness - padding };
            this.aiController = new AiController(this, this.opponent, this.player, aiBounds, this.level);
            this.aiController.level = this.level;
            this.aiController.onShootRequest = (targetX, targetY) => {
                const velocity = 260;
                const multiplier = 1;
                this.spawnAiSnowball(this.opponent.x, this.opponent.y, multiplier, velocity);
            };
            this.physics.add.overlap(this.opponent, this.mySnowballs, (opponent, snowball) => {
                this.handleAiHit(opponent, snowball);
            }, null, this);
        }
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        //Charge bar
        this.chargeBarOverlay = this.add.image(W - 75, H - 29, 'chargeBar').setOrigin(0.5).setScale(4);
        this.chargeBarOverlay.depth = 1000;
        this.chargeBarBg = this.add.rectangle(W - 98, H - 28, 87, 20, 0x333333).setOrigin(0, 0.5);
        this.chargeBar = this.add.rectangle(W - 98, H - 28, 0, 16, 0x00ff00).setOrigin(0, 0.5);
        this.charge = 0;

        //Health bar
        this.healthBarOverlay = this.add.image(80, 30, 'hpBar').setScale(5);
        this.healthBarOverlay.depth = 1000;
        this.healthBarBg = this.add.rectangle(10, 20, 144, 24, 0x333333).setOrigin(0, 0);
        this.healthBar = this.add.rectangle(12, 22, 140, 20, 0xff0000).setOrigin(0, 0);
        this.health = 1;
        this.gameOver = false;
        this.networkMoveEvent = null;
        if (window.isMultiplayer) {
            this.physics.add.overlap(this.opponent, this.mySnowballs, (opponent, snowball) => {
                // When the opponent is hit, we just destroy the snowball on our screen.
                // The opponent's client will handle its own health reduction.
                snowball.destroy();
            }, null, this);
        }
        //Level Counter
        if (!window.isMultiplayer) {
            this.add.text(W - 20, 20, `Level: ${this.level}`, {
                fontFamily: 'font',
                fontSize: '48px',
                fill: '#e0f7fa',
                stroke: '#0d47a1',
                strokeThickness: 6,
                shadow: { offsetX: 4, offsetY: 4, color: '#000000', blur: 4, stroke: true, fill: true }
            }).setOrigin(1, 0).setDepth(2000);
        }
        this.opponentSnowballs = this.physics.add.group({});
        this.physics.add.overlap(this.player, this.opponentSnowballs, this.handlePlayerHit, null, this);

        this.video = document.getElementById('webcam');
        this.videoFlipped = false;
        if (window.useCamera) {
            navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}, audio: false})
                .then((stream) => {
                    this.video.srcObject = stream;

                    // Detect actual facing mode and only visually flip preview for front cameras
                    const track = stream.getVideoTracks()[0];
                    const settings = track && track.getSettings ? track.getSettings() : {};
                    if (settings.facingMode === 'user' || settings.facingMode === undefined) {
                        this.video.style.transform = 'scaleX(-1)';
                        this.videoFlipped = true;
                    } else {
                        this.videoFlipped = false;
                    }

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

            // Mirror wrist X for throws when preview is flipped so game uses consistent coords
            setOnThrow((power, wrist) => {
                const usedWrist = (this.videoFlipped && wrist) ? {x: 1 - wrist.x, y: wrist.y} : wrist;
                if (this.qKey.isDown) {
                    this.charge = Math.min(this.charge + ((0.1) * power) / 20, 1);
                    this.updateChargeBar();
                } else {
                    this.throwSnowball(power, usedWrist);
                }
            });

            this.latest = null;
            setOnLandmarks((data) => {
                this.latest = data;
            });
            this.overlay = this.add.graphics({depth: 1000});
        } else {
            const handleFlick = ({ power, wrist, qDown }) => {
                if (qDown) {
                    this.charge = Math.min(this.charge + (power / 200) * 0.1, 1);
                    this.updateChargeBar();
                    return;
                }
                cooldown = 40;
                this.throwSnowball(power, wrist);
            };

            this.mouseTracker = new MouseTracker(this, {
                onFlick: handleFlick,
                getQDown: () => !!this.qKey?.isDown,
                getVideoFlipped: () => !!this.videoFlipped,
                canTrigger: () => cooldown <= 0
            });
        }
        this.controlsEnabled = !this.startCountdown;
        if (this.startCountdown) {
            this.time.delayedCall(50, () => this.runCountdown());
        }
    }

    createPlayer(x, y) {
        const player = this.add.sprite(x, y, 'player0');
        player.setOrigin(0.5, 0.5);
        this.physics.add.existing(player);
        player.body.setCollideWorldBounds(false);
        player.body.setSize(80 * 0.8, 80 * 0.8);
        player.setScale(0.8);
        player.lastDir = 'down';
        player.body.setSize(40, 50)
        player.body.setOffset((player.width - 40) / 2, (player.height - 50) / 2); // center it        this.physics.add.collider(player, this.centerWall);
        this.walls.getChildren().forEach((w) => {
            this.physics.add.collider(player, w);
        });
        return player;
    }
    runCountdown() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        const countdownText = this.add.text(W / 2, H / 2, '', {
            fontFamily: 'Arial', fontSize: '128px', color: '#ff0000',
            stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setDepth(2000);

        let count = 3;
        countdownText.setScale(1.5);
        const tick = () => {
            if (count > 0) {
                countdownText.setText(String(count));
                countdownText.setScale(1.5);
                this.tweens.add({
                    targets: countdownText,
                    scale: 1,
                    duration: 300,
                    ease: 'Power2'
                });
                count--;
                return;
            }
            countdownText.setText('GO!');
            this.tweens.add({
                targets: countdownText,
                scale: 1,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    countdownText.destroy();
                    this.controlsEnabled = true;
                }
            });
        };

        // run first tick immediately (already delayed a bit above), then every 1000ms
        tick();
        this.time.addEvent({
            delay: 1000,
            callback: tick,
            callbackScope: this,
            repeat: 2 // will run two more times (for 3->2->1) then the final GO is handled in tick
        });
    }
    handleAiHit(opponent, snowball) {
        snowball.destroy();

        // Optional: track AI health and end game when AI dies
        if (!this.aiHealth) this.aiHealth = 1;
        const damage = snowball.radius / 50;
        this.aiHealth = Math.max(0, this.aiHealth - damage);

        if (this.aiHealth <= 0 && !this.gameOver) {
            this.gameOver = true;
            this.endGame(true); // player wins
        }
    }
    setupNetwork() {
        Network.setDataHandler((data) => {
            if (!this.opponent) return;

            switch (data.type) {
                case 'move':
                    this.opponentTargetX = data.x;
                    this.opponentTargetY = data.y;
                    this.updatePlayerAnimation(this.opponent, data.velX, data.velY, data.lastDir);
                    break;
                case 'throw':
                    this.spawnOpponentSnowball(data);
                    break;
                case 'dead':
                    if(!this.gameOver) this.endGame(true);
                    break;
                case 'rematch_request':
                    this.opponentRequestedRematch = true;
                    if (this._playAgainButton) {
                        this._playAgainButton.setStyle({ backgroundColor: '#00aa00' });
                        if (this.localRequestedRematch) {
                            Network.send({ type: 'rematch_accept' });
                            this.resetForRematch();
                        }
                    } else {
                        // if no local UI yet, keep the flag; UI will reflect when created
                    }
                    break;
                case 'rematch_accept':
                    // Opponent accepted -> restart the scene
                    this.resetForRematch();
                    break;
                case 'return_to_menu':
                    this.endGame(false);
                    break;
            }
        });
        Network.setDisconnectHandler(() => {
            this.onOpponentDisconnected();
        });

        // Send our state periodically
        this.time.addEvent({
            delay: 100, // 10 times per second
            callback: () => {
                if (this.gameOver) return;
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
    spawnAiSnowball(x, y, multiplier, velocity) {
        if(this.gameOver || !this.controlsEnabled) return;
        const ball = this.add.image(x, y, 'snowball2').setScale(multiplier);
        ball.radius = (ball.displayWidth || (16 * multiplier)) / 2;
        this.physics.add.existing(ball);
        ball.body.setCollideWorldBounds(true);
        ball.body.onWorldBounds = true;

        // AI is at top and should throw downwards (positive Y)
        const direction = 1;
        ball.body.setVelocity(0, velocity * direction);
        ball.intendedVelocityY = velocity * direction;

        ball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === ball) ball.destroy();
        });

        this.opponentSnowballs.add(ball);
    }


    throwSnowball(power, wrist) {
        if(this.gameOver || !this.controlsEnabled) return;
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
        const ball = this.add.image(x, y, 'snowball1').setScale(multiplier);
        ball.radius = (ball.displayWidth || (16 * multiplier)) / 2;
        this.physics.add.existing(ball);
        ball.body.setCollideWorldBounds(true);
        ball.body.onWorldBounds = true;
        // In multiplayer, host throws up, client throws down
        const direction = (window.isMultiplayer && !window.isHost) ? 1 : -1;
        ball.body.setVelocity(0, velocity * direction);
        ball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === ball) ball.destroy();
        });
        this.mySnowballs.add(ball);
        ball.intendedVelocityY = velocity * direction;
    }

    spawnOpponentSnowball({ x, y, multiplier, velocity }) {
        if(this.gameOver || !this.controlsEnabled) return;
        const ball = this.add.image(x,y,'snowball2').setScale(multiplier); // Different color
        ball.radius = (ball.displayWidth || (16 * multiplier)) / 2;
        this.physics.add.existing(ball);
        ball.body.setCollideWorldBounds(true);
        ball.body.onWorldBounds = true;
        // Invert direction for opponent's throw
        const direction = window.isHost ? 1 : -1;
        ball.intendedVelocityY = velocity * direction;
        ball.body.setVelocity(0, velocity * direction);
        ball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === ball) ball.destroy();
        });
        this.opponentSnowballs.add(ball);
    }

    handlePlayerHit(player, snowball) {
        const damage = snowball.radius / 65; // Damage based on snowball size
        this.health = this.health - damage;
        this.updateHealthBar();
        snowball.destroy(); // Remove the snowball after collision
        if (this.health <= 0 && !this.gameOver) {
            this.gameOver = true;
            if (window.isMultiplayer) {
                Network.send({type: 'dead'});
            }
            this.endGame(false);
        }
    }

    updateHealthBar() {
        this.healthBar.width = this.health * 140;
    }

    updateChargeBar() {
        this.chargeBar.width = this.charge * 80;
    }

    handlePlayerInput() {
        if (!this.controlsEnabled) {
            this.player.body.setVelocity(0);
            return;
        }
        const playerSpeed = 200;
        this.player.body.setVelocity(0);
        if (this.gameOver) {
            this.player.body.setVelocity(0);
            return;
        }
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

        this.charge = Math.max(0, this.charge - 0.001);
        this.updateChargeBar();
        this.opponentSnowballs.getChildren().forEach(ball => {
            if (ball.body) {
                ball.body.setVelocity(0, ball.intendedVelocityY);
            }
        });
        if (this.opponent && window.isMultiplayer) {
            this.opponent.x += (this.opponentTargetX - this.opponent.x) * this.interpolationSpeed;
            this.opponent.y += (this.opponentTargetY - this.opponent.y) * this.interpolationSpeed;
        }
        this.mySnowballs.getChildren().forEach(ball => {
            if (ball.body) {
                ball.body.setVelocity(0, ball.intendedVelocityY);
            }
        });
        if (window.useCamera && this.video && this.video.readyState >= 2) {
            detectThrow(this.video);
            if (this.overlay && this.latest) {
                this.overlay.clear();
                const W = this.cameras.main.width;
                const H = this.cameras.main.height;
                const { wrist, elbow } = this.latest;

                // Mirror X for overlay if the preview is visually flipped
                const wristX = ((this.videoFlipped && wrist) ? (1 - wrist.x) : wrist.x) * W;
                const wristY = wrist.y * H;
                const elbowX = ((this.videoFlipped && elbow) ? (1 - elbow.x) : elbow.x) * W;
                const elbowY = elbow.y * H;

                this.overlay.lineStyle(2, 0xffff00).strokeRect(wristX - 10, wristY - 10, 20, 20);
                this.overlay.lineStyle(2, 0xff00ff).strokeRect(elbowX - 10, elbowY - 10, 20, 20);
            }
        }
        if (this.health < 1) {
            this.health = Math.min(1, this.health + 0.0001); // Regenerate health slowly
            this.updateHealthBar();
        }
        if (this.aiController && this.controlsEnabled && !this.gameOver) {
            const activeSnowballs = this.mySnowballs ? this.mySnowballs.getChildren() : [];
            const time = this.time.now;
            const delta = this.game.loop.delta;
            this.aiController.update(time, delta, activeSnowballs);
            this.updatePlayerAnimation(
                this.opponent,
                this.opponent.body.velocity.x,
                this.opponent.body.velocity.y,
                this.opponent.lastDir
            );
        }
    }
    endGame(isWinner) {
        if (this._ended) return;
        this._ended = true;
        this.gameOver = true;

        // Record who won so rematch / next-level logic can use it later
        this._lastWinner = isWinner;

        if (this.networkMoveEvent) {
            this.networkMoveEvent.remove(false);
            this.networkMoveEvent = null;
        }


        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        // Reset velocity of both players to 0
        if (this.player && this.player.body) this.player.body.setVelocity(0);
        if (this.opponent && this.opponent.body) this.opponent.body.setVelocity(0);

        // Dim background
        const overlay = this.add.graphics({ depth: 1001 });
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, W, H);

        const txt = isWinner ? 'You Win' : 'You Lose';
        this.add.text(W / 2, H / 2 - 60, txt, {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(1002);

        let playText = 'Play Again';
        if (!window.isMultiplayer) {
            if (isWinner) playText = 'Next Level';
            else playText = 'Retry Level';
        }

        // Play Again button
        const playAgain = this.add.text(W / 2, H / 2 + 20, playText, {
            fontFamily: 'Arial', fontSize: '28px', color: '#00ff00',
            backgroundColor: '#222222'
        }).setOrigin(0.5).setDepth(1002).setPadding(10).setInteractive({ useHandCursor: true });

        // Back to Menu button
        const backBtn = this.add.text(W / 2, H / 2 + 70, 'Back to Menu', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#333333'
        }).setOrigin(0.5).setDepth(1002).setPadding(8).setInteractive({ useHandCursor: true });
        playAgain.on('pointerup', () => {
            if (this.localRequestedRematch) return;
            this.localRequestedRematch = true;

            if (window.isMultiplayer) {
                Network.send({ type: 'rematch_request' });

                // If opponent already requested, accept immediately
                if (this.opponentRequestedRematch) {
                    Network.send({ type: 'rematch_accept' });
                    this.resetForRematch();
                    return;
                }

                playAgain.setText('Waiting for opponent...');
                playAgain.disableInteractive();
                playAgain.setStyle({ backgroundColor: '#444444' });
            } else {
                // single player: restart immediately
                let nextLevel;
                if (this._lastWinner) {
                    // advance up to max 10; when at max wrap to 1
                    nextLevel = this.level + 1;
                } else {
                    // retry same level (or reset to 1 if desired)
                    nextLevel = this.level;
                }
                // restart scene with updated level and a short countdown
                this.scene.restart({ startCountdown: true, level: nextLevel });
            }
        });

        backBtn.on('pointerdown', () => {
            if (window.isMultiplayer) {
                Network.send({ type: 'return_to_menu' });
            }
            // change this to your menu scene key if different
            this.scene.start('TitleScene');
        });

        // store references if needed
        this._playAgainButton = playAgain;
        this._backButton = backBtn;

        // If opponent had already requested before UI created, reflect it
        if (this.opponentRequestedRematch && this._playAgainButton) {
            this._playAgainButton.setStyle({ backgroundColor: '#00aa00' });
        }
    }

    resetForRematch() {
        // Remove any overlay UI created for end screen / rematch
        if (this._playAgainButton) this._playAgainButton.destroy();
        if (this._backButton) this._backButton.destroy();
        if (this._rematchOfferUI) {
            this._rematchOfferUI.offerTxt.destroy();
            this._rematchOfferUI.acceptBtn.destroy();
        }
        this.gameOver = false;
        this.localRequestedRematch = false;
        this.opponentRequestedRematch = false;
        this._ended = false;

        // restart the scene - keeps the same network connection
        this.scene.restart();
    }

    onOpponentDisconnected() {
        // If game hasn't ended, present an end state indicating disconnect
        if (!this._ended) {
            this.endGame(true);
        }
        // Update the end UI to indicate opponent left (if play again button was waiting)
        if (this._playAgainButton) {
            this._playAgainButton.setText('Play Again (opponent disconnected)');
            this._playAgainButton.setInteractive(); // allow local restart even if disconnected
            // Clicking will restart locally (no opponent)
            this._playAgainButton.off('pointerup');
            this._playAgainButton.on('pointerup', () => this.resetForRematch());
        }
    }

}
