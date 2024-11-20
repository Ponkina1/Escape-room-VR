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
camera.position.set(0, 1.6, 0);

// Renderer with mobile optimizations
const renderer = new THREE.WebGLRenderer({ 
  antialias: false,
  powerPreference: "high-performance",
  precision: "mediump"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Optimized lighting for mobile
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
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

// Crear geometría básica (un dodecaedro) en lugar de la torre
const geometry = new THREE.DodecahedronGeometry(0.5);
const material = new THREE.MeshPhongMaterial({ 
  color: 0x00ff00,
  shininess: 100
});

const collectibleObject = new THREE.Mesh(geometry, material);
collectibleObject.position.set(0, 2, -6);
collectibleObject.name = "CollectibleGeometry";
scene.add(collectibleObject);


// Objeto 1: Esfera
const sphereGeometry = new THREE.SphereGeometry(0.5);
const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 100 });
const sphereCollectible = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereCollectible.position.set(-2, 1, -4);
sphereCollectible.name = "SphereCollectible";
scene.add(sphereCollectible);

// Objeto 2: Cubo
const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff, shininess: 100 });
const cubeCollectible = new THREE.Mesh(cubeGeometry, cubeMaterial);
cubeCollectible.position.set(3, 1.5, -8);
cubeCollectible.name = "CubeCollectible";
scene.add(cubeCollectible);

let lookingAtObject = null;
let lookStartTime = 0;
const lookDuration = 2000;

// Indicador visual (barra de progreso)
const progressBar = new THREE.Mesh(
  new THREE.PlaneGeometry(0.2, 0.02),
  new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
);
progressBar.rotation.x = -Math.PI / 2;
progressBar.visible = false;
scene.add(progressBar);

// Función para recoger objetos
function pickUpObject(object) {
  collectedItems.push(object.name);
  console.log("Recogido:", object.name);
  console.log("Objetos recogidos:", collectedItems);

  if (object.parent) {
    object.parent.remove(object);
  } else {
    scene.remove(object);
  }
}

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
    
    if (INTERSECTION) {
      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        const pickedObject = intersects[0].object;

        if (pickedObject.name === "CollectibleGeometry") {
          window.alert("¡Objeto coleccionable detectado!");
          pickUpObject(pickedObject);
          return;
        } 
      }

      const offsetPosition = { x: -INTERSECTION.x, y: -INTERSECTION.y, z: -INTERSECTION.z, w: 1 };
      const offsetRotation = new THREE.Quaternion();
      const transform = new XRRigidTransform(offsetPosition, offsetRotation);
      
      const teleportSpaceOffset = baseReferenceSpace.getOffsetReferenceSpace(transform);
      renderer.xr.setReferenceSpace(teleportSpaceOffset);
      teleportMarker.visible = false;
    }
  }

  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('selectstart', onSelectStart);
  controller1.addEventListener('selectend', onSelectEnd);
  scene.add(controller1);

  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('selectstart', onSelectStart);
  controller2.addEventListener('selectend', onSelectEnd);
  scene.add(controller2);

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
  camera.position.copy(playerCollider.end);
}

function teleportInVR() {
  if (controller1.userData.isSelecting || controller2.userData.isSelecting) {
    const controller = controller1.userData.isSelecting ? controller1 : controller2;
    
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const teleportPoint = intersects[0].point;
      const tempPlayerCollider = new Capsule(
        new THREE.Vector3(teleportPoint.x, teleportPoint.y + 0.35, teleportPoint.z),
        new THREE.Vector3(teleportPoint.x, teleportPoint.y + 1.6, teleportPoint.z),
        0.35
      );

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

function updateRaycaster() {
  const controller = controller1;
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    const detectedObject = intersects[0].object;

    if (lookingAtObject !== detectedObject) {
      lookingAtObject = detectedObject;
      lookStartTime = performance.now();

      progressBar.visible = true;
      progressBar.position.copy(detectedObject.position).add(new THREE.Vector3(0, 1, 0));
    } else {
      const elapsedTime = performance.now() - lookStartTime;
      const progress = Math.min(elapsedTime / lookDuration, 1);
      progressBar.scale.x = progress;

      if (progress >= 1) {
        progressBar.visible = false;
        if (detectedObject.name === "CollectibleGeometry") {
          pickUpObject(detectedObject);
        } else if (detectedObject.name === "SphereCollectible") {
          pickUpObject(detectedObject);
   } else if (detectedObject.name === "CubeCollectible") {
    pickUpObject(detectedObject);
  }
        lookingAtObject = null;
      }
    }
  } else {
    lookingAtObject = null;
    progressBar.visible = false;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Cargar escenario base
const loader = new FBXLoader();
loader.load('Objs/EscenarioBase.fbx', (object) => {
  scene.add(object);
  object.position.set(0, 0, 0);
  object.scale.set(0.4, 0.4, 0.4);
  worldOctree.fromGraphNode(scene);
});

setupVRControllers();

function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  
  teleportInVR();
  updateRaycaster();
  
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    updatePlayer(deltaTime);
  }
  
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);