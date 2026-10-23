/**
 * Neon Stickman Parkour - Pro Engine v2.0
 * Features: Touch Controls with Double Tap Jump, Lasers, Micro Spikes, Sawblades.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let currentLevel = 0;
let coinsCollected = 0;
let gameWon = false;
let lastTime = 0;
let screenShake = 0;
let gameTime = 0;

const keys = {};
const particles = [];

// --- PHYSICS CONFIG ---
const PHYSICS = {
    gravity: 0.58,
    friction: 0.82,
    maxSpeed: 6.5,
    acceleration: 0.85,
    jumpForce: -11.8,
    wallSlideSpeed: 1.8,
    dashSpeed: 16
};

// --- PLAYER OBJECT ---
const player = {
    x: 50, y: 300, width: 20, height: 44,
    vx: 0, vy: 0,
    grounded: false, doubleJump: true,
    isWallSliding: false, wallDir: 0, facing: 1,
    isDashing: false, dashTimer: 0, dashCooldown: 0,
    animFrame: 0, scaleX: 1, scaleY: 1,
    trail: []
};

// --- CAMERA LERP ---
const camera = { x: 0, y: 0, lerp: 0.08 };

// --- PARTICLE SYSTEM ---
class Particle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

function createBurst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1;
        particles.push(new Particle(
            x, y,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            color, Math.random() * 4 + 2, 25
        ));
    }
}

// --- PROCEDURAL 20 LEVELS WITH LASERS & TRAPS ---
function generateLevels() {
    const generated = [];
    const colors = ['#00f3ff', '#ff007f', '#00ff88', '#ffea00', '#a855f7', '#ff5722'];

    for (let i = 0; i < 20; i++) {
        const theme = colors[i % colors.length];
        const lvl = {
            start: { x: 60, y: 300 },
            platforms: [{ x: 0, y: 380, width: 180, height: 100, color: theme }],
            microSpikes: [],
            lasers: [],
            saws: [],
            bouncePads: [],
            coins: [],
            goal: { x: 0, y: 0, width: 35, height: 60 }
        };

        let currX = 220;
        let currY = 320;
        const count = 5 + Math.floor(i / 2);

        for (let j = 0; j < count; j++) {
            const w = Math.max(60, 130 - (i * 3) - Math.random() * 20);
            const h = (j % 2 === 1 && i > 3 && Math.random() > 0.4) ? 200 : 20;
            const gap = 85 + (i * 3.5) + Math.random() * 25;
            
            currY = Math.max(140, Math.min(360, currY + (Math.random() * 120 - 60)));
            lvl.platforms.push({ x: currX, y: currY, width: w, height: h, color: theme });

            if (i > 0 && Math.random() < 0.4 + (i * 0.02) && h === 20) {
                const spikeCount = Math.floor(w / 12);
                for (let k = 0; k < Math.min(4, spikeCount); k++) {
                    lvl.microSpikes.push({
                        x: currX + (k * 10) + 10,
                        y: currY - 8,
                        width: 8, height: 8
                    });
                }
            }

            if (i > 1 && Math.random() < 0.35 + (i * 0.02)) {
                lvl.lasers.push({
                    x: currX + w + (gap / 2),
                    y1: currY - 120,
                    y2: currY + 60,
                    moving: Math.random() > 0.5,
                    offset: Math.random() * 100
                });
            }

            if (i > 3 && Math.random() < 0.3) {
                lvl.saws.push({
                    x: currX + w + (gap / 2),
                    y: currY - 30,
                    radius: 16,
                    angle: 0
                });
            }

            if (Math.random() < 0.25) {
                lvl.bouncePads.push({
                    x: currX + (w / 2) - 12,
                    y: currY - 6,
                    width: 24, height: 6
                });
            }

            if (Math.random() > 0.3) {
                lvl.coins.push({ x: currX + (w / 2) - 8, y: currY - 32, collected: false });
            }

            currX += w + gap;
        }

        lvl.platforms.push({ x: currX, y: currY, width: 160, height: 200, color: theme });
        lvl.goal.x = currX + 60;
        lvl.goal.y = currY - 60;
        generated.push(lvl);
    }
    return generated;
}

const levels = generateLevels();

// --- CONTROLS ---
window.addEventListener('keydown', e => {
    if (e.code === 'KeyR') die();
    if ((e.key === 'Shift' || e.code === 'ShiftLeft') && player.dashCooldown === 0 && !player.isDashing) {
        triggerDash();
    }
    if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'ArrowUp') {
        if (!keys[e.code]) {
            triggerJump();
        }
    }
    keys[e.code] = true;
});

window.addEventListener('keyup', e => keys[e.code] = false);

// Touch UI Event Listeners
function setupTouchButton(id, keyCode, actionFn) {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[keyCode] = true;
        if (actionFn) actionFn();
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[keyCode] = false;
    });
    btn.addEventListener('mousedown', (e) => {
        keys[keyCode] = true;
        if (actionFn) actionFn();
    });
    btn.addEventListener('mouseup', (e) => {
        keys[keyCode] = false;
    });
}

setupTouchButton('leftBtn', 'ArrowLeft');
setupTouchButton('rightBtn', 'ArrowRight');
setupTouchButton('jumpBtn', 'Space', triggerJump);
setupTouchButton('dashBtn', 'ShiftLeft', triggerDash);

function triggerJump() {
    if (player.grounded) {
        jump(PHYSICS.jumpForce);
    } else if (player.isWallSliding) {
        player.vx = -player.wallDir * 9;
        jump(PHYSICS.jumpForce * 0.9);
    } else if (player.doubleJump) {
        jump(PHYSICS.jumpForce * 0.85);
        player.doubleJump = false;
    }
}

function triggerDash() {
    if (player.dashCooldown === 0 && !player.isDashing) {
        player.isDashing = true;
        player.dashTimer = 9;
        player.dashCooldown = 30;
        createBurst(player.x, player.y + 20, '#00f3ff', 8);
    }
}

function jump(force) {
    player.vy = force;
    player.grounded = false;
    player.scaleX = 0.75;
    player.scaleY = 1.25;
    createBurst(player.x + 10, player.y + 40, '#ffffff', 6);
}

function die() {
    screenShake = 14;
    createBurst(player.x + 10, player.y + 20, '#ff0055', 25);
    resetPlayer();
}

function loadLevel(idx) {
    if (idx >= levels.length) { gameWon = true; return; }
    currentLevel = idx;
    document.getElementById('levelDisplay').innerText = `LEVEL: ${currentLevel + 1} / 20`;
    resetPlayer();
}

function resetPlayer() {
    const lvl = levels[currentLevel];
    player.x = lvl.start.x; player.y = lvl.start.y;
    player.vx = 0; player.vy = 0;
    player.isDashing = false;
    player.scaleX = 1; player.scaleY = 1;
}

// --- UPDATE LOOP ---
function update(dt) {
    if (gameWon) return;
    gameTime += 0.05;
    const lvl = levels[currentLevel];

    player.scaleX += (1 - player.scaleX) * 0.15;
    player.scaleY += (1 - player.scaleY) * 0.15;

    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.isDashing) {
        player.vx = player.facing * PHYSICS.dashSpeed;
        player.vy = 0;
        player.dashTimer--;
        if (player.dashTimer <= 0) player.isDashing = false;
    } else {
        if (keys['ArrowRight'] || keys['KeyD']) {
            player.vx = Math.min(player.vx + PHYSICS.acceleration, PHYSICS.maxSpeed);
            player.facing = 1;
        } else if (keys['ArrowLeft'] || keys['KeyA']) {
            player.vx = Math.max(player.vx - PHYSICS.acceleration, -PHYSICS.maxSpeed);
            player.facing = -1;
        } else {
            player.vx *= PHYSICS.friction;
        }
        player.vy += PHYSICS.gravity;
    }

    player.trail.push({ x: player.x, y: player.y, alpha: 0.5, sx: player.scaleX, sy: player.scaleY });
    if (player.trail.length > 4) player.trail.shift();

    player.x += player.vx;
    player.y += player.vy;

    let wasGrounded = player.grounded;
    player.grounded = false;
    player.isWallSliding = false;

    for (let p of lvl.platforms) {
        if (player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y < p.y + p.height && player.y + player.height > p.y) {

            if (player.vy > 0 && player.y + player.height - player.vy <= p.y + 12) {
                player.y = p.y - player.height;
                player.vy = 0;
                player.grounded = true;
                player.doubleJump = true;

                if (!wasGrounded) {
                    player.scaleX = 1.25; player.scaleY = 0.75;
                    createBurst(player.x + 10, player.y + 40, '#aaa', 5);
                }
            } else if (!player.grounded) {
                if (player.x + player.width - player.vx <= p.x) {
                    player.x = p.x - player.width;
                    player.isWallSliding = true; player.wallDir = 1;
                } else if (player.x - player.vx >= p.x + p.width) {
                    player.x = p.x + p.width;
                    player.isWallSliding = true; player.wallDir = -1;
                }
                if (player.isWallSliding && player.vy > 0) player.vy = PHYSICS.wallSlideSpeed;
            }
        }
    }

    for (let b of lvl.bouncePads) {
        if (player.x < b.x + b.width && player.x + player.width > b.x &&
            player.y + player.height >= b.y && player.y < b.y + b.height) {
            jump(PHYSICS.jumpForce * 1.45);
            createBurst(b.x + 12, b.y, '#00f3ff', 10);
        }
    }

    for (let s of lvl.microSpikes) {
        if (player.x < s.x + s.width && player.x + player.width > s.x &&
            player.y < s.y + s.height && player.y + player.height > s.y) {
            die();
        }
    }

    for (let l of lvl.lasers) {
        let lx = l.x;
        let ly = l.moving ? l.y1 + Math.sin(gameTime + l.offset) * 80 : l.y1;
        let lh = Math.abs(l.y2 - l.y1) + 60;

        if (player.x < lx + 4 && player.x + player.width > lx - 4 &&
            player.y < ly + lh && player.y + player.height > ly) {
            die();
        }
    }

    for (let saw of lvl.saws) {
        saw.angle += 0.1;
        let dist = Math.hypot((player.x + 10) - saw.x, (player.y + 22) - saw.y);
        if (dist < saw.radius + 10) {
            die();
        }
    }

    for (let c of lvl.coins) {
        if (!c.collected && player.x < c.x + 16 && player.x + player.width > c.x &&
            player.y < c.y + 16 && player.y + player.height > c.y) {
            c.collected = true;
            coinsCollected++;
            createBurst(c.x + 8, c.y + 8, '#ffd700', 10);
            document.getElementById('scoreDisplay').innerText = `COINS: ${coinsCollected}`;
        }
    }

    const g = lvl.goal;
    if (player.x < g.x + g.width && player.x + player.width > g.x &&
        player.y < g.y + g.height && player.y + player.height > g.y) {
        createBurst(g.x + 15, g.y + 30, '#00ff88', 25);
        loadLevel(currentLevel + 1);
    }

    if (player.y > canvas.height + 120) die();

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    const targetCamX = -player.x + 200;
    camera.x += (targetCamX - camera.x) * camera.lerp;
    if (camera.x > 0) camera.x = 0;
}

// --- RENDER LOOP ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameWon) {
        ctx.fillStyle = '#00f3ff';
        ctx.font = '900 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20; ctx.shadowColor = '#00f3ff';
        ctx.fillText("U Win !", canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#ffd700';
        ctx.font = '24px sans-serif';
        ctx.fillText(`Total Coins Collected: ${coinsCollected}`, canvas.width / 2, canvas.height / 2 + 40);
        return;
    }

    ctx.save();

    let rx = 0, ry = 0;
    if (screenShake > 0) {
        rx = (Math.random() - 0.5) * screenShake;
        ry = (Math.random() - 0.5) * screenShake;
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    ctx.translate(camera.x + rx, ry);
    const lvl = levels[currentLevel];

    for (let p of lvl.platforms) {
        ctx.shadowBlur = 12; ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
    }

    ctx.fillStyle = '#00f3ff';
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f3ff';
    for (let b of lvl.bouncePads) {
        ctx.fillRect(b.x, b.y, b.width, b.height);
    }

    ctx.fillStyle = '#ff0055';
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff0055';
    for (let s of lvl.microSpikes) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + s.height);
        ctx.lineTo(s.x + s.width / 2, s.y);
        ctx.lineTo(s.x + s.width, s.y + s.height);
        ctx.fill();
    }

    for (let l of lvl.lasers) {
        let lx = l.x;
        let ly = l.moving ? l.y1 + Math.sin(gameTime + l.offset) * 80 : l.y1;
        let lh = Math.abs(l.y2 - l.y1) + 60;

        ctx.strokeStyle = '#ff0033';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 18; ctx.shadowColor = '#ff0033';
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + lh);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx - 4, ly - 4, 8, 8);
        ctx.fillRect(lx - 4, ly + lh - 4, 8, 8);
    }

    for (let saw of lvl.saws) {
        ctx.save();
        ctx.translate(saw.x, saw.y);
        ctx.rotate(saw.angle);
        ctx.strokeStyle = '#ff3300';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff3300';

        ctx.beginPath();
        ctx.arc(0, 0, saw.radius, 0, Math.PI * 2);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * (saw.radius + 6), Math.sin(a) * (saw.radius + 6));
        }
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700';
    for (let c of lvl.coins) {
        if (!c.collected) {
            ctx.beginPath();
            ctx.arc(c.x + 8, c.y + 8, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.fillStyle = '#00ff88';
    ctx.shadowBlur = 20; ctx.shadowColor = '#00ff88';
    ctx.fillRect(lvl.goal.x, lvl.goal.y, lvl.goal.width, lvl.goal.height);

    for (let p of particles) p.draw(ctx);

    for (let t of player.trail) {
        ctx.strokeStyle = `rgba(0, 243, 255, ${t.alpha})`;
        t.alpha -= 0.12;
        drawStickman(t.x, t.y, t.sx, t.sy);
    }

    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 12; ctx.shadowColor = '#00f3ff';
    drawStickman(player.x, player.y, player.scaleX, player.scaleY);

    ctx.restore();
}

function drawStickman(x, y, sx, sy) {
    ctx.save();
    ctx.translate(x + 10, y + 22);
    ctx.scale(sx, sy);

    ctx.lineWidth = 3;
    ctx.beginPath();

    player.animFrame += 0.18;
    let legOffset = Math.sin(player.animFrame) * 9;
    if (Math.abs(player.vx) < 0.5 || !player.grounded) legOffset = 0;

    ctx.arc(0, -15, 6, 0, Math.PI * 2);
    ctx.moveTo(0, -9); ctx.lineTo(0, 8);
    ctx.lineTo(-6 + legOffset, 22);
    ctx.moveTo(0, 8); ctx.lineTo(6 - legOffset, 22);
    ctx.moveTo(0, -3); ctx.lineTo(-8, 5);
    ctx.moveTo(0, -3); ctx.lineTo(8, 5);

    ctx.stroke();
    ctx.restore();
}

function engineLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt);
    render();
    requestAnimationFrame(engineLoop);
}

loadLevel(0);
requestAnimationFrame(engineLoop);