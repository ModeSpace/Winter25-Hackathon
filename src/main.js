const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    physics: {
        default: 'arcade',
    },
    scene: {
        preload() {
            // no assets needed
        },
        create() {
            const W = this.cameras.main.width;
            const H = this.cameras.main.height;
            const SIZE = 50;

            // Player 1: use a rectangle GameObject with origin 0 so body aligns
            const startX = W / 2 - SIZE / 2;
            const startY = H / 2 - SIZE / 2;
            this.square = this.add.rectangle(startX, startY, SIZE, SIZE, 0xffffff).setOrigin(0);
            this.physics.add.existing(this.square); // adds an Arcade Body
            this.square.body.setCollideWorldBounds(true);
            this.square.body.setSize(SIZE, SIZE);

            // Player 2
            const startX2 = W / 4 - SIZE / 2;
            const startY2 = H / 4 - SIZE / 2;
            this.square2 = this.add.rectangle(startX2, startY2, SIZE, SIZE, 0xff0000).setOrigin(0);
            this.physics.add.existing(this.square2);
            this.square2.body.setCollideWorldBounds(true);
            this.square2.body.setSize(SIZE, SIZE);

            // Inputs
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys({
                w: Phaser.Input.Keyboard.KeyCodes.W,
                a: Phaser.Input.Keyboard.KeyCodes.A,
                s: Phaser.Input.Keyboard.KeyCodes.S,
                d: Phaser.Input.Keyboard.KeyCodes.D
            });

            // Collider between physics bodies
            this.physics.add.collider(this.square, this.square2);
        },
        update() {
            const speed = 200;

            this.square.body.setVelocity(0);
            this.square2.body.setVelocity(0);

            if (this.cursors.left.isDown)  this.square.body.setVelocityX(-speed);
            if (this.cursors.right.isDown) this.square.body.setVelocityX(speed);
            if (this.cursors.up.isDown)    this.square.body.setVelocityY(-speed);
            if (this.cursors.down.isDown)  this.square.body.setVelocityY(speed);

            if (this.wasd.a.isDown) this.square2.body.setVelocityX(-speed);
            if (this.wasd.d.isDown) this.square2.body.setVelocityX(speed);
            if (this.wasd.w.isDown) this.square2.body.setVelocityY(-speed);
            if (this.wasd.s.isDown) this.square2.body.setVelocityY(speed);
        }
    }
};

new Phaser.Game(config);