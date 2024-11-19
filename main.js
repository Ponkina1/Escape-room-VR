import * as THREE from "three";

import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";


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


// puntos teletrasporte
const teleportationPoints = [
    new THREE.Vector3(10, 1.5, 10),  // Punto 1
    new THREE.Vector3(-10, 1.5, 10), // Punto 2
    new THREE.Vector3(0, 1.5, -10),  // Punto 3
  ];
  

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

// Controlar joystick para mover la cámara (sin interferir con la rotación controlada por el VR)
let joystickX = 0, joystickY = 0;
const joystickSpeed = 0.1; // Ajusta la velocidad de movimiento

// Detectar el joystick para mover la cámara
window.addEventListener('gamepadconnected', (e) => {
  const gamepad = e.gamepad;

  // Función para mover la cámara con el joystick
  function moveCameraWithJoystick() {
    if (gamepad) {
      joystickX = gamepad.axes[0]; // Movimiento horizontal
      joystickY = gamepad.axes[1]; // Movimiento vertical

      // Desactivar el ratón en pantalla
      renderer.domElement.style.cursor = 'none';

      // Mover la cámara sin cambiar su rotación
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


//////////////////////////////////////////////////
// Crear un área de teletransportación visual
const teleportationAreaGeometry = new THREE.PlaneGeometry(1, 1);
const teleportationAreaMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00, // Color verde
  transparent: true,
  opacity: 0.5
});
const teleportationArea = new THREE.Mesh(teleportationAreaGeometry, teleportationAreaMaterial);
scene.add(teleportationArea);

// Colocar el área al frente del jugador
teleportationArea.position.set(0, 1.5, -3);




const controller = renderer.xr.getController(0);
scene.add(controller);

// Función para teletransportar al jugador
function teleportPlayer(controller) {
  const controllerPosition = controller.position;
  
  // Verificar si el controlador está apuntando hacia el área de teletransportación
  const distance = controllerPosition.distanceTo(teleportationArea.position);

  if (distance < 2 && keyStates["Space"]) { // Si está cerca y se presiona un botón
    // Teletransportar al jugador al punto más cercano
    const closestPoint = teleportationPoints[0]; // Cambiar la lógica para elegir el punto adecuado
    playerCollider.end.set(closestPoint.x, closestPoint.y, closestPoint.z);
    camera.position.copy(playerCollider.end); // Sincronizar la cámara
    console.log("Teleportado a: ", closestPoint);
  }
}


controller.addEventListener('selectstart', (event) => {
    // Este es el momento cuando el jugador presiona un botón
    keyStates["Space"] = true; // Simula la presión de un botón para teletransportarse
  });
  
  controller.addEventListener('selectend', (event) => {
    // Fin de la presión del botón
    keyStates["Space"] = false;
  });
  

/////////////////////////////////////////////////

// Animación
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    updatePlayer(deltaTime);
  }

// Llamar a la lógica de teletransportación
teleportPlayer(controller);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
