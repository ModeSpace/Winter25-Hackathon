// File: `src/Scene/settingsScene.js`
export default class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        // Settings title
        this.add.text(W / 2, H / 2 - 100, 'Settings', {
            font: '48px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Toggle button for controls
        if (window.useCamera === undefined) window.useCamera = true;
        const toggleText = window.useCamera ? 'Controls: Camera' : 'Controls: Mouse';
        const toggleButton = this.add.text(W / 2, H / 2, toggleText, {
            font: '32px Arial',
            fill: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        toggleButton.on('pointerdown', () => {
            window.useCamera = !window.useCamera;
            toggleButton.setText(window.useCamera ? 'Controls: Camera' : 'Controls: Mouse');
        });

        // Back button
        const backButton = this.add.text(W / 2, H / 2 + 100, 'Back', {
            font: '36px Arial',
            fill: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 20, y: 10 },
            border: '2px solid #000000'
        }).setOrigin(0.5).setInteractive();

        backButton.on('pointerover', () => {
            backButton.setStyle({ fill: '#ff0000' });
        });
        backButton.on('pointerout', () => {
            backButton.setStyle({ fill: '#000000' });
        });
        backButton.on('pointerdown', () => {
            this.scene.start('TitleScene');
        });
    }
}