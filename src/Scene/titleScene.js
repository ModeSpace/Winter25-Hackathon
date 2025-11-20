export default class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        // Title text
        this.add.text(W / 2, H / 2 - 100, 'Snowball Thrower', {
            font: '48px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);
        if (window.useCamera === undefined){ window.useCamera = true; }
        // Play button and a border and hover effect and a white background
        const playButton = this.add.text(W / 2, H / 2 + 50, 'Play', {
            font: '36px Arial',
            fill: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 20, y: 10 },
            border: '2px solid #000000'
        }).setOrigin(0.5).setInteractive();

        const settingsButton = this.add.text(W / 2, H / 2 + 120, 'Settings', {
            font: '36px Arial',
            fill: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 20, y: 10 },
            border: '2px solid #000000'
        }).setOrigin(0.5).setInteractive();

        settingsButton.on('pointerover', () => {
            settingsButton.setStyle({ fill: '#ff0000' });
        });
        settingsButton.on('pointerout', () => {
            settingsButton.setStyle({ fill: '#000000' });
        });

        settingsButton.on('pointerdown', () => {
            this.scene.start('SettingsScene');
        });

        playButton.on('pointerover', () => {
            playButton.setStyle({ fill: '#ff0000' });
        });
        playButton.on('pointerout', () => {
            playButton.setStyle({ fill: '#000000' });
        });

        playButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}