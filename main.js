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
camera.position.set(0, 1.5, 0);  // Ajustamos la altura de la cámara para el modo VR

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

// Controles del jugador con el joystick (solo mover cámara, no rotar)
let joystickX = 0, joystickY = 0;
const joystickSpeed = 0.1; // Ajustar velocidad de movimiento

// Detectar el joystick para mover la cámara
window.addEventListener('gamepadconnected', (e) => {
  const gamepad = e.gamepad;

  // Configuración del movimiento con el joystick
  function moveCameraWithJoystick() {
    if (gamepad) {
      joystickX = gamepad.axes[0]; // Movimiento horizontal del joystick
      joystickY = gamepad.axes[1]; // Movimiento vertical del joystick

      // Mover la cámara en base al joystick
      camera.position.x += joystickX * joystickSpeed;
      camera.position.z += joystickY * joystickSpeed;
    }
  }

  function update() {
    moveCameraWithJoystick();
    renderer.render(scene, camera);
    requestAnimationFrame(update);
  }

  update();
});

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

// Animación
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    updatePlayer(deltaTime);
  }
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
