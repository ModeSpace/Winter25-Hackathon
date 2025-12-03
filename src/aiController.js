export class AiController {
    constructor(scene, aiSprite, humanSprite, bounds = null, level) {
        this.scene = scene;
        this.me = aiSprite;
        this.target = humanSprite;
        this.snowballs = [];

        if (bounds) {
            this.minX = bounds.minX;
            this.maxX = bounds.maxX;
            this.minY = bounds.minY || 20;
            this.maxY = bounds.maxY || scene.scale.height / 2 - 20;
        } else {
            const pad = 20;
            this.minX = pad;
            this.maxX = scene.scale.width - pad;
            this.minY = pad;
            this.maxY = scene.scale.height / 2 - pad;
        }

        this.nextThinkTime = 0;
        this.nextThrowTime = 0;
        this.currentMoveDir = { x: 0, y: 0 }; // 2D movement
        this.charge = 0;
        this.isCharging = false;
        this.chargeStartTime = 0;

        this.setDifficulty(level);
    }

    setDifficulty(level) {
        this.level = level;
        switch (level) {
            case 1: // Baby: Barely moves, terrible aim, forgets to shoot
                this.reactionSpeed = 2000;
                this.moveSpeed = 50;
                this.aimError = 300;
                this.throwCooldownRange = [4000, 6000];
                this.dodgeDistance = 40;
                this.chargeTime = [1200, 1800]; // slow, long charge (ms)
                break;

            case 2: // Toddler: Slow, very inaccurate
                this.reactionSpeed = 1500;
                this.moveSpeed = 80;
                this.aimError = 200;
                this.throwCooldownRange = [3000, 5000];
                this.dodgeDistance = 80;
                this.chargeTime = [1000, 1600];
                break;

            case 3: // Beginner (Old Easy): Predictable
                this.reactionSpeed = 1000;
                this.moveSpeed = 100;
                this.aimError = 150;
                this.throwCooldownRange = [2000, 3500];
                this.dodgeDistance = 100;
                this.chargeTime = [900, 1400];
                break;

            case 4: // Novice: Starting to try
                this.reactionSpeed = 800;
                this.moveSpeed = 140;
                this.aimError = 100;
                this.throwCooldownRange = [1500, 3000];
                this.dodgeDistance = 180;
                this.chargeTime = [700, 1100];
                break;

            case 5: // Intermediate (Old Medium): Standard opponent
                this.reactionSpeed = 500;
                this.moveSpeed = 180;
                this.aimError = 60;
                this.throwCooldownRange = [1000, 2000];
                this.dodgeDistance = 250;
                this.chargeTime = [600, 1000];
                break;

            case 6: // Advanced: Competent, reacts decently
                this.reactionSpeed = 400;
                this.moveSpeed = 220;
                this.aimError = 40;
                this.throwCooldownRange = [800, 1800];
                this.dodgeDistance = 300;
                this.chargeTime = [500, 900];
                break;

            case 7: // Pro (Old Hard): Aggressive
                this.reactionSpeed = 300;
                this.moveSpeed = 260;
                this.aimError = 25;
                this.throwCooldownRange = [600, 1400];
                this.dodgeDistance = 350;
                this.chargeTime = [400, 800];
                break;

            case 8: // Elite: Very fast, precise
                this.reactionSpeed = 200;
                this.moveSpeed = 300;
                this.aimError = 15;
                this.throwCooldownRange = [500, 1000];
                this.dodgeDistance = 450;
                this.chargeTime = [300, 700];
                break;

            case 9: // God Mode: Almost perfect
                this.reactionSpeed = 100;
                this.moveSpeed = 350;
                this.aimError = 5;
                this.throwCooldownRange = [300, 700];
                this.dodgeDistance = 600;
                this.chargeTime = [200, 500];
                break;

            case 10: // Impossible: Machine-like perfection
                this.reactionSpeed = 50; // Instantly reacts
                this.moveSpeed = 450; // Faster than player
                this.aimError = 0; // Perfect aim
                this.throwCooldownRange = [100, 400]; // Machine gun
                this.dodgeDistance = 1000; // Sees entire screen
                this.chargeTime = [80, 250];
                break;

            default:
                console.warn("Unknown difficulty level, defaulting to Medium (5)");
                this.setDifficulty(5);
                break;
        }
    }

    update(time, delta, activeSnowballs) {
        this.snowballs = activeSnowballs;

        // Handle charging
        if (this.isCharging) {
            const chargeElapsed = time - this.chargeStartTime;
            this.charge = Math.min(chargeElapsed / 1000, 1); // max 1 second charge

            if (chargeElapsed >= this.targetChargeTime) {
                // Release the shot
                this.attemptThrow(time, true);
                this.isCharging = false;
                this.charge = 0;
            }
            // Continue moving while charging
            this.applyMovement();
            return;
        }

        if (time < this.nextThinkTime) {
            this.applyMovement();
            return;
        }

        this.nextThinkTime = time + this.reactionSpeed;

        const threat = this.detectThreat();

        if (threat) {
            // Dodge in 2D
            const dx = threat.x - this.me.x;
            const dy = threat.y - this.me.y;

            // Move away from threat
            this.currentMoveDir.x = dx < 0 ? 1 : -1;

            // Also dodge vertically if threat is close
            if (Math.abs(dy) < 100) {
                this.currentMoveDir.y = dy < 0 ? 1 : -1;
            } else {
                this.currentMoveDir.y = 0;
            }
        } else {
            // Positioning: align with player but add human-like variation
            const idealX = this.target.x;
            const thresholdX = 30;
            const thresholdY = 20;

            // Horizontal positioning
            if (this.me.x < idealX - thresholdX) {
                this.currentMoveDir.x = 1;
            } else if (this.me.x > idealX + thresholdX) {
                this.currentMoveDir.x = -1;
            } else {
                this.currentMoveDir.x = 0;
            }

            // Vertical movement: stay in upper area but vary position
            const centerY = (this.minY + this.maxY) / 2;
            if (this.me.y < centerY - thresholdY) {
                this.currentMoveDir.y = Math.random() < 0.3 ? 1 : 0;
            } else if (this.me.y > centerY + thresholdY) {
                this.currentMoveDir.y = Math.random() < 0.3 ? -1 : 0;
            } else {
                // Random vertical drift
                if (Math.random() < 0.15) {
                    this.currentMoveDir.y = Math.random() > 0.5 ? 1 : -1;
                }
            }

            // Random horizontal strafe when idle
            if (this.currentMoveDir.x === 0 && Math.random() < 0.2) {
                this.currentMoveDir.x = Math.random() > 0.5 ? 1 : -1;
            }
        }

        // Check if should throw
        if (time > this.nextThrowTime && !this.isCharging) {
            // Start charging
            this.isCharging = true;
            this.chargeStartTime = time;
            this.targetChargeTime = Math.random() * (this.chargeTime[1] - this.chargeTime[0]) + this.chargeTime[0];
        }

        this.applyMovement();
    }

    applyMovement() {
        let vx = this.currentMoveDir.x * this.moveSpeed;
        let vy = this.currentMoveDir.y * this.moveSpeed;

        // Clamp horizontal
        if (this.currentMoveDir.x < 0 && this.me.x <= this.minX + 1) {
            vx = 0;
            this.me.setX(this.minX);
        } else if (this.currentMoveDir.x > 0 && this.me.x >= this.maxX - 1) {
            vx = 0;
            this.me.setX(this.maxX);
        }

        // Clamp vertical
        if (this.currentMoveDir.y < 0 && this.me.y <= this.minY + 1) {
            vy = 0;
            this.me.setY(this.minY);
        } else if (this.currentMoveDir.y > 0 && this.me.y >= this.maxY - 1) {
            vy = 0;
            this.me.setY(this.maxY);
        }

        this.me.body.setVelocity(vx, vy);

        // Safety clamps
        if (this.me.x < this.minX) this.me.setX(this.minX);
        if (this.me.x > this.maxX) this.me.setX(this.maxX);
        if (this.me.y < this.minY) this.me.setY(this.minY);
        if (this.me.y > this.maxY) this.me.setY(this.maxY);
    }

    detectThreat() {
        let closestThreat = null;
        let closestDist = Infinity;

        this.snowballs.forEach(ball => {
            const isComingAtMe = ball.body.velocity.y < 0;
            const distY = Math.abs(ball.y - this.me.y);
            const distX = Math.abs(ball.x - this.me.x);
            const totalDist = Math.sqrt(distX * distX + distY * distY);
            const isInLane = distX < 80;

            if (isComingAtMe && totalDist < this.dodgeDistance && ball.y < this.me.y && isInLane) {
                if (totalDist < closestDist) {
                    closestDist = totalDist;
                    closestThreat = ball;
                }
            }
        });

        return closestThreat;
    }

    attemptThrow(time, fromCharge = false) {
        const delay = Math.random() * (this.throwCooldownRange[1] - this.throwCooldownRange[0]) + this.throwCooldownRange[0];
        this.nextThrowTime = time + delay;

        const errorOffset = (Math.random() * this.aimError * 2) - this.aimError;
        const targetX = this.target.x + errorOffset;
        const targetY = this.target.y;

        if (this.onShootRequest) {
            this.onShootRequest(targetX, targetY, fromCharge ? this.charge : 0);
        }
    }
}