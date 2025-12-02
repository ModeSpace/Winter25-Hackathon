import GameScene from './Scene/gameScene.js';
import TitleScene from "./Scene/titleScene.js";
import SettingsScene from "./Scene/settingsScene.js";
import ReadyScene from "./Scene/readyScene.js";

const config = {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    physics: {
        default: 'arcade'
    },
    scene: [ TitleScene, GameScene, SettingsScene, ReadyScene ]
};

new Phaser.Game(config);