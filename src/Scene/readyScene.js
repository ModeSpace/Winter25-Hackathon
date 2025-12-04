import { Network } from '../network.js';

export default class ReadyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ReadyScene' });
    }

    preload() {
        this.load.image('check', 'Assests/menu_buttons/check.png');
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        this.localReady = false;
        this.opponentReady = !window.isMultiplayer;

        this.add.graphics().fillStyle(0x000000, 0.8).fillRect(0, 0, W, H);

        if (window.useCamera) {
            this.add.text(W / 2, 100, 'Show your hand to get ready!', {
                fontFamily: 'Arial', fontSize: '32px', color: '#ffffff'
            }).setOrigin(0.5);
            this.initCameraAndHandTracking();
        } else {
            this.add.text(W / 2, 100, 'Flick with your mouse to get ready!', {
                fontFamily: 'Arial', fontSize: '32px', color: '#ffffff'
            }).setOrigin(0.5);

            const promptY = 250;
            this.add.rectangle(W / 2, promptY, 300, 150, 0x333333, 0.6).setStrokeStyle(3, 0xffffff);
            this.add.text(W / 2, promptY, 'Flick Here', {
                fontFamily: 'Arial', fontSize: '28px', color: '#ffffff'
            }).setOrigin(0.5);

            this.initMouseFlickTracking();
        }

        const p1Text = this.add.text(W / 2 - 80, 420, 'P1 (You)', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
        const p2Text = this.add.text(W / 2 + 80, 420, 'P2', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
        this.p1Check = this.add.image(p1Text.x, p1Text.y + 60, 'check').setScale(0.1).setVisible(false);
        this.p2Check = this.add.image(p2Text.x, p2Text.y + 60, 'check').setScale(0.1).setVisible(false);

        if (window.isMultiplayer) {
            this.setupNetwork();
        }
    }

    initMouseFlickTracking() {
        const W = this.cameras.main.width;


        let count = 3;
        this.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: () => {
                count--;
                if (count <= 0) {
                    this.localReady = true;
                    this.p1Check.setVisible(true);
                    if (window.isMultiplayer) {
                        Network.send({ type: 'ready_status', isReady: true });
                    }
                    this.checkAllReady();
                }
            }
        });
    }

    initCameraAndHandTracking() {
        this.video = document.getElementById('webcam');
        const gameContainer = document.getElementById('game-container');
        const containerRect = gameContainer.getBoundingClientRect();

        const videoWidth = 320;
        const videoHeight = 240;
        const videoTop = containerRect.top + 150;
        const videoLeft = containerRect.left + (800 - videoWidth) / 2;
        Object.assign(this.video.style, {
            display: 'block',
            position: 'fixed',
            width: `${videoWidth}px`,
            height: `${videoHeight}px`,
            top: `${videoTop}px`,
            left: `${videoLeft}px`,
            border: '3px solid #fff',
            borderRadius: '8px',
            objectFit: 'cover',
            zIndex: 100
        });
        this.videoFlipped = false;
        this.overlay = this.add.graphics({ depth: 1000 });

        import('../handTracker.js').then(({ createHandLandmarker, detectThrow, setOnLandmarks }) => {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
                .then((stream) => {
                    this.video.srcObject = stream;
                    this.video.play();
                    const track = stream.getVideoTracks()[0];
                    const settings = track.getSettings ? track.getSettings() : {};
                    if (settings.facingMode === 'user' || settings.facingMode === undefined) {
                        this.video.style.transform = 'scaleX(-1)';
                        this.videoFlipped = true;
                    }
                }).catch((err) => console.error('Webcam error:', err));

            createHandLandmarker().catch(e => console.warn('HandLandmarker init failed', e));

            setOnLandmarks((data) => {
                this.overlay.clear();
                const isReady = !!data;
                if (isReady) {
                    const { wrist } = data;
                    const w = 320, h = 240;
                    const handX = (this.videoFlipped ? (1 - wrist.x) : wrist.x) * w;
                    const handY = wrist.y * h;
                    const videoLeft = (this.cameras.main.width - w) / 2;
                    const videoTop = 150;
                    this.overlay.lineStyle(4, 0x00ff00, 1);
                    this.overlay.strokeRect(videoLeft + handX - 30, videoTop + handY - 30, 60, 60);
                }
                if (isReady !== this.localReady) {
                    this.localReady = isReady;
                    this.p1Check.setVisible(this.localReady);
                    if (window.isMultiplayer) {
                        Network.send({ type: 'ready_status', isReady: this.localReady });
                    }
                    this.checkAllReady();
                }
            });

            this.handTracker = { detectThrow };
        });
    }

    setupNetwork() {
        Network.setDataHandler((data) => {
            if (data.type === 'ready_status') {
                this.opponentReady = data.isReady;
                this.p2Check.setVisible(this.opponentReady);
                this.checkAllReady();
            }
        });
    }

    checkAllReady() {
        if (this.localReady && this.opponentReady) {
            this.time.delayedCall(1000, () => {
                if (this.video) this.video.style.display = 'none';
                if (this.mouseTracker) this.mouseTracker.destroy();
                this.scene.start('GameScene', { startCountdown: true });
            });
        }
    }

    update() {
        if (window.useCamera && this.video && this.video.readyState >= 2 && this.handTracker) {
            this.handTracker.detectThrow(this.video);
        }
    }
}