import * as THREE from 'three';
import { VRButton } from 'https://unpkg.com/three@0.152.0/examples/jsm/webxr/VRButton.js';
import { Octree } from "https://unpkg.com/three@0.152.0/examples/jsm/math/Octree.js";
import { Capsule } from "https://unpkg.com/three@0.152.0/examples/jsm/math/Capsule.js";
import { FBXLoader } from 'https://unpkg.com/three@0.152.0/examples/jsm/loaders/FBXLoader.js';

const clock = new THREE.Clock();

// Escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog("#FA612D", 1, 20);

// Cámara
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true; // Activar soporte XR
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Luces
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Variables para el jugador
const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const worldOctree = new Octree();
const playerCollider = new Capsule(
  new THREE.Vector3(0, 0.35, 0),
  new THREE.Vector3(0, 1, 0),
  0.35
);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;
const keyStates = {};
let gamepad = null; // Guardar la referencia del gamepad

// Event Listeners
document.addEventListener("keydown", (event) => {
  keyStates[event.code] = true;
});
document.addEventListener("keyup", (event) => {
  keyStates[event.code] = false;
});
window.addEventListener("resize", onWindowResize);

// Función para manejar colisiones del jugador
function playerCollisions() {
  const result = worldOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;
  if (result) {
    playerOnFloor = result.normal.y > 0;
    if (!playerOnFloor) {
      playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
    }
    if (result.depth >= 1e-10) {
      playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
  }
}

// Función para actualizar el jugador
function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1;

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;
    damping *= 0.1;
  }
  playerVelocity.addScaledVector(playerVelocity, damping);

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
  playerCollider.translate(deltaPosition);
  playerCollisions();
  camera.position.copy(playerCollider.end); // Sincronizar cámara con el jugador
}

// Controles del jugador con el mouse virtual (joystick en modo @D)
function controls(deltaTime) {
  const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);
  
  // Movimiento con el ratón virtual
  if (gamepad) {
    const axes = gamepad.axes;

    // Movimiento hacia adelante/atrás con el eje Y del ratón (eje[1] del gamepad)
    if (Math.abs(axes[1]) > 0.1) {
      playerVelocity.add(getForwardVector().multiplyScalar(speedDelta * axes[1]));
    }

    // Movimiento lateral con el eje X del ratón (eje[0] del gamepad)
    if (Math.abs(axes[0]) > 0.1) {
      playerVelocity.add(getSideVector().multiplyScalar(speedDelta * axes[0]));
    }
  }

  // Salto con espacio
  if (playerOnFloor && keyStates["Space"]) playerVelocity.y = 15;
}

// Obtener el vector de dirección (mover hacia adelante)
function getForwardVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  return playerDirection;
}

// Obtener el vector de dirección lateral (mover a los lados)
function getSideVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.cross(camera.up); // Usar el "up" de la cámara para calcular el lado
  playerDirection.y = 0;
  playerDirection.normalize();
  return playerDirection;
}

// Redimensionar ventana
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Cargar objetos
const loader = new FBXLoader();
loader.load('Objs/EscenarioBase.fbx', (object) => {
  scene.add(object);
  object.position.set(0, 0, 0);
  object.scale.set(0.2, 0.2, 0.2);
  worldOctree.fromGraphNode(scene);
});

loader.load('Objs/librito.fbx', (object) => {
  scene.add(object);
  object.position.set(0, 0, 0);
  object.scale.set(0.2, 0.2, 0.2);
});

// Detectar y asignar el gamepad
function detectGamepad() {
  const gamepads = navigator.getGamepads();
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      gamepad = gamepads[i];
      break;
    }
  }
}

// Animación
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  detectGamepad(); // Detecta el gamepad en cada frame
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    controls(deltaTime);
    updatePlayer(deltaTime);
  }
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
