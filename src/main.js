// Minimal Phaser 3 scene that displays text and toggles color on pointerdown
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#2d2d2d',
  parent: 'game-container',
  scene: {
    preload() {
      // no assets needed for this minimal example
    },
    create() {
      const style = { font: '28px Arial', fill: '#ffffff' };
      this.label = this.add.text(400, 300, 'Click or tap anywhere', style).setOrigin(0.5);
      this.colorToggle = false;

      this.input.on('pointerdown', () => {
        this.colorToggle = !this.colorToggle;
        this.label.setText(this.colorToggle ? 'Thanks! Tap again.' : 'Click or tap anywhere');
        this.label.setFill(this.colorToggle ? '#ffcc00' : '#ffffff');
      });
    },
    update() {
      // simple subtle pulse effect
      if (this.label) {
        const scale = 1 + 0.02 * Math.sin(this.time.now / 200);
        this.label.setScale(scale);
      }
    }
  }
};

new Phaser.Game(config);
