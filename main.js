import * as THREE from "three";

import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const clock = new THREE.Clock();

// Escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog("#FA612D", 1, 20);

// Cámara
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 0); // Altura estándar de un jugador

// Renderer with mobile optimizations
const renderer = new THREE.WebGLRenderer({ 
  antialias: false,  // Disable antialiasing for better mobile performance
  powerPreference: "high-performance",
  precision: "mediump"  // Use medium precision for better mobile performance
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Optimized lighting for mobile
const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Increased intensity
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Variables para el jugador
const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const worldOctree = new Octree();
const playerCollider = new Capsule(
  new THREE.Vector3(0, 0.35, 0),
  new THREE.Vector3(0, 1.6, 0),
  0.35
);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;
const keyStates = {};
const collectedItems = [];


////////////////////////////////////////////
// Función para recoger objetos
function pickUpObject(object) {
  // Agregar el nombre del objeto a la lista
  collectedItems.push(object.name);
  console.log("Recogido:", object.name);
  console.log("Objetos recogidos:", collectedItems);

  // Remover el objeto de la escena
  scene.remove(object);
}
///////////////////////////////////////////

// Marcador de teletransportación
const teleportMarker = new THREE.Mesh(
  new THREE.CircleGeometry(0.25, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true })
);
scene.add(teleportMarker);
teleportMarker.visible = false;

// Controladores VR
let controller1, controller2;
let baseReferenceSpace;
let INTERSECTION;
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();

// Configurar controladores VR
function setupVRControllers() {
  function onSelectStart() {
    this.userData.isSelecting = true;
  }

  function onSelectEnd() {
    this.userData.isSelecting = false;
    
    // Realizar teletransportación si hay una intersección válida
    if (INTERSECTION) {
      // Crear transformación de teleportación
      const offsetPosition = { x: -INTERSECTION.x, y: -INTERSECTION.y, z: -INTERSECTION.z, w: 1 };
      const offsetRotation = new THREE.Quaternion();
      const transform = new XRRigidTransform(offsetPosition, offsetRotation);
      
      // Obtener espacio de referencia desplazado
      const teleportSpaceOffset = baseReferenceSpace.getOffsetReferenceSpace(transform);
      renderer.xr.setReferenceSpace(teleportSpaceOffset);
      
      // Ocultar marcador
      teleportMarker.visible = false;
    }
  }

  // Configurar controlador 1
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('selectstart', onSelectStart);
  controller1.addEventListener('selectend', onSelectEnd);
  scene.add(controller1);

  // Configurar controlador 2
  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('selectstart', onSelectStart);
  controller2.addEventListener('selectend', onSelectEnd);
  scene.add(controller2);

  // Almacenar espacio de referencia base
  renderer.xr.addEventListener('sessionstart', () => {
    baseReferenceSpace = renderer.xr.getReferenceSpace();
  });
}

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
  camera.position.copy(playerCollider.end);
}

// Función de teletransportación de VR
function teleportInVR() {
    if ((controller1.userData.isSelecting || controller2.userData.isSelecting)) {
      const controller = controller1.userData.isSelecting ? controller1 : controller2;
      
      // Configurar matriz temporal del controlador
      tempMatrix.identity().extractRotation(controller.matrixWorld);
  
      // Configurar raycaster desde la posición del controlador
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  
      // Buscar intersecciones con el suelo u objetos en la escena
      const intersects = raycaster.intersectObjects(scene.children, true);
  
      if (intersects.length > 0) {
        // Nueva verificación de colisiones para teletransportación
        const teleportPoint = intersects[0].point;
        const tempPlayerCollider = new Capsule(
          new THREE.Vector3(teleportPoint.x, teleportPoint.y + 0.35, teleportPoint.z),
          new THREE.Vector3(teleportPoint.x, teleportPoint.y + 1.6, teleportPoint.z),
          0.35
        );
  
        // Verificar si el punto de teletransportación es válido (sin colisiones)
        const collisionResult = worldOctree.capsuleIntersect(tempPlayerCollider);
        
        if (!collisionResult) {
          INTERSECTION = teleportPoint;
          teleportMarker.position.copy(INTERSECTION);
          teleportMarker.visible = true;
        } else {
          INTERSECTION = undefined;
          teleportMarker.visible = false;
        }
      } else {
        INTERSECTION = undefined;
        teleportMarker.visible = false;
      }
    }
  }
  


  /////////////////////////////////////////////////////////
  function onSelectEnd() {
    this.userData.isSelecting = false;
  
    // Si hay una intersección válida, verificar si es un objeto recogible
    if (INTERSECTION) {
      // Detectar el objeto bajo el raycaster
      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        const pickedObject = intersects[0].object;
  
        // Verificar si el objeto tiene un nombre válido para recoger
        if (pickedObject.name && pickedObject.name.startsWith("Torre")) {
          pickUpObject(pickedObject);
          return; // No realizar teletransportación si recogemos un objeto
        }
      }
  
      // Teletransportación
      playerCollider.start.copy(new THREE.Vector3(
        INTERSECTION.x,
        INTERSECTION.y + 0.35,
        INTERSECTION.z
      ));
      playerCollider.end.copy(new THREE.Vector3(
        INTERSECTION.x,
        INTERSECTION.y + 1.6,
        INTERSECTION.z
      ));
      camera.position.copy(playerCollider.end);
  
      const offsetPosition = { x: -INTERSECTION.x, y: -INTERSECTION.y, z: -INTERSECTION.z, w: 1 };
      const offsetRotation = new THREE.Quaternion();
      const transform = new XRRigidTransform(offsetPosition, offsetRotation);
  
      const teleportSpaceOffset = baseReferenceSpace.getOffsetReferenceSpace(transform);
      renderer.xr.setReferenceSpace(teleportSpaceOffset);
      teleportMarker.visible = false;
    }
  }
  ////////////////////////////////////////////////////////

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
  object.scale.set(0.4, 0.4, 0.4);
  worldOctree.fromGraphNode(scene);
});

////////////////////////////////
// Cargar el modelo OBJ
const objLoader = new OBJLoader();
objLoader.load('Torre.obj', (object) => {
  object.name = "Torre";
  // Agregar el objeto cargado a la escena
  object.scale.set(0.8, 0.8, 0.8); 
  object.position.set(0, 2, -6);// Escalar el modelo si es necesario
  scene.add(object);
},);
////////////////////////////////////////

// Inicializar controladores VR
setupVRControllers();

// Animación
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  
  teleportInVR(); // Llamar a teleportación antes de actualizar jugador
  
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    updatePlayer(deltaTime);
  }
  
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);