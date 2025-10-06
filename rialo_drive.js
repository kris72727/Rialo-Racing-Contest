// Alias for Matter.js modules
const Engine = Matter.Engine,
      Render = Matter.Render,
      World = Matter.World,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Body = Matter.Body;

// Global Game State
const GAME_STATE = {
    RUNNING: 0,
    PAUSED: 1,
    GAMEOVER: 2
};
let currentState = GAME_STATE.RUNNING;
let score = 0;
let gear = 1; // 1 for Forward, -1 for Reverse

// Game variables and Matter.js setup (No changes here, copied from previous)
const canvas = document.getElementById('gameCanvas');
const engine = Engine.create();
const world = engine.world;
const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: '#f5f0e3',
    }
});

// --- RIALO THEME COLORS ---
const RIALO_BLACK = '#000000';
const TERRAIN_COLOR = '#4a3d34'; 
const WHEEL_COLOR = '#333333';
const CAR_COLOR = RIALO_BLACK;

// --- DOM ELEMENTS ---
const gasButton = document.getElementById('gasButton');
const brakeButton = document.getElementById('brakeButton');
const gearButton = document.getElementById('gearButton');
const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');
const resumeButton = document.getElementById('resumeButton');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const scoreDisplay = document.getElementById('score-display');
const gearDisplay = document.getElementById('gear-display');
const finalScore = document.getElementById('final-score');


// --- CAR SETUP (Slight modification to make it global) ---
let carComposite;
let carBody, frontWheel, rearWheel;
let gasOn = false;
let brakeOn = false;
const TORQUE_BASE = 0.05;

function createRialoCar(x, y) {
    // Car body
    carBody = Bodies.rectangle(x, y - 10, 80, 30, {
        chamfer: { radius: 10 },
        density: 0.002,
        label: 'carBody', // Added label for Game Over detection
        render: { fillStyle: CAR_COLOR }
    });

    // Wheels
    frontWheel = Bodies.circle(x + 30, y + 15, 15, { friction: 0.8, frictionAir: 0.01, render: { fillStyle: WHEEL_COLOR } });
    rearWheel = Bodies.circle(x - 30, y + 15, 15, { friction: 0.8, frictionAir: 0.01, render: { fillStyle: WHEEL_COLOR } });

    // Constraints for suspension (Springs between car body and wheels)
    const wheelConstraintFront = Matter.Constraint.create({
        bodyA: carBody, pointA: { x: 30, y: 15 }, bodyB: frontWheel, stiffness: 0.3, length: 0
    });
    const wheelConstraintRear = Matter.Constraint.create({
        bodyA: carBody, pointA: { x: -30, y: 15 }, bodyB: rearWheel, stiffness: 0.3, length: 0
    });

    carComposite = Composite.create({ label: 'Car' });
    Composite.add(carComposite, [carBody, frontWheel, rearWheel, wheelConstraintFront, wheelConstraintRear]);

    World.add(world, carComposite);
}

// --- TERRAIN GENERATION (Now generates "mountains") ---
const terrainBodies = [];
const TERRAIN_SEGMENT_WIDTH = 50;
const TERRAIN_SEGMENT_HEIGHT_VARIATION = 50; // Increased variation for "mountains"
const TERRAIN_DEPTH = 300; 
let lastTerrainX = 0;

function generateTerrain(segments) {
    let lastY = canvas.height - 50; // Starting Y position

    for (let i = 0; i < segments; i++) {
        const x = lastTerrainX + i * TERRAIN_SEGMENT_WIDTH;
        const y = lastY + (Math.random() - 0.5) * TERRAIN_SEGMENT_HEIGHT_VARIATION;

        // Ensure smooth transitions
        const nextY = y + (Math.random() - 0.5) * TERRAIN_SEGMENT_HEIGHT_VARIATION;
        const avgY = (y + nextY) / 2;

        const ground = Bodies.rectangle(
            x + TERRAIN_SEGMENT_WIDTH / 2, 
            avgY + TERRAIN_DEPTH / 2,    
            TERRAIN_SEGMENT_WIDTH,
            TERRAIN_DEPTH,
            {
                isStatic: true,
                friction: 0.9, // High friction for grip
                render: { fillStyle: TERRAIN_COLOR }
            }
        );
        World.add(world, ground);
        terrainBodies.push(ground);
        lastY = nextY;
    }
    lastTerrainX += segments * TERRAIN_SEGMENT_WIDTH;
}


// --- GAME MANAGEMENT FUNCTIONS ---

function initGame() {
    // Reset state
    currentState = GAME_STATE.RUNNING;
    score = 0;
    gear = 1;
    lastTerrainX = 0;

    // Clear world and terrain
    World.clear(world, false);
    terrainBodies.length = 0;
    
    // Add bounds (invisible walls)
    World.add(world, [
        Bodies.rectangle(canvas.width / 2, 0, canvas.width, 50, { isStatic: true, render: { visible: false } }), // Top
        Bodies.rectangle(0, canvas.height / 2, 50, canvas.height, { isStatic: true, render: { visible: false } }) // Left
    ]);

    // Create the car and initial terrain
    createRialoCar(100, canvas.height - 100);
    generateTerrain(50); // Generates more segments initially
    
    // Reset UI
    overlay.style.display = 'none';
    resumeButton.style.display = 'none';
    gasButton.disabled = false;
    brakeButton.disabled = false;
    gearButton.disabled = false;
}

function gameOver() {
    if (currentState === GAME_STATE.GAMEOVER) return;
    currentState = GAME_STATE.GAMEOVER;
    
    // Stop the engine and controls
    gasOn = false;
    brakeOn = false;
    gasButton.disabled = true;
    brakeButton.disabled = true;
    gearButton.disabled = true;

    // Display Game Over screen
    overlayText.textContent = 'GAME OVER';
    finalScore.textContent = Math.floor(score);
    resumeButton.style.display = 'none';
    overlay.style.display = 'flex';
}

function togglePause() {
    if (currentState === GAME_STATE.GAMEOVER) return;

    if (currentState === GAME_STATE.RUNNING) {
        currentState = GAME_STATE.PAUSED;
        overlayText.textContent = 'PAUSED';
        resumeButton.style.display = 'inline-block';
        overlay.style.display = 'flex';
        // Visually disable controls
        gasButton.disabled = true;
        brakeButton.disabled = true;
        gearButton.disabled = true;
    } else if (currentState === GAME_STATE.PAUSED) {
        currentState = GAME_STATE.RUNNING;
        overlay.style.display = 'none';
        // Re-enable controls
        gasButton.disabled = false;
        brakeButton.disabled = false;
        gearButton.disabled = false;
    }
}

function toggleGear() {
    gear *= -1; // Toggle between 1 (Forward) and -1 (Reverse)
    gearDisplay.textContent = (gear === 1) ? 'F' : 'R';
    gearButton.textContent = (gear === 1) ? 'GEAR (R)' : 'GEAR (F)';
}

// --- CONTROLS AND EVENT LISTENERS ---

// Control event bindings (Handles both mouse and touch)
const bindControl = (element, key, stateName) => {
    const start = () => window[stateName] = true;
    const end = () => window[stateName] = false;
    element.addEventListener('touchstart', start);
    element.addEventListener('touchend', end);
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', end);
};

bindControl(gasButton, 'ArrowRight', 'gasOn');
bindControl(brakeButton, 'ArrowLeft', 'brakeOn');

// UI Button bindings
pauseButton.addEventListener('click', togglePause);
resumeButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', initGame);
gearButton.addEventListener('click', toggleGear);

// Keyboard controls
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'd') { gasOn = true; }
    if (event.key === 'ArrowLeft' || event.key === 'a') { brakeOn = true; }
    if (event.key === 'g' || event.key === 'G') { toggleGear(); }
    if (event.key === 'p' || event.key === 'P') { togglePause(); }
});
document.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'd') { gasOn = false; }
    if (event.key === 'ArrowLeft' || event.key === 'a') { brakeOn = false; }
});


// --- GAME LOOP ---
Events.on(engine, 'beforeUpdate', () => {
    if (currentState !== GAME_STATE.RUNNING) {
        // Skip physics update if paused or game over
        return;
    }

    // 1. Car Movement
    const torqueAmount = TORQUE_BASE * gear;
    
    if (gasOn) {
        Body.setAngularVelocity(rearWheel, rearWheel.angularVelocity + torqueAmount);
    }
    if (brakeOn) {
        // Brake force applied regardless of gear
        Body.setAngularVelocity(rearWheel, rearWheel.angularVelocity - TORQUE_BASE * 0.5 * Math.sign(rearWheel.angularVelocity)); 
        // Also apply a small reverse force if moving forward
        if (gear === 1) {
             Body.setAngularVelocity(rearWheel, rearWheel.angularVelocity - TORQUE_BASE * 0.05); 
        } else {
             Body.setAngularVelocity(rearWheel, rearWheel.angularVelocity + TORQUE_BASE * 0.05); 
        }
    }
    
    // 2. Scoring (Distance)
    // The score is the maximum x-position the car body has reached
    const carX = carBody.position.x;
    if (carX > score) {
        score = carX;
        scoreDisplay.textContent = Math.floor(score / 10); // Display in meters (e.g., divide by 10)
    }

    // 3. Camera Follow
    const targetX = carX - canvas.width * 0.3; // Follow car, offset slightly
    const currentOffsetX = render.bounds.min.x;
    const newOffsetX = currentOffsetX + (targetX - currentOffsetX) * 0.05;

    Render.lookAt(render, {
        min: { x: newOffsetX, y: 0 },
        max: { x: newOffsetX + canvas.width, y: canvas.height }
    });
    
    // 4. Terrain Generation (Continues to build ahead of the car)
    if (carX > lastTerrainX - 500) { 
        generateTerrain(10); // Generate 10 new segments
    }
    
    // 5. Game Over Condition (Car flips over)
    const angleInDegrees = carBody.angle * (180 / Math.PI);
    // If the car's body angle exceeds 90 degrees (flipped) OR falls too far down
    if (Math.abs(angleInDegrees) > 90 || carBody.position.y > canvas.height + 50) {
        gameOver();
    }
});

// Run the game engine and renderer
Engine.run(engine);
Render.run(render);

// Start the game for the first time
initGame();
