import { Network } from '../network.js';

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        if(window.useCamera === undefined) window.useCamera = true;

        this.add.text(W / 2, 100, 'Snowball Thrower', { font: '48px Arial', fill: '#ffffff' }).setOrigin(0.5);

        // --- SINGLE PLAYER ---
        const playBtn = this.createBtn(W / 2, 200, 'Single Player', () => {
            window.isMultiplayer = false;
            this.scene.start('GameScene');
        });

        // --- HOST GAME ---
        const hostBtn = this.createBtn(W / 2, 280, 'Host Game', () => {
            this.add.text(W/2, 340, "Generating ID...", { font: '20px Arial', fill: '#ffff00' }).setOrigin(0.5);

            Network.hostGame((id) => {
                // When we get an ID, show it and wait
                this.add.text(W/2, 340, `Your Room ID: ${id}`, { font: '24px Arial', fill: '#00ff00', backgroundColor: '#000' }).setOrigin(0.5);
                this.add.text(W/2, 380, "Share this ID with a friend & wait...", { font: '16px Arial', fill: '#ccc' }).setOrigin(0.5);

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
        const joinBtn = this.createBtn(W / 2, 450, 'Join Game', () => {
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
        const settingsBtn = this.createBtn(W / 2, 520, 'Settings', () => {
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