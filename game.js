window.addEventListener('load', () => {
    if (typeof pcui === 'undefined') {
        initGame(false);
    } else {
        initGame(true);
    }
});

function initGame(usePCUI) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87ceeb, 1);
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
    playerGroup.position.set(0, 0.5, 0);

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

    let playerStats = {
        health: 100, maxHealth: 100, coins: 0, kills: 0, baseSpeed: 0.15, speed: 0.15, damage: 1, armor: 0,
        attackCooldown: 0, stunTimer: 0, speedTimer: 0, armorTimer: 0, weaponTimer: 0, wave: 1, whiteCubeKills: 0,
        goldenCubeKills: 0, regenTimer: 0, hasRadar: false
    };
    let enemies = [];
    let portals = [];
    let allies = [];
    let coins = [];
    let trailParticles = [];
    let armorBubbles = [];
    let projectiles = [];
    let traps = [];
    let lootDrops = [];
    const keys = {};
    let isPaused = false;
    let waveTimer = 0;
    let enemiesToSpawn = 0;
    let goldenCubeExists = false;
    let dayNightCycle = 0;
    let leaderboard = JSON.parse(localStorage.getItem('cubeDefenseLeaderboard')) || [];
    let achievements = JSON.parse(localStorage.getItem('cubeDefenseAchievements')) || {
        goldenSlayer: false, waveMaster: false
    };
    let hardMode = false;

    // Inventory Setup
    let inventory = [];
    let equipped = { weapon: null, helm: null, armor: null };
    updateInventoryUI();

    const shopContainer = document.getElementById('shop');
    const upgrades = [
        { type: 'armor', cost: 50, text: 'Armor (50 coins) [Q]' },
        { type: 'health', cost: 30, text: 'Health (30 coins) [W]' },
        { type: 'speed', cost: 40, text: 'Speed (40 coins) [E]' },
        { type: 'weapon', cost: 60, text: 'Weapon (60 coins) [R]' },
        { type: 'ally', cost: 30, text: 'Ally Cube (30 coins) [T]' },
        { type: 'trap', cost: 40, text: 'Trap (40 coins) [Y]' },
        { type: 'regen', cost: 100, text: 'Health Regen (100 coins) [U]' },
        { type: 'radar', cost: 70, text: 'Radar (70 coins) [I]' },
        { type: 'hardMode', cost: 0, text: 'Hard Mode Toggle [O]' }
    ];
    const hotkeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

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

    // Achievements Modal Setup
    const achievementsButton = document.getElementById('achievementsButton');
    const achievementsModal = document.getElementById('achievementsModal');
    const closeAchievements = document.getElementById('closeAchievements');

    achievementsButton.onclick = function() {
        achievementsModal.style.display = 'block';
        updateAchievementUI();
    };
    closeAchievements.onclick = function() {
        achievementsModal.style.display = 'none';
    };
    window.onclick = function(event) {
        if (event.target === achievementsModal) {
            achievementsModal.style.display = 'none';
        }
    };

    // Inventory Modal Setup
    const inventoryButton = document.getElementById('inventoryButton');
    const inventoryModal = document.getElementById('inventoryModal');
    const closeInventory = document.getElementById('closeInventory');

    inventoryButton.onclick = function() {
        inventoryModal.style.display = 'block';
        updateInventoryUI();
    };
    closeInventory.onclick = function() {
        inventoryModal.style.display = 'none';
    };
    window.onclick = function(event) {
        if (event.target === inventoryModal) {
            inventoryModal.style.display = 'none';
        }
    };

    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === 'Escape') togglePause();
        if (e.key === 'z' || e.key === 'Z') {
            inventoryModal.style.display = inventoryModal.style.display === 'block' ? 'none' : 'block';
            updateInventoryUI();
        }
        if (e.key === 'f' && equipped.helm) {
            if (equipped.helm.name === 'Wizard Hat') {
                playerGroup.position.set((Math.random() - 0.5) * 45, 0.5, (Math.random() - 0.5) * 25);
            } else if (equipped.helm.name === 'King Crown') {
                spawnAlly('orange');
            }
        }
        const hotkeyIndex = hotkeys.indexOf(e.key.toLowerCase());
        if (hotkeyIndex !== -1) buyUpgrade(upgrades[hotkeyIndex].type);
    });
    document.addEventListener('keyup', (e) => keys[e.key] = false);

    function showLevelDisplay() {
        const levelDisplay = document.getElementById('levelDisplay');
        if (levelDisplay) {
            levelDisplay.style.display = 'block';
            const duration = playerStats.wave === 1 ? 2000 : 1000;
            setTimeout(() => levelDisplay.style.display = 'none', duration);
        }
    }

    function resetGame() {
        saveScore(playerStats.kills);
        playerStats = {
            health: 100, maxHealth: 100, coins: 0, kills: 0, baseSpeed: 0.15, speed: 0.15, damage: 1, armor: 0,
            attackCooldown: 0, stunTimer: 0, speedTimer: 0, armorTimer: 0, weaponTimer: 0, wave: 1, whiteCubeKills: 0,
            goldenCubeKills: 0, regenTimer: 0, hasRadar: playerStats.hasRadar
        };
        playerGroup.position.set(0, 0.5, 0);
        enemies.forEach(enemy => scene.remove(enemy));
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
        traps.forEach(t => scene.remove(t));
        traps = [];
        lootDrops.forEach(l => scene.remove(l));
        lootDrops = [];
        goldenCubeExists = false;
        dayNightCycle = 0;
        inventory = [];
        equipped = { weapon: null, helm: null, armor: null };
        updatePlayerVisuals();
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
        if (type === 'boss' || type === 'wizardKing') {
            portal = portals.find(p => p.type === 'boss');
            if (!portal) return;
        } else {
            portal = fromBoss ? 
                portals.find(p => p.type === 'boss') || portals[Math.floor(Math.random() * portals.length)] :
                portals[Math.floor(Math.random() * portals.length)];
        }
        if (!portal) return;

        let size, color, hits, speed, damage, stealth = false, explosive = false;
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
        else if (type === 'stealth') { size = 1; color = 0x666666; hits = 5; speed = 0.06; damage = 1; stealth = true; }
        else if (type === 'explosive') { size = 1.2; color = 0xff4500; hits = 10; speed = 0.04; damage = 1; explosive = true; }
        else if (type === 'wizardKing') { size = 2; color = 0x4b0082; hits = 15; speed = 0.03; damage = 2; } // King Cube: 15 hits
        else if (type === 'knight') { size = 1.2; color = 0x808080; hits = 7; speed = 0.1; damage = 10; } // Knight Cube
        else if (type === 'bodyguard') { size = 1; color = 0x333333; hits = 3; speed = 0.03; damage = 5; } // Bodyguard Cube
        else if (type === 'philip') { size = 1.2; color = 0x4a2c2a; hits = 10; speed = 0.05; damage = 7; } // Philip Cube
        else { size = 1; color = 0xff0000; hits = 1; speed = 0.03; damage = 1; }

        if (playerStats.wave > 10) hits *= (1 + (playerStats.wave - 10) * 0.05);
        if (hardMode) { hits *= 2; speed *= 1.2; damage *= 2; }
        if (dayNightCycle > 0.5) speed *= 1.1;

        const enemyGroup = new THREE.Group();
        const enemyGeometry = new THREE.BoxGeometry(size, size, size);
        const enemyMaterial = new THREE.MeshPhongMaterial({ color, shininess: 100, specular: 0xffffff, transparent: stealth, opacity: stealth ? 0.2 : 1 });
        const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemyGroup.add(enemyMesh);

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
        } else if (type === 'magician' || type === 'wizardKing') {
            const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32), new THREE.MeshPhongMaterial({ color: type === 'magician' ? 0x000000 : 0xffff00, shininess: 50 }));
            hat.position.y = size / 2 + 0.15;
            enemyGroup.add(hat);
            enemyGroup.attackCooldown = 0;
            if (type === 'wizardKing') {
                enemyGroup.summonCooldown = 0;
                const shield = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 16, 16), new THREE.MeshPhongMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 }));
                shield.position.y = size / 2;
                enemyGroup.add(shield);
            }
        } else if (type === 'baby') {
            const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 50 }));
            bottle.position.set(0.2, 0, 0);
            enemyGroup.add(bottle);
        } else if (type === 'knight') {
            enemyGroup.chargeCooldown = 0;
        } else if (type === 'bodyguard') {
            const suit = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.8, size * 0.9), new THREE.MeshPhongMaterial({ color: 0x000080, shininess: 50 }));
            enemyGroup.add(suit);
            const sunglasses = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.4, 0.1), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            sunglasses.position.set(0, size / 2 + 0.1, size / 2 - 0.01);
            enemyGroup.add(sunglasses);
            enemyGroup.attackCooldown = 0;
        } else if (type === 'philip') {
            const hair = new THREE.Mesh(new THREE.BoxGeometry(size * 0.6, 0.2, size * 0.6), new THREE.MeshPhongMaterial({ color: 0x000000 }));
            hair.position.y = size / 2 + 0.1;
            enemyGroup.add(hair);
            const suit = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.8, size * 0.9), new THREE.MeshPhongMaterial({ color: 0x333333 }));
            enemyGroup.add(suit);
            const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
            briefcase.position.set(0.5, 0, 0.3);
            enemyGroup.add(briefcase);
            enemyGroup.briefcase = briefcase;
            enemyGroup.attackCooldown = 0;
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
        enemyGroup.stealth = stealth;
        enemyGroup.explosive = explosive;
        enemyGroup.position.copy(portal.position);
        enemyGroup.position.y = size / 2;
        scene.add(enemyGroup);
        enemies.push(enemyGroup);
    }

    function spawnAlly(type = 'normal') {
        let size, color, hits, damage, attackSpeed;
        if (type === 'orange') { size = 1; color = 0xffa500; hits = 7; damage = 3; attackSpeed = 0.3; } // Crown ally
        else { size = 0.8; color = 0x0000ff; hits = 7; damage = 2; attackSpeed = 1.5; } // Default ally
        const ally = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshPhongMaterial({ color, shininess: 100, specular: 0xffffff }));
        ally.position.copy(playerGroup.position);
        ally.timer = 7;
        ally.attackCooldown = 0;
        const healthBarBg = new THREE.Mesh(new THREE.PlaneGeometry(size, 0.1), new THREE.MeshBasicMaterial({ color: 0x666666 }));
        const healthBar = new THREE.Mesh(new THREE.PlaneGeometry(size, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        healthBarBg.position.set(0, size / 2 + 0.05, 0);
        healthBar.position.set(0, size / 2 + 0.05, 0);
        ally.add(healthBarBg, healthBar);
        ally.healthBar = healthBar;
        ally.healthBarBg = healthBarBg;
        ally.maxTimer = 7;
        ally.damage = damage;
        ally.attackSpeed = attackSpeed;
        if (type === 'orange') {
            const sword = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.5), new THREE.MeshPhongMaterial({ color: 0xaaaaaa }));
            sword.position.set(0.5, 0, 0.5);
            ally.add(sword);
        }
        scene.add(ally);
        allies.push(ally);
    }

    function spawnCoin(position) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), new THREE.MeshPhongMaterial({ color: 0xffff00, shininess: 50 }));
        coin.position.copy(position);
        coin.position.y = 0.05;
        coin.value = Math.floor(Math.random() * 5) + 1 * (hardMode ? 1.5 : 1);
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

    function createDeathParticles(position, color) {
        for (let i = 0; i < 10; i++) {
            const particle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color }));
            particle.position.copy(position);
            particle.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.1, (Math.random() - 0.5) * 0.1);
            scene.add(particle);
            trailParticles.push({ mesh: particle, life: 1 });
        }
    }

    function createTrap(position) {
        const trap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 16), new THREE.MeshPhongMaterial({ color: 0x808080, shininess: 50 }));
        trap.position.copy(position);
        trap.position.y = 0.05;
        trap.timer = 10;
        scene.add(trap);
        traps.push(trap);
    }

    function spawnLootDrop(position) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
        crate.position.copy(position);
        crate.position.y = 0.25;
        const items = [
            { type: 'weapon', name: 'Iron Sword', rarity: 'normal', damage: 2 },
            { type: 'weapon', name: 'Golden Blade', rarity: 'unique', damage: 4 },
            { type: 'weapon', name: 'Dragon Slayer', rarity: 'legendary', damage: 6 },
            { type: 'helm', name: 'Leather Cap', rarity: 'normal', bonus: 10 },
            { type: 'helm', name: 'Wizard Hat', rarity: 'unique', bonus: 0, special: 'teleport' },
            { type: 'helm', name: 'King Crown', rarity: 'legendary', bonus: 0, special: 'summon' },
            { type: 'armor', name: 'Chain Mail', rarity: 'normal', armor: 1 },
            { type: 'armor', name: 'Mystic Robe', rarity: 'unique', armor: 2 },
            { type: 'armor', name: 'Dragon Scale', rarity: 'legendary', armor: 3 }
        ];
        crate.item = items[Math.floor(Math.random() * items.length)];
        scene.add(crate);
        lootDrops.push(crate);
    }

    function togglePause() {
        isPaused = !isPaused;
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) pauseMenu.style.display = isPaused ? 'block' : 'none';
    }

    window.resumeGame = function() {
        isPaused = false;
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) pauseMenu.style.display = 'none';
    };

    function updatePlayer() {
        if (isPaused || playerStats.stunTimer > 0) return;

        camera.position.set(playerGroup.position.x, 10, playerGroup.position.z + 15);
        camera.lookAt(playerGroup.position);

        let currentSpeed = playerStats.speedTimer > 0 ? playerStats.baseSpeed * 2 : playerStats.speed;
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

        for (let i = lootDrops.length - 1; i >= 0; i--) {
            if (playerGroup.position.distanceTo(lootDrops[i].position) < 1) {
                inventory.push(lootDrops[i].item);
                scene.remove(lootDrops[i]);
                lootDrops.splice(i, 1);
                updateInventoryUI();
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

        if (playerStats.regenTimer > 0) {
            playerStats.regenTimer -= 0.016;
            if (playerStats.regenTimer <= 0) {
                playerStats.health = Math.min(playerStats.maxHealth, playerStats.health + 5);
                playerStats.regenTimer = 10;
                updateUI();
            }
        }

        for (let i = trailParticles.length - 1; i >= 0; i--) {
            trailParticles[i].life -= 0.016;
            trailParticles[i].mesh.scale.multiplyScalar(0.95);
            if (trailParticles[i].velocity) {
                trailParticles[i].mesh.position.add(trailParticles[i].velocity);
            }
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
        const damage = equipped.weapon ? equipped.weapon.damage : playerStats.damage;
        const hitRange = playerStats.weaponTimer > 0 ? 4 : 3;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy || !enemy.children[0]) continue;
            if (playerGroup.position.distanceTo(enemy.position) < hitRange) {
                enemy.hitsRemaining -= damage;
                if (enemy.healthBar) {
                    enemy.healthBar.scale.x = enemy.hitsRemaining / enemy.maxHits;
                    enemy.healthBar.position.x = -enemy.scale.x / 2 + (enemy.scale.x * enemy.healthBar.scale.x) / 2;
                }
                if (enemy.hitsRemaining <= 0) {
                    spawnCoin(enemy.position);
                    createDeathParticles(enemy.position, enemy.children[0].material.color.getHex());
                    if (Math.random() < 0.1) spawnLootDrop(enemy.position);
                    if (enemy.type === 'magician' && Math.random() < 0.2) {
                        inventory.push({ type: 'helm', name: 'Wizard Hat', rarity: 'unique', bonus: 0, special: 'teleport' });
                        updateInventoryUI();
                    }
                    if (enemy.type === 'wizardKing' && Math.random() < 0.2) {
                        inventory.push({ type: 'helm', name: 'King Crown', rarity: 'legendary', bonus: 0, special: 'summon' });
                        updateInventoryUI();
                    }
                    if (enemy.type === 'bodyguard' && Math.random() < 0.05) spawnEnemy('philip');
                    scene.remove(enemy);
                    if (enemy.type === 'golden') {
                        goldenCubeExists = false;
                        playerStats.goldenCubeKills++;
                        checkAchievements();
                    }
                    if (enemy.explosive) {
                        for (let j = enemies.length - 1; j >= 0; j--) {
                            if (enemies[j] !== enemy && enemies[j].children[0] && enemy.position.distanceTo(enemies[j].position) < 3) {
                                enemies[j].hitsRemaining -= 5;
                                if (enemies[j].hitsRemaining <= 0) {
                                    spawnCoin(enemies[j].position);
                                    createDeathParticles(enemies[j].position, enemies[j].children[0].material.color.getHex());
                                    scene.remove(enemies[j]);
                                    enemies.splice(j, 1);
                                    playerStats.kills++;
                                }
                            }
                        }
                        if (enemy.position.distanceTo(playerGroup.position) < 3) playerStats.health -= 5;
                    }
                    enemies.splice(i, 1);
                    playerStats.kills++;
                    if (enemy.type === 'white') {
                        playerStats.whiteCubeKills++;
                        if (playerStats.whiteCubeKills % 5 === 0) spawnEnemy('whiteMiniBoss');
                    }
                    if (playerStats.wave >= 5 && playerStats.kills % 50 === 0) {
                        createPortal('boss');
                        spawnEnemy('boss');
                    } else if (playerStats.kills % 75 === 0) {
                        createPortal('boss');
                        spawnEnemy('wizardKing');
                    } else if (playerStats.kills % 10 === 0) spawnEnemy('strong');
                    updateUI();
                }
            }
        }
    }

    function updateEnemies() {
        if (isPaused) return;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy || !enemy.children[0]) {
                enemies.splice(i, 1);
                continue;
            }
            let direction;
            if (enemy.type === 'golden') {
                direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                enemy.timer -= 0.016;
                if (Math.random() < 0.1) spawnCoin(enemy.position);
                const goldenPortal = portals.find(p => p.type === 'golden');
                if (goldenPortal && enemy.timer <= 0) {
                    if (enemy.position.distanceTo(goldenPortal.position) < 1) {
                        scene.remove(enemy);
                        enemies.splice(i, 1);
                        scene.remove(goldenPortal);
                        portals = portals.filter(p => p !== goldenPortal);
                        goldenCubeExists = false;
                        continue;
                    } else {
                        direction = goldenPortal.position.clone().sub(enemy.position).normalize();
                    }
                }
            } else {
                direction = playerGroup.position.clone().sub(enemy.position).normalize();
            }
            enemy.position.add(direction.multiplyScalar(enemy.speed));

            if (enemy.type === 'baby') {
                enemy.position.x = Math.max(-24, Math.min(24, enemy.position.x));
                enemy.position.z = Math.max(-14, Math.min(14, enemy.position.z));
            }

            if (enemy.stealth && enemy.children[0]) {
                if (!playerStats.hasRadar && playerGroup.position.distanceTo(enemy.position) > 5) {
                    enemy.children[0].material.opacity = 0.2;
                } else {
                    enemy.children[0].material.opacity = 1;
                }
            }

            traps.forEach(trap => {
                if (enemy.position.distanceTo(trap.position) < 1) {
                    enemy.speed *= 0.5;
                    enemy.hitsRemaining -= 0.016;
                }
            });

            if (enemy.type === 'boss') {
                enemy.attackCooldown -= 0.016;
                enemy.summonCooldown -= 0.016;
                enemy.shockwaveCooldown -= 0.016;
                if (enemy.attackCooldown <= 0) {
                    enemy.sword.rotation.x = Math.PI / 4;
                    if (playerGroup.position.distanceTo(enemy.position) < 3) playerStats.health -= enemy.damage;
                    enemy.attackCooldown = 0.5;
                }
                enemy.sword.rotation.x *= 0.9;
                if (enemy.summonCooldown <= 0) {
                    for (let j = 0; j < 3; j++) spawnEnemy('minion', true);
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
                    }
                    enemy.attackCooldown = 0.5;
                }
                enemy.axe.rotation.x *= 0.9;
            } else if (enemy.type === 'magician' || enemy.type === 'wizardKing') {
                enemy.attackCooldown -= 0.016;
                if (enemy.type === 'wizardKing') enemy.summonCooldown -= 0.016;
                if (enemy.attackCooldown <= 0) {
                    const projDirection = playerGroup.position.clone().sub(enemy.position).normalize();
                    spawnProjectile(enemy.position, projDirection);
                    enemy.attackCooldown = 1;
                }
                if (enemy.type === 'wizardKing' && enemy.summonCooldown <= 0) {
                    for (let j = 0; j < 5; j++) {
                        const projDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                        spawnProjectile(enemy.position, projDirection);
                    }
                    enemy.summonCooldown = 15;
                }
            } else if (enemy.type === 'knight') {
                enemy.chargeCooldown -= 0.016;
                if (enemy.chargeCooldown <= 0 && playerGroup.position.distanceTo(enemy.position) < 5) {
                    enemy.speed = 0.3;
                    if (playerGroup.position.distanceTo(enemy.position) < 1) {
                        playerStats.health -= enemy.damage;
                        const knockback = direction.clone().multiplyScalar(2);
                        playerGroup.position.add(knockback);
                        enemy.chargeCooldown = 6;
                        enemy.speed = 0.1;
                    }
                }
            } else if (enemy.type === 'bodyguard') {
                enemy.attackCooldown -= 0.016;
                if (enemy.attackCooldown <= 0) {
                    const projDirection = playerGroup.position.clone().sub(enemy.position).normalize();
                    spawnProjectile(enemy.position, projDirection);
                    enemy.attackCooldown = 1.3;
                }
            } else if (enemy.type === 'philip') {
                enemy.attackCooldown -= 0.016;
                if (enemy.attackCooldown <= 0 && playerGroup.position.distanceTo(enemy.position) < 1.5) {
                    enemy.briefcase.rotation.x = Math.PI / 4;
                    playerStats.health -= enemy.damage;
                    if (Math.random() < 0.3) playerStats.stunTimer = 1;
                    enemy.attackCooldown = 1;
                }
                enemy.briefcase.rotation.x *= 0.9;
            }

            if (enemy.type !== 'golden' && playerGroup.position.distanceTo(enemy.position) < 1) {
                playerStats.health -= Math.max(enemy.damage - (equipped.armor ? equipped.armor.armor : playerStats.armor) * (playerStats.armorTimer > 0 ? 0.2 : 0.1), 0.1);
                if (enemy.type === 'boss') playerStats.stunTimer = 2;
                updateUI();
                if (playerStats.health <= 0) {
                    alert('Game Over! Score: ' + playerStats.kills);
                    resetGame();
                }
            }
        }
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
        for (let i = traps.length - 1; i >= 0; i--) {
            traps[i].timer -= 0.016;
            if (traps[i].timer <= 0) {
                scene.remove(traps[i]);
                traps.splice(i, 1);
            }
        }
    }

    function updateAllies() {
        if (isPaused) return;
        for (let i = allies.length - 1; i >= 0; i--) {
            const ally = allies[i];
            const nearestEnemy = enemies.reduce((closest, enemy) => {
                const dist = ally.position.distanceTo(enemy.position);
                return dist < closest.dist ? { enemy, dist } : closest;
            }, { enemy: null, dist: Infinity });
            if (nearestEnemy.enemy && nearestEnemy.enemy.children[0]) {
                const direction = nearestEnemy.enemy.position.clone().sub(ally.position).normalize();
                ally.position.add(direction.multiplyScalar(0.08));
                ally.attackCooldown -= 0.016;
                if (nearestEnemy.dist < 1 && ally.attackCooldown <= 0) {
                    nearestEnemy.enemy.hitsRemaining -= ally.damage;
                    if (nearestEnemy.enemy.healthBar) {
                        nearestEnemy.enemy.healthBar.scale.x = nearestEnemy.enemy.hitsRemaining / nearestEnemy.enemy.maxHits;
                        nearestEnemy.enemy.healthBar.position.x = -nearestEnemy.enemy.scale.x / 2 + (nearestEnemy.enemy.scale.x * nearestEnemy.enemy.healthBar.scale.x) / 2;
                    }
                    if (nearestEnemy.enemy.hitsRemaining <= 0) {
                        spawnCoin(nearestEnemy.enemy.position);
                        createDeathParticles(nearestEnemy.enemy.position, nearestEnemy.enemy.children[0].material.color.getHex());
                        scene.remove(nearestEnemy.enemy);
                        enemies = enemies.filter(e => e !== nearestEnemy.enemy);
                    }
                    ally.attackCooldown = ally.attackSpeed;
                }
            }
            ally.timer -= 0.016;
            ally.healthBar.scale.x = ally.timer / ally.maxTimer;
            ally.healthBar.position.x = -0.4 + (0.8 * ally.healthBar.scale.x) / 2;
            if (ally.timer <= 0) {
                scene.remove(ally);
                allies.splice(i, 1);
            }
        }
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
        } else if (type === 'trap' && playerStats.coins >= 40) {
            createTrap(playerGroup.position);
            playerStats.coins -= 40;
        } else if (type === 'regen' && playerStats.coins >= 100 && playerStats.regenTimer === 0) {
            playerStats.regenTimer = 10;
            playerStats.coins -= 100;
        } else if (type === 'radar' && playerStats.coins >= 70 && !playerStats.hasRadar) {
            playerStats.hasRadar = true;
            playerStats.coins -= 70;
        } else if (type === 'hardMode') {
            hardMode = !hardMode;
        }
        updateUI();
    }

    function updateUI() {
        const healthElement = document.getElementById('health');
        const coinsElement = document.getElementById('coins');
        const killsElement = document.getElementById('kills');
        const waveElement = document.getElementById('wave');

        if (healthElement) healthElement.textContent = Math.floor(playerStats.health);
        if (coinsElement) coinsElement.textContent = playerStats.coins;
        if (killsElement) killsElement.textContent = playerStats.kills;
        if (waveElement) waveElement.textContent = playerStats.wave;
    }

    function updateInventoryUI() {
        const weaponSlot = document.getElementById('weaponSlot');
        const helmSlot = document.getElementById('helmSlot');
        const armorSlot = document.getElementById('armorSlot');
        const inventoryList = document.getElementById('inventoryList');

        weaponSlot.textContent = `Weapon: ${equipped.weapon ? equipped.weapon.name : 'None'}`;
        helmSlot.textContent = `Helm: ${equipped.helm ? equipped.helm.name : 'None'}`;
        armorSlot.textContent = `Armor: ${equipped.armor ? equipped.armor.name : 'None'}`;
        inventoryList.innerHTML = '';
        inventory.forEach((item, index) => {
            const li = document.createElement('li');
            li.textContent = `${item.name} (${item.rarity})`;
            const equipButton = document.createElement('button');
            equipButton.textContent = 'Equip';
            equipButton.onclick = () => equipItem(index);
            li.appendChild(equipButton);
            inventoryList.appendChild(li);
        });
        updatePlayerVisuals();
    }

    function equipItem(index) {
        const item = inventory[index];
        if (item) {
            equipped[item.type] = item;
            inventory.splice(index, 1);
            updateInventoryUI();
            updatePlayerStats();
        }
    }

    function updatePlayerStats() {
        playerStats.damage = equipped.weapon ? equipped.weapon.damage : 1;
        playerStats.armor = equipped.armor ? equipped.armor.armor : 0;
        playerStats.maxHealth = 100 + (equipped.helm && equipped.helm.bonus ? equipped.helm.bonus : 0);
        playerStats.health = Math.min(playerStats.health, playerStats.maxHealth);
    }

    function updatePlayerVisuals() {
        playerGroup.children.forEach(child => {
            if (child !== player && child !== sword) scene.remove(child);
        });
        if (equipped.weapon) {
            sword.material.color.setHex(equipped.weapon.rarity === 'normal' ? 0xaaaaaa : equipped.weapon.rarity === 'unique' ? 0xffd700 : 0xff0000);
        }
        if (equipped.helm) {
            const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32), new THREE.MeshPhongMaterial({ color: equipped.helm.rarity === 'normal' ? 0x8b4513 : equipped.helm.rarity === 'unique' ? 0x000000 : 0xffff00 }));
            helm.position.y = 0.65;
            playerGroup.add(helm);
        }
        if (equipped.armor) {
            const armor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), new THREE.MeshPhongMaterial({ color: equipped.armor.rarity === 'normal' ? 0x808080 : equipped.armor.rarity === 'unique' ? 0x00ffff : 0xff4500 }));
            playerGroup.add(armor);
        }
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
        if (list) {
            list.innerHTML = '';
            leaderboard.forEach(score => {
                const li = document.createElement('li');
                li.textContent = score;
                list.appendChild(li);
            });
        }
    }

    function checkAchievements() {
        let updated = false;

        if (playerStats.goldenCubeKills >= 10 && !achievements.goldenSlayer) {
            achievements.goldenSlayer = true;
            alert('Achievement Unlocked: Golden Slayer! (10 Golden Kills)');
            updated = true;
        }

        if (playerStats.wave >= 20 && !achievements.waveMaster) {
            achievements.waveMaster = true;
            alert('Achievement Unlocked: Wave Master! (Reached Wave 20)');
            updated = true;
        }

        if (updated) {
            localStorage.setItem('cubeDefenseAchievements', JSON.stringify(achievements));
            updateAchievementUI();
        }
    }

    function updateAchievementUI() {
        const list = document.getElementById('achievementProgressList');
        if (!list) return;

        list.innerHTML = '';

        const goldenLi = document.createElement('li');
        goldenLi.textContent = `Golden Slayer: ${playerStats.goldenCubeKills}/10 Golden Kills ${achievements.goldenSlayer ? '(Unlocked)' : ''}`;
        list.appendChild(goldenLi);

        const waveLi = document.createElement('li');
        waveLi.textContent = `Wave Master: Wave ${playerStats.wave}/20 ${achievements.waveMaster ? '(Unlocked)' : ''}`;
        list.appendChild(waveLi);
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
        if (playerStats.wave > 5 && Math.random() < 0.2) spawnEnemy('stealth');
        if (playerStats.wave > 7 && Math.random() < 0.15) spawnEnemy('explosive');
        if (playerStats.wave > 3 && Math.random() < 0.2) spawnEnemy('knight');
        if (playerStats.wave > 4 && Math.random() < 0.25) spawnEnemy('bodyguard');
        waveTimer = 10;
        playerStats.wave++;
        document.getElementById('levelDisplay').textContent = `Level ${playerStats.wave - 1}`;
        showLevelDisplay();
        checkAchievements();
    }

    let spawnTimer = 0;
    function animate() {
        requestAnimationFrame(animate);
        if (!isPaused) {
            updatePlayer();
            updateEnemies();
            updateAllies();

            dayNightCycle = (dayNightCycle + 0.0005) % 1;
            scene.background = new THREE.Color().lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0x191970), dayNightCycle);
            ambientLight.intensity = 0.5 - dayNightCycle * 0.3;

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
            if (playerStats.weaponTimer <= 0 && !equipped.weapon && playerStats.damage > 1) {
                playerStats.damage = 1;
                sword.scale.set(1, 1, 1);
            }
        }
        renderer.render(scene, camera);
    }

    renderer.render(scene, camera);
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
