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
        this.reactionSpeed = 500 / level;
        this.moveSpeed = Math.min(100 + (level * 30), 350);
        this.aimError = Math.max(150 - (level * 15), 0);
        this.throwCooldownRange = [Math.max(2000 - (level * 150), 0), Math.max(4000 - (level * 200), 0)];
        this.dodgeDistance = 100 + (level * 50);
        this.chargeTime = [800 - (level * 50), 1500 - (level * 100)];
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