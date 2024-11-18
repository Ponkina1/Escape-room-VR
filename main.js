import * as THREE from "three";
import { Octree } from "https://unpkg.com/three@0.152.0/examples/jsm/math/Octree.js";
import { Capsule } from "https://unpkg.com/three@0.152.0/examples/jsm/math/Capsule.js";
import { FBXLoader } from 'https://unpkg.com/three@0.152.0/examples/jsm/loaders/FBXLoader.js';

const clock = new THREE.Clock(); // objeto q lleva la cuenta del tiempo transcurrido

// escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee); // Color del fondo
scene.fog = new THREE.Fog("#FA612D", 1, 20); // Color de la niebla

// camara
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.rotation.order = "YXZ";
camera.position.set(0, 2.5, 5);

// Luces
///// ajustar luces segun quede mejor ////////
// Añadir luz a la escena
const ambientLight = new THREE.AmbientLight(0x404040, 1); // Luz ambiental suave
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Luz direccional
directionalLight.position.set(5, 5, 5); // Posición de la luz
scene.add(directionalLight);


// Ajustes para q se vea fino XD
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio); // dsegun pixels pantalla
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const timeDisplay = document.getElementById("timeDisplay"); //paso del tiempo

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;

const worldOctree = new Octree(); //divide el espacio tridimensional en celdas de un cubo (octantes)
const playerCollider = new Capsule(
  new THREE.Vector3(0, 0.35, 0),
  new THREE.Vector3(0, 1, 0),
  0.35
); //colision del jugadpr tipo capsula

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;
const keyStates = {};

const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

document.addEventListener("keydown", (event) => {
  keyStates[event.code] = true;
});

document.addEventListener("keyup", (event) => {
  keyStates[event.code] = false;
});

container.addEventListener("mousedown", () => {
  document.body.requestPointerLock();

  mouseTime = performance.now();
});

document.addEventListener("mouseup", () => {
  if (document.pointerLockElement !== null) throwBall();
});

document.body.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === document.body) {
    camera.rotation.y -= event.movementX / 500;
    camera.rotation.x -= event.movementY / 500;
  }
});
window.addEventListener("resize", onWindowResize);

//Ajustes de visualization
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Función para crear cubos (paredes, piso, puerta)
function createCube(width, height, depth, color, position) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(position.x, position.y, position.z);
  return cube;
}

// funcion colisiones del jugador
function playerCollisions() {
  const result = worldOctree.capsuleIntersect(playerCollider);

  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;

    if (!playerOnFloor) {
      playerVelocity.addScaledVector(
        result.normal,
        -result.normal.dot(playerVelocity)
      );
    }

    if (result.depth >= 1e-10) {
      playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
  }
}

// funcion actualizar jugador
function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1; //amortiguamiento

  // Gravedad y resistencia al aire
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;
    damping *= 0.1;
  }

  playerVelocity.addScaledVector(playerVelocity, damping); //amortiguamiento modifica velocidad

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime); //obtener nueva posicion
  playerCollider.translate(deltaPosition);
  playerCollisions(); //revisar colisiones
  camera.position.copy(playerCollider.end);
}

// funcion vector direccion delante
function getForwardVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();

  return playerDirection;
}

// funcion vector direccion lados
function getSideVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  playerDirection.cross(camera.up);

  return playerDirection;
}

// controles
function controls(deltaTime) {
  // gives a bit of air control
  const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

  if (keyStates["KeyW"]) {
    playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
  }

  if (keyStates["KeyS"]) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
  }

  if (keyStates["KeyA"]) {
    playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
  }

  if (keyStates["KeyD"]) {
    playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
  }

  if (playerOnFloor) {
    if (keyStates["Space"]) {
      playerVelocity.y = 15;
    }
  }
}
/////////////////////////////////
// Cargar el modelo FBX
const loader = new FBXLoader();
loader.load('Objs/EscenarioBase.fbx', (object) => {
    // Añadir el modelo cargado a la escena
    scene.add(object);
    // Posicionar el objeto en la escena si es necesario
    object.position.set(0, 0, 0);
    // Escalar si es necesario
    object.scale.set(1, 1, 1);

});
////////////////////////////////

// Función de animación
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    controls(deltaTime);

    updatePlayer(deltaTime);


    //teleportPlayerIfOob();
  }

  // Obtener el tiempo transcurrido en segundos desde que se creó el reloj
  const elapsedTime = clock.getElapsedTime();

  // Convertir el tiempo a minutos y segundos
  const minutes = Math.floor(elapsedTime / 60); // Obtener los minutos
  const seconds = Math.floor(elapsedTime % 60); // Obtener los segundos restantes

  // Mostrar el tiempo en formato de minutos y segundos (por ejemplo, "2:15" para 2 minutos y 15 segundos)
  timeDisplay.innerText = `Time: ${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Actualizar el renderizado
  renderer.render(scene, camera);
}

// Inicializa la animación usando setAnimationLoop
renderer.setAnimationLoop(animate);

// Ajusta el tamaño del renderizado cuando cambia el tamaño de la ventana
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});