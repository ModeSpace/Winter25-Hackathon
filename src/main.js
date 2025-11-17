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
            // Create a small square
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1);
            graphics.fillRect(0, 0, 50, 50);
            graphics.x = this.cameras.main.width / 2 - 25;
            graphics.y = this.cameras.main.height / 2 - 25;
            this.cursors = this.input.keyboard.createCursorKeys();
            this.square = graphics;

            // Create a second square
            const graphics2 = this.add.graphics();
            graphics2.fillStyle(0xff0000, 1);
            graphics2.fillRect(0, 0, 50, 50);
            graphics2.x = this.cameras.main.width / 4 - 25;
            graphics2.y = this.cameras.main.height / 4 - 25;
            this.square2 = graphics2;

            // Add WASD keys explicitly (createCursorKeys does not provide them)
            this.wasd = this.input.keyboard.addKeys({
                w: Phaser.Input.Keyboard.KeyCodes.W,
                a: Phaser.Input.Keyboard.KeyCodes.A,
                s: Phaser.Input.Keyboard.KeyCodes.S,
                d: Phaser.Input.Keyboard.KeyCodes.D
            });
            //Add
        },
        update() {
            // Continuous movement while holding the keys
            if (this.cursors.left.isDown) {
                this.square.x -= 5;
                if(this.square.x < 0) {
                    this.square.x = 0;
                }
            }
            if (this.cursors.right.isDown) {
                this.square.x += 5;
                if(this.square.x > this.cameras.main.width - 50) {
                    this.square.x = this.cameras.main.width - 50;
                }
            }
            if(this.cursors.up.isDown) {
                this.square.y -= 5;
                if(this.square.y < 0) {
                    this.square.y = 0;
                }
            }
            if(this.cursors.down.isDown) {
                this.square.y += 5;
                if(this.square.y > this.cameras.main.height - 50) {
                    this.square.y = this.cameras.main.height - 50;
                }
            }

            // Use the explicit WASD keys
            if(this.wasd.w.isDown){
                this.square2.y -=5;
                if(this.square2.y < 0) {
                    this.square2.y = 0;
                }
            }
            if(this.wasd.s.isDown){
                this.square2.y +=5;
                if(this.square2.y > this.cameras.main.height - 50) {
                    this.square2.y = this.cameras.main.height - 50;
                }
            }
            if(this.wasd.a.isDown){
                this.square2.x -=5;
                if(this.square2.x < 0) {
                    this.square2.x = 0;
                }
            }
            if(this.wasd.d.isDown){
                this.square2.x +=5;
                if(this.square2.x > this.cameras.main.width - 50) {
                    this.square2.x = this.cameras.main.width - 50;
                }
            }
        }
    }
};

new Phaser.Game(config);