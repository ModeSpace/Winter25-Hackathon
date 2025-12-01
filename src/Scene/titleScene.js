import { Network } from '../network.js';

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }
    preload() {
        this.load.image('titleBg', 'Assests/background/Title_back.png');
        this.load.image('settingsIcon', 'Assests/menu_buttons/setting-button.png');
        this.load.image('playIcon', 'Assests/menu_buttons/start-button.png');
        this.load.image('hostIcon', 'Assests/menu_buttons/host-button.png');
        this.load.image('joinIcon', 'Assests/menu_buttons/join-button.png');
    }
    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        if(window.useCamera === undefined) window.useCamera = true;

        this.add.text(W / 2, 100, 'Snowball Thrower', { font: '48px Arial', fill: '#ffffff' }).setOrigin(0.5);
        
-       this.add.image(W, H, 'titleBg').setOrigin(0, 0);
        this.add.image(0, 0, 'titleBg').setOrigin(0, 0);

        // box behind the buttons
        const graphics = this.add.graphics();
        graphics.fillStyle(0x65ebeb, 0.95);
        graphics.fillRoundedRect(W / 2 - 390, 130 - 125, 250, 365);
        // border
        graphics.lineStyle(4, 0x005e5e, 1);
        graphics.strokeRoundedRect(W / 2 - 390, 130 - 125, 250, 365);

        // --- SINGLE PLAYER ---
        const playBtn = this.add.image(W / 2 - 260, 200 - 140, 'playIcon').setInteractive();
        playBtn.setScale(3);
        playBtn.on('pointerover', () => playBtn.setTint(0xff0000));
        playBtn.on('pointerout', () => playBtn.clearTint());
        playBtn.on('pointerdown',
            () => {
            window.isMultiplayer = false;
            this.scene.start('GameScene');
        });

        // --- HOST GAME ---
        const hostBtn = this.add.image(W / 2 - 260, 320 - 140, 'hostIcon').setInteractive();
        hostBtn.setScale(3);
        hostBtn.on('pointerover', () => hostBtn.setTint(0xff0000));
        hostBtn.on('pointerout', () => hostBtn.clearTint());
        hostBtn.on('pointerdown',
            () => {
            this.add.text(W/2 - 260, 380 - 140, "Generating ID...", { font: '20px Arial', fill: '#ffff00' }).setOrigin(0.5);

            Network.hostGame((id) => {
                // When we get an ID, show it and wait
                this.add.text(W/2 - 265, 380 - 140, `Your Room ID: ${id}`, { font: '24px Arial', fill: '#00ff00', backgroundColor: '#000' }).setOrigin(0.5);
                this.add.text(W/2 - 260, 400 - 140, "Share this ID with a friend & wait...", { font: '16px Arial', fill: '#000000ff' }).setOrigin(0.5);

                // Start game automatically when someone connects
                Network.setDataHandler(() => {
                    // If we receive any data, it means they connected.
                    // Or we can rely on the 'connection' event in network.js,
                    // but usually the joiner sends a "hello" message.
                });

                // Poll for connection status (simple hack)
                this.time.addEvent({ delay: 500, loop: true, callback: () => {
                        if(Network.isConnected()) {
                            window.isMultiplayer = true;
                            window.isHost = true; // We are player 1
                            this.scene.start('GameScene');
                        }
                    }});
            });
        });

        // --- JOIN GAME ---
        const joinBtn = this.add.image(W / 2 - 260, 460 - 140, 'joinIcon').setInteractive();
        joinBtn.setScale(3);
        joinBtn.on('pointerover', () => joinBtn.setTint(0xff0000));
        joinBtn.on('pointerout', () => joinBtn.clearTint());
        joinBtn.on('pointerdown',
            () => {
            // Simple prompt to get ID (browser built-in)
            const hostId = prompt("Enter the Room ID from your friend:");
            if(hostId) {
                Network.joinGame(hostId, () => {
                    window.isMultiplayer = true;
                    window.isHost = false; // We are player 2
                    this.scene.start('GameScene');
                });
            }
        });

        // --- SETTINGS ---
        const settingsBtn = this.add.image(W - 70, 50, 'settingsIcon').setInteractive();
        settingsBtn.setScale(2);
        settingsBtn.on('pointerover', () => settingsBtn.setTint(0xff0000));
        settingsBtn.on('pointerout', () => settingsBtn.clearTint());
        settingsBtn.on('pointerdown',
            () => {
            this.scene.start('SettingsScene');
        });
    }

    createBtn(x, y, text, callback) {
        const btn = this.add.text(x, y, text, {
            font: '32px Arial',
            fill: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 20, y: 10 },
            border: '2px solid #000'
        }).setOrigin(0.5).setInteractive();

        btn.on('pointerover', () => btn.setStyle({ fill: '#ff0000' }));
        btn.on('pointerout', () => btn.setStyle({ fill: '#000000' }));
        btn.on('pointerdown', callback);
        return btn;
    }
}