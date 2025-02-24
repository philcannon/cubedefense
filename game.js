// game.js
window.addEventListener('load', () => {
    console.log("Window loaded, checking PCUI...");
    if (typeof pcui === 'undefined') {
        console.error("PCUI failed to load. Falling back to HTML buttons.");
        initGameWithFallback();
    } else {
        console.log("PCUI loaded successfully.");
        initGame();
    }
});

function initGame() {
    console.log("Initializing Three.js...");
    const scene = new THREE.Scene();
    // ... Rest of the initGame function ...
}

// Include other functions like initGameWithFallback, etc.
