import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

// Variables
const clock = new THREE.Clock();
const teleportationPoints = [
  new THREE.Vector3(10, 1.5, 10),  // Punto 1
  new THREE.Vector3(-10, 1.5, 10), // Punto 2
  new THREE.Vector3(0, 1.5, -10),  // Punto 3
];
const keyStates = {};
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

// Escena, cámara y renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog("#FA612D", 1, 20);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 0);  // Ajustamos la altura de la cámara para el modo VR
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

// Funciones para el jugador
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

// Crear el área de teletransportación
const teleportationAreaGeometry = new THREE.PlaneGeometry(1, 1);
const teleportationAreaMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00, // Color verde
  transparent: true,
  opacity: 0.5
});
const teleportationArea = new THREE.Mesh(teleportationAreaGeometry, teleportationAreaMaterial);
scene.add(teleportationArea);

// Crear un controlador
const controller = renderer.xr.getController(0);
scene.add(controller);

// Raycasting para detectar el área de teletransportación
const raycaster = new THREE.Raycaster();
const controllerGrip = new THREE.Group();
controller.add(controllerGrip);

function teleportPlayer(controller) {
  const controllerPosition = controller.position;
  const direction = controller.rotation.clone().applyMatrix4(new THREE.Matrix4().identity());

  raycaster.ray.origin.copy(controllerPosition);
  raycaster.ray.direction.copy(direction);

  const intersects = raycaster.intersectObject(teleportationArea);

  if (intersects.length > 0) {
    // Si el controlador apunta al área de teletransportación
    if (keyStates["Space"]) {
      // Teletransportar al jugador al punto más cercano
      const closestPoint = teleportationPoints[0]; // Cambiar la lógica para elegir el punto adecuado
      playerCollider.end.set(closestPoint.x, closestPoint.y, closestPoint.z);
      camera.position.copy(playerCollider.end); // Sincronizar la cámara
      console.log("Teleportado a: ", closestPoint);
    }
  }
}

// Evento para detectar la interacción del controlador
controller.addEventListener('selectstart', (event) => {
  keyStates["Space"] = true; // Activar el teletransporte cuando se selecciona
});

controller.addEventListener('selectend', (event) => {
  keyStates["Space"] = false; // Desactivar el teletransporte cuando se suelta
});

// Animación
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    updatePlayer(deltaTime);
  }

  teleportPlayer(controller); // Llamar a la función de teletransportación
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// Función para ajustar la ventana
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

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
