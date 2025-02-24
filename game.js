window.addEventListener('load', () => {
    if (typeof pcui === 'undefined') {
        initGame(false); // Fallback to HTML buttons
    } else {
        initGame(true); // Use PCUI
    }
});

function initGame(usePCUI) {
    // Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const playerGroup = new THREE.Group();
    const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const playerMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, shininess: 100, specular: 0xffffff });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    const swordGeometry = new THREE.BoxGeometry(0.2, 0.2, 2.5);
    const swordMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 50, specular: 0xffffff });
    const sword = new THREE.Mesh(swordGeometry, swordMaterial);
    sword.position.set(0.6, 0, 0.5);
    playerGroup.add(player, sword);
    scene.add(playerGroup);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 10);
    scene.add(directionalLight);

    scene.background = new THREE.Color(0x87ceeb);
    const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(-20, 20, 20);
    scene.add(sun);
    for (let i = 0; i < 5; i++) {
        const cloudGeometry = new THREE.SphereGeometry(2, 16, 16);
        const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.position.set((Math.random() - 0.5) * 40, 15 + Math.random() * 5, (Math.random() - 0.5) * 20);
        cloud.scale.set(1 + Math.random(), 0.5 + Math.random() * 0.5, 1 + Math.random());
        scene.add(cloud);
    }

    const groundGeometry = new THREE.PlaneGeometry(50, 30);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x90ee90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Game State
    let playerStats = {
        health: 100, maxHealth: 100, coins: 0, kills: 0, baseSpeed: 0.15, speed: 0.15, damage: 1, armor: 0,
        attackCooldown: 0, stunTimer: 0, speedTimer: 0, armorTimer: 0, weaponTimer: 0, wave: 1, whiteCubeKills: 0
    };
    let enemies = [];
    let portals = [];
    let allies = [];
    let coins = [];
    let trailParticles = [];
    let armorBubbles = [];
    let projectiles = [];
    const keys = {};
    let isPaused = false;
    let waveTimer = 0;
    let enemiesToSpawn = 0;
    let goldenCubeExists = false;
    let leaderboard = JSON.parse(localStorage.getItem('cubeDefenseLeaderboard')) || [];
    updateLeaderboardUI();

    // UI Setup
    const shopContainer = document.getElementById('shop');
    const upgrades = [
        { type: 'armor', cost: 50, text: 'Armor (50 coins) [Q]' },
        { type: 'health', cost: 30, text: 'Health (30 coins) [W]' },
        { type: 'speed', cost: 40, text: 'Speed (40 coins) [E]' },
        { type: 'weapon', cost: 60, text: 'Weapon (60 coins) [R]' },
        { type: 'ally', cost: 30, text: 'Ally Cube (30 coins) [T]' }
    ];
    const hotkeys = ['q', 'w', 'e', 'r', 't'];

    if (usePCUI) {
        const shopTitle = new pcui.Label({ text: 'Shop' });
        shopTitle.class.add('pcui-label-header');
        shopContainer.appendChild(shopTitle.dom);
        upgrades.forEach(upgrade => {
            const button = new pcui.Button({ text: upgrade.text });
            button.on('click', () => buyUpgrade(upgrade.type));
            shopContainer.appendChild(button.dom);
        });
        const pauseButton = new pcui.Button({ text: 'Pause' });
        pauseButton.on('click', togglePause);
        document.getElementById('pauseButton').appendChild(pauseButton.dom);
        const restartWaveButton = new pcui.Button({ text: 'Restart Wave' });
        restartWaveButton.on('click', restartWave);
        document.getElementById('restartWaveButton').appendChild(restartWaveButton.dom);
    } else {
        shopContainer.innerHTML = '<h3>Shop</h3>';
        upgrades.forEach(upgrade => {
            const button = document.createElement('button');
            button.textContent = upgrade.text;
            button.onclick = () => buyUpgrade(upgrade.type);
            shopContainer.appendChild(button);
        });
        const pauseButton = document.createElement('button');
        pauseButton.textContent = 'Pause';
        pauseButton.onclick = togglePause;
        document.getElementById('pauseButton').appendChild(pauseButton);
        const restartWaveButton = document.createElement('button');
        restartWaveButton.textContent = 'Restart Wave';
        restartWaveButton.onclick = restartWave;
        document.getElementById('restartWaveButton').appendChild(restartWaveButton);
    }

    // Hotkey Listener for Shop
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === 'Escape') togglePause();
        const hotkeyIndex = hotkeys.indexOf(e.key.toLowerCase());
        if (hotkeyIndex !== -1) {
            buyUpgrade(upgrades[hotkeyIndex].type);
        }
    });
    document.addEventListener('keyup', (e) => keys[e.key] = false);

    // Functions
    function showLevelDisplay() {
        const levelDisplay = document.getElementById('levelDisplay');
        levelDisplay.style.display = 'block';
        const duration = playerStats.wave === 1 ? 2000 : 1000;
        setTimeout(() => levelDisplay.style.display = 'none', duration);
    }

    function resetGame() {
        saveScore(playerStats.kills);
        playerStats.health = playerStats.maxHealth;
        playerStats.stunTimer = 0;
        playerStats.coins = 0;
        playerStats.kills = 0;
        playerStats.wave = 1;
        playerStats.whiteCubeKills = 0;
        playerGroup.position.set(0, 0.5, 0);
        enemies.forEach(enemy => scene.remove(enemy.mesh || enemy));
        enemies = [];
        portals.forEach(portal => scene.remove(portal));
        portals = [];
        allies.forEach(ally => scene.remove(ally));
        allies = [];
        coins.forEach(coin => scene.remove(coin));
        coins = [];
        trailParticles.forEach(p => scene.remove(p));
        trailParticles = [];
        armorBubbles.forEach(b => scene.remove(b));
        armorBubbles = [];
        projectiles.forEach(p => scene.remove(p));
        projectiles = [];
        goldenCubeExists = false;
        createPortal();
        createPortal();
        updateUI();
        spawnWave();
        showLevelDisplay();
    }

    function restartWave() {
        enemies.forEach(enemy => scene.remove(enemy));
        enemies = [];
        enemiesToSpawn = 0;
        waveTimer = 0;
        spawnWave();
    }

    function createPortal(type = 'normal') {
        const portalGeometry = new THREE.CylinderGeometry(2, 2, 0.2, 32);
        const portalMaterial = new THREE.MeshPhongMaterial({ 
            color: type === 'boss' ? 0x800080 : type === 'golden' ? 0xffd700 : 0xff0000, shininess: 30 
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        portal.position.set((Math.random() - 0.5) * 45, 0.1, (Math.random() - 0.5) * 25);
        portal.type = type;
        if (type === 'boss') portal.timer = 5;
        scene.add(portal);
        portals.push(portal);
    }

    function spawnEnemy(type = 'normal', fromBoss = false) {
        let portal;
        if (type === 'boss') {
            portal = portals.find(p => p.type === 'boss');
            if (!portal) return;
        } else {
            portal = fromBoss ? 
                portals.find(p => p.type === 'boss') || portals[Math.floor(Math.random() * portals.length)] :
                portals[Math.floor(Math.random() * portals.length)];
        }
        if (!portal) return;

        let size, color, hits, speed, damage;
        if (type === 'strong') { size = 1.5; color = 0x0000ff; hits = 7; speed = 0.03; damage = 1; }
        else if (type === 'boss') { size = 2; color = 0x800080; hits = 25; speed = 0.03; damage = 2; }
        else if (type === 'minion') { size = 0.7; color = 0x800080; hits = 5; speed = 0.04; damage = 0.5; }
        else if (type === 'fast') { size = 0.8; color = 0x87cefa; hits = 3; speed = 0.08; damage = 0.3; }
        else if (type === 'golden') { 
            if (goldenCubeExists) return; size = 1; color = 0xffd700; hits = 10; speed = 0.12; damage = 0; 
        } else if (type === 'white') { size = 1.2; color = 0xffffff; hits = 15; speed = 0.05; damage = 1.5; }
        else if (type === 'whiteMiniBoss') { size = 1.5; color = 0xffffff; hits = 30; speed = 0.04; damage = 2; }
        else if (type === 'magician') { size = 1.5; color = 0x000000; hits = 15; speed = 0.04; damage = 1; }
        else if (type === 'baby') { size = 0.5; color = 0xff69b4; hits = 3; speed = 0.15; damage = 0.5; }
        else { size = 1; color = 0xff0000; hits = 1; speed = 0.03; damage = 1; }

        const enemyGroup = new THREE.Group();
        const enemyGeometry = new THREE.BoxGeometry(size, size, size);
        const enemyMaterial = new THREE.MeshPhongMaterial({ color, shininess: 100, specular: 0xffffff });
        const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemyGroup.add(enemy);

        if (type === 'boss') {
            const bossSword = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.5), new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 50 }));
            bossSword.position.set(0.6, 0, 0.5);
            enemyGroup.add(bossSword);
            enemyGroup.sword = bossSword;
            enemyGroup.attackCooldown = 0;
            enemyGroup.summonCooldown = 0;
            enemyGroup.shockwaveCooldown = 0;
            const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshPhongMaterial({ color: 0xffff00, shininess: 50 }));
            crown.position.y = size / 2 + 0.15;
            enemyGroup.add(crown);
        } else if (type === 'golden') {
            enemyGroup.timer = 10;
            createPortal('golden');
            goldenCubeExists = true;
            for (let i = 0; i < 5; i++) {
                const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
                sparkle.position.set((Math.random() - 0.5) * size, (Math.random() - 0.5) * size + size / 2, (Math.random() - 0.5) * size);
                enemyGroup.add(sparkle);
            }
        } else if (type === 'whiteMiniBoss') {
            const axe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2), new THREE.MeshPhongMaterial({ color: 0x666666, shininess: 50 }));
            axe.position.set(0.6, 0, 0.5);
            enemyGroup.add(axe);
            enemyGroup.axe = axe;
            enemyGroup.attackCooldown = 0;
        } else if (type === 'magician') {
            const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32), new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 50 }));
            hat.position.y = size / 2 + 0.15;
            enemyGroup.add(hat);
            enemyGroup.attackCooldown = 0;
        } else if (type === 'baby') {
            const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 50 }));
            bottle.position.set(0.2, 0, 0);
            enemyGroup.add(bottle);
        }

        if (type !== 'normal') {
            const healthBarBg = new THREE.Mesh(new THREE.PlaneGeometry(size, 0.1), new THREE.MeshBasicMaterial({ color: 0x666666 }));
            const healthBar = new THREE.Mesh(new THREE.PlaneGeometry(size, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
            healthBarBg.position.set(0, size / 2 + 0.2, 0);
            healthBar.position.set(0, size / 2 + 0.2, 0);
            enemyGroup.add(healthBarBg, healthBar);
            enemyGroup.healthBar = healthBar;
            enemyGroup.healthBarBg = healthBarBg;
        }

        enemyGroup.hitsRemaining = hits;
        enemyGroup.maxHits = hits;
        enemyGroup.speed = speed;
        enemyGroup.damage = damage;
        enemyGroup.type = type;
        enemyGroup.position.copy(portal.position);
        enemyGroup.position.y = size / 2;
        scene.add(enemyGroup);
        enemies.push(enemyGroup);
    }

    function spawnAlly() {
        const ally = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshPhongMaterial({ color: 0x0000ff, shininess: 100, specular: 0xffffff }));
        ally.position.copy(playerGroup.position);
        ally.timer = 7;
        ally.attackCooldown = 0;
        const healthBarBg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), new THREE.MeshBasicMaterial({ color: 0x666666 }));
        const healthBar = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        healthBarBg.position.set(0, 0.5, 0);
        healthBar.position.set(0, 0.5, 0);
        ally.add(healthBarBg, healthBar);
        ally.healthBar = healthBar;
        ally.healthBarBg = healthBarBg;
        ally.maxTimer = 7;
        scene.add(ally);
        allies.push(ally);
    }

    function spawnCoin(position) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), new THREE.MeshPhongMaterial({ color: 0xffff00, shininess: 50 }));
        coin.position.copy(position);
        coin.position.y = 0.05;
        coin.value = Math.floor(Math.random() * 5) + 1;
        scene.add(coin);
        coins.push(coin);
        if (!goldenCubeExists && Math.random() < 0.05) spawnEnemy('golden');
    }

    function spawnProjectile(position, direction) {
        const projectile = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.5), new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 50 }));
        projectile.position.copy(position);
        projectile.position.y = 0.5;
        projectile.direction = direction;
        projectile.speed = 0.1;
        scene.add(projectile);
        projectiles.push(projectile);
    }

    function createTrailParticle() {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        particle.position.copy(playerGroup.position);
        particle.position.y = 0.5;
        scene.add(particle);
        trailParticles.push({ mesh: particle, life: 0.5 });
    }

    function createArmorBubble() {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshPhongMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5, shininess: 50 }));
        scene.add(bubble);
        armorBubbles.push(bubble);
    }

    function togglePause() {
        isPaused = !isPaused;
        document.getElementById('pauseMenu').style.display = isPaused ? 'block' : 'none';
    }

    window.resumeGame = function() {
        isPaused = false;
        document.getElementById('pauseMenu').style.display = 'none';
    };

    function updatePlayer() {
        if (isPaused || playerStats.stunTimer > 0) return;
        camera.position.set(playerGroup.position.x, 10, playerGroup.position.z + 15);
        camera.lookAt(playerGroup.position);
        let currentSpeed = playerStats.speedTimer > 0 ? playerStats.baseSpeed * 2 : playerStats.speed; // Adjusted for no special
        if (keys['ArrowUp']) playerGroup.position.z -= currentSpeed;
        if (keys['ArrowDown']) playerGroup.position.z += currentSpeed;
        if (keys['ArrowLeft']) playerGroup.position.x -= currentSpeed;
        if (keys['ArrowRight']) playerGroup.position.x += currentSpeed;
        playerGroup.position.x = Math.max(-24, Math.min(24, playerGroup.position.x));
        playerGroup.position.z = Math.max(-14, Math.min(14, playerGroup.position.z));
        if (keys[' '] && playerStats.attackCooldown <= 0) {
            attack();
            playerStats.attackCooldown = 0.5;
            sword.rotation.x = Math.PI / 4;
        }
        sword.rotation.x *= 0.9;
        for (let i = coins.length - 1; i >= 0; i--) {
            if (playerGroup.position.distanceTo(coins[i].position) < 1) {
                playerStats.coins += coins[i].value;
                scene.remove(coins[i]);
                coins.splice(i, 1);
                updateUI();
            }
        }
        playerStats.attackCooldown -= 0.016;
        playerStats.speedTimer = Math.max(0, playerStats.speedTimer - 0.016);
        playerStats.armorTimer = Math.max(0, playerStats.armorTimer - 0.016);
        playerStats.weaponTimer = Math.max(0, playerStats.weaponTimer - 0.016);
        if (playerStats.speedTimer > 0 && Math.random() < 0.3) createTrailParticle();
        if (playerStats.armorTimer <= 0 && armorBubbles.length > 0) {
            armorBubbles.forEach(b => scene.remove(b));
            armorBubbles = [];
        }
        playerStats.stunTimer = Math.max(0, playerStats.stunTimer - 0.016);
        for (let i = trailParticles.length - 1; i >= 0; i--) {
            trailParticles[i].life -= 0.016;
            trailParticles[i].mesh.scale.multiplyScalar(0.95);
            if (trailParticles[i].life <= 0) {
                scene.remove(trailParticles[i].mesh);
                trailParticles.splice(i, 1);
            }
        }
        armorBubbles.forEach((bubble, i) => {
            bubble.position.copy(playerGroup.position);
            bubble.position.y = 0.5 + Math.sin(Date.now() * 0.002 + i) * 0.5;
            bubble.position.x += Math.cos(Date.now() * 0.002 + i) * 0.7;
            bubble.position.z += Math.sin(Date.now() * 0.002 + i) * 0.7;
        });
        updateUI();
    }

    function attack() {
        const damage = playerStats.damage; // No special multiplier
        const hitRange = playerStats.weaponTimer > 0 ? 4 : 3;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (playerGroup.position.distanceTo(enemy.position) < hitRange) {
                enemy.hitsRemaining -= damage;
                if (enemy.healthBar) {
                    enemy.healthBar.scale.x = enemy.hitsRemaining / enemy.maxHits;
                    enemy.healthBar.position.x = -enemy.scale.x / 2 + (enemy.scale.x * enemy.healthBar.scale.x) / 2;
                }
                if (enemy.hitsRemaining <= 0) {
                    spawnCoin(enemy.position);
                    scene.remove(enemy);
                    if (enemy.type === 'golden') goldenCubeExists = false;
                    enemies.splice(i, 1);
                    playerStats.kills++;
                    if (enemy.type === 'white') {
                        playerStats.whiteCubeKills++;
                        if (playerStats.whiteCubeKills % 5 === 0) spawnEnemy('whiteMiniBoss');
                    }
                    if (playerStats.wave >= 5 && playerStats.kills % 50 === 0) {
                        createPortal('boss');
                        spawnEnemy('boss');
                    } else if (playerStats.kills % 10 === 0) spawnEnemy('strong');
                    updateUI();
                }
            }
        }
    }

    function updateEnemies() {
        if (isPaused) return;
        enemies.forEach((enemy, index) => {
            let direction;
            if (enemy.type === 'golden') {
                direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                enemy.timer -= 0.016;
                if (Math.random() < 0.1) spawnCoin(enemy.position);
                const goldenPortal = portals.find(p => p.type === 'golden');
                if (goldenPortal && enemy.timer <= 0) {
                    if (enemy.position.distanceTo(goldenPortal.position) < 1) {
                        scene.remove(enemy);
                        enemies.splice(index, 1);
                        scene.remove(goldenPortal);
                        portals = portals.filter(p => p !== goldenPortal);
                        goldenCubeExists = false;
                    } else {
                        direction = goldenPortal.position.clone().sub(enemy.position).normalize();
                    }
                }
                portals.forEach(portal => {
                    if (portal.type === 'normal' && enemy.position.distanceTo(portal.position) < 2) {
                        return;
                    }
                });
            } else {
                direction = playerGroup.position.clone().sub(enemy.position).normalize();
            }
            enemy.position.add(direction.multiplyScalar(enemy.speed));

            if (enemy.type === 'baby') {
                enemy.position.x = Math.max(-24, Math.min(24, enemy.position.x));
                enemy.position.z = Math.max(-14, Math.min(14, enemy.position.z));
            }

            if (enemy.type === 'boss') {
                enemy.attackCooldown -= 0.016;
                enemy.summonCooldown -= 0.016;
                enemy.shockwaveCooldown -= 0.016;
                if (enemy.attackCooldown <= 0) {
                    enemy.sword.rotation.x = Math.PI / 4;
                    if (playerGroup.position.distanceTo(enemy.position) < 3) {
                        playerStats.health -= enemy.damage;
                        updateUI();
                    }
                    enemy.attackCooldown = 0.5;
                }
                enemy.sword.rotation.x *= 0.9;
                if (enemy.summonCooldown <= 0) {
                    for (let i = 0; i < 3; i++) spawnEnemy('minion', true);
                    enemy.summonCooldown = 20;
                }
                if (enemy.shockwaveCooldown <= 0 && playerGroup.position.distanceTo(enemy.position) < 5) {
                    playerStats.stunTimer = 2;
                    enemy.shockwaveCooldown = 10;
                }
            } else if (enemy.type === 'whiteMiniBoss') {
                enemy.attackCooldown -= 0.016;
                if (enemy.attackCooldown <= 0) {
                    enemy.axe.rotation.x = Math.PI / 4;
                    if (playerGroup.position.distanceTo(enemy.position) < 3) {
                        playerStats.health -= enemy.damage;
                        playerStats.stunTimer = 2;
                        updateUI();
                    }
                    enemy.attackCooldown = 0.5;
                }
                enemy.axe.rotation.x *= 0.9;
            } else if (enemy.type === 'magician') {
                enemy.attackCooldown -= 0.016;
                if (enemy.attackCooldown <= 0) {
                    const projDirection = playerGroup.position.clone().sub(enemy.position).normalize();
                    spawnProjectile(enemy.position, projDirection);
                    enemy.attackCooldown = 1;
                }
            }
            if (enemy.type !== 'golden' && playerGroup.position.distanceTo(enemy.position) < 1) {
                playerStats.health -= Math.max(enemy.damage - (playerStats.armorTimer > 0 ? playerStats.armor * 0.2 : playerStats.armor * 0.1), 0.1);
                if (enemy.type === 'boss') playerStats.stunTimer = 2;
                updateUI();
                if (playerStats.health <= 0) {
                    alert('Game Over! Score: ' + playerStats.kills);
                    resetGame();
                }
            }
        });
        for (let i = portals.length - 1; i >= 0; i--) {
            if (portals[i].type === 'boss' && portals[i].timer) {
                portals[i].timer -= 0.016;
                if (portals[i].timer <= 0) {
                    scene.remove(portals[i]);
                    portals.splice(i, 1);
                }
            }
        }
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            proj.position.add(proj.direction.clone().multiplyScalar(proj.speed));
            if (playerGroup.position.distanceTo(proj.position) < 1) {
                playerStats.health -= 1;
                scene.remove(proj);
                projectiles.splice(i, 1);
                updateUI();
            } else if (proj.position.distanceTo(playerGroup.position) > 20) {
                scene.remove(proj);
                projectiles.splice(i, 1);
            }
        }
    }

    function updateAllies() {
        if (isPaused) return;
        allies.forEach((ally, index) => {
            const nearestEnemy = enemies.reduce((closest, enemy) => {
                const dist = ally.position.distanceTo(enemy.position);
                return dist < closest.dist ? { enemy, dist } : closest;
            }, { enemy: null, dist: Infinity });
            if (nearestEnemy.enemy) {
                const direction = nearestEnemy.enemy.position.clone().sub(ally.position).normalize();
                ally.position.add(direction.multiplyScalar(0.08));
                ally.attackCooldown -= 0.016;
                if (nearestEnemy.dist < 1 && ally.attackCooldown <= 0) {
                    nearestEnemy.enemy.hitsRemaining -= 2;
                    if (nearestEnemy.enemy.healthBar) {
                        nearestEnemy.enemy.healthBar.scale.x = nearestEnemy.enemy.hitsRemaining / nearestEnemy.enemy.maxHits;
                        nearestEnemy.enemy.healthBar.position.x = -nearestEnemy.enemy.scale.x / 2 + (nearestEnemy.enemy.scale.x * nearestEnemy.enemy.healthBar.scale.x) / 2;
                    }
                    if (nearestEnemy.enemy.hitsRemaining <= 0) {
                        spawnCoin(nearestEnemy.enemy.position);
                        if (nearestEnemy.enemy.type === 'golden') goldenCubeExists = false;
                        scene.remove(nearestEnemy.enemy);
                        enemies = enemies.filter(e => e !== nearestEnemy.enemy);
                    }
                    ally.attackCooldown = 1.5;
                }
            }
            ally.timer -= 0.016;
            ally.healthBar.scale.x = ally.timer / ally.maxTimer;
            ally.healthBar.position.x = -0.4 + (0.8 * ally.healthBar.scale.x) / 2;
            if (ally.timer <= 0) {
                scene.remove(ally);
                allies.splice(index, 1);
            }
        });
    }

    function buyUpgrade(type) {
        if (type === 'armor' && playerStats.coins >= 50 && playerStats.armorTimer <= 0) {
            playerStats.armorTimer = 17;
            playerStats.coins -= 50;
            for (let i = 0; i < 3; i++) createArmorBubble();
        } else if (type === 'health' && playerStats.coins >= 30) {
            playerStats.maxHealth += 20;
            playerStats.health = playerStats.maxHealth;
            playerStats.coins -= 30;
        } else if (type === 'speed' && playerStats.coins >= 40 && playerStats.speedTimer <= 0) {
            playerStats.speedTimer = 10;
            playerStats.coins -= 40;
        } else if (type === 'weapon' && playerStats.coins >= 60 && playerStats.weaponTimer <= 0) {
            playerStats.weaponTimer = 15;
            playerStats.damage = 3;
            sword.scale.set(1.5, 1.5, 1.5);
            playerStats.coins -= 60;
        } else if (type === 'ally' && playerStats.coins >= 30) {
            spawnAlly();
            playerStats.coins -= 30;
        }
        updateUI();
    }

    function updateUI() {
        document.getElementById('health').textContent = Math.floor(playerStats.health);
        document.getElementById('coins').textContent = playerStats.coins;
        document.getElementById('kills').textContent = playerStats.kills;
        document.getElementById('wave').textContent = playerStats.wave;
    }

    function saveScore(score) {
        leaderboard.push(score);
        leaderboard.sort((a, b) => b - a);
        leaderboard = leaderboard.slice(0, 5);
        localStorage.setItem('cubeDefenseLeaderboard', JSON.stringify(leaderboard));
        updateLeaderboardUI();
    }

    function updateLeaderboardUI() {
        const list = document.getElementById('leaderboardList');
        list.innerHTML = '';
        leaderboard.forEach(score => {
            const li = document.createElement('li');
            li.textContent = score;
            list.appendChild(li);
        });
    }

    function spawnWave() {
        enemiesToSpawn = playerStats.wave * 5;
        if (playerStats.wave % 2 === 0) spawnEnemy('fast');
        if (playerStats.wave === 5) {
            createPortal('boss');
            spawnEnemy('boss');
        }
        if (Math.random() < 0.3) spawnEnemy('white');
        if (Math.random() < 0.2) spawnEnemy('magician');
        if (Math.random() < 0.4) spawnEnemy('baby');
        waveTimer = 10;
        playerStats.wave++;
        document.getElementById('levelDisplay').textContent = `Level ${playerStats.wave - 1}`;
        showLevelDisplay();
    }

    let spawnTimer = 0;
    function animate() {
        requestAnimationFrame(animate);
        if (!isPaused) {
            updatePlayer();
            updateEnemies();
            updateAllies();
            if (enemiesToSpawn > 0 && spawnTimer <= 0 && portals.length > 0) {
                spawnEnemy('normal');
                enemiesToSpawn--;
                spawnTimer = 0.5;
            }
            spawnTimer -= 0.016;
            waveTimer -= 0.016;
            if (waveTimer <= 0 && enemies.length === 0 && enemiesToSpawn === 0) {
                spawnWave();
            }
            if (playerStats.weaponTimer <= 0 && playerStats.damage > 1) {
                playerStats.damage = 1;
                sword.scale.set(1, 1, 1);
            }
        }
        renderer.render(scene, camera);
    }

    // Start Game
    createPortal();
    createPortal();
    spawnWave();
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
