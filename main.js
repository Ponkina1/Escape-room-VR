import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

// Variables globales del juego
const clock = new THREE.Clock();
let gameTimer = 90; // 90 segundos (1:30 minutos)
let isGameOver = false;
let villainModel = null;
const villainSpeed = 0.1;

// Escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog("#13678A", 1, 20);

// Cámara
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 0);


// Renderer con optimizaciones móviles
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



/////////////////////////////////////////
let audioContext;

// Crear un listener de audio y añadirlo a la cámara
const listener = new THREE.AudioListener();
camera.add(listener);

// Crear un objeto de audio y vincularlo al listener
const backgroundMusic = new THREE.Audio(listener);

// Cargar un archivo de audio
const audioLoader = new THREE.AudioLoader();
audioLoader.load('SawThemeSong.mp3', function (buffer) {
  backgroundMusic.setBuffer(buffer);
  backgroundMusic.setLoop(true); // Música en bucle
  backgroundMusic.setVolume(0.5); // Volumen de la música
  backgroundMusic.play(); // Reproducir
});

///////////////////////////////////////

// Sistema de UI en VR
class VRMessageSystem {
  constructor(scene, camera) {
    // Panel de mensajes principal
    const panelGeometry = new THREE.PlaneGeometry(2, 0.5);
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.messagePanel = new THREE.Mesh(panelGeometry, panelMaterial);
    this.messagePanel.visible = false;
    scene.add(this.messagePanel);

    // Canvas para el texto del mensaje
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    this.messageTexture = new THREE.CanvasTexture(canvas);
    this.messageContext = context;
    const messageMaterial = new THREE.MeshBasicMaterial({
      map: this.messageTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const messageGeometry = new THREE.PlaneGeometry(2, 0.5);
    this.messageText = new THREE.Mesh(messageGeometry, messageMaterial);
    this.messagePanel.add(this.messageText);

    // Panel del contador
    const counterGeometry = new THREE.PlaneGeometry(0.6, 0.2);
    const counterMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.counterPanel = new THREE.Mesh(counterGeometry, counterMaterial);
    this.counterPanel.position.set(-1.5, 1.5, -2);
    scene.add(this.counterPanel);

    // Texto del contador
    const counterCanvas = document.createElement('canvas');
    counterCanvas.width = 256;
    counterCanvas.height = 64;
    this.counterTexture = new THREE.CanvasTexture(counterCanvas);
    const counterTextMaterial = new THREE.MeshBasicMaterial({
      map: this.counterTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.counterText = new THREE.Mesh(counterGeometry, counterTextMaterial);
    this.counterPanel.add(this.counterText);

    // Panel del temporizador
    const timerGeometry = new THREE.PlaneGeometry(0.6, 0.2);
    const timerMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.timerPanel = new THREE.Mesh(timerGeometry, timerMaterial);
    this.timerPanel.position.set(1.5, 1.5, -2);
    scene.add(this.timerPanel);

    // Texto del temporizador
    const timerCanvas = document.createElement('canvas');
    timerCanvas.width = 256;
    timerCanvas.height = 64;
    this.timerTexture = new THREE.CanvasTexture(timerCanvas);
    const timerTextMaterial = new THREE.MeshBasicMaterial({
      map: this.timerTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.timerText = new THREE.Mesh(timerGeometry, timerTextMaterial);
    this.timerPanel.add(this.timerText);

    this.camera = camera;
    this.updateCounter(0, 3);
  }

  showMessage(message, duration = 3000) {
    this.messageContext.clearRect(0, 0, 512, 128);
    this.messageContext.fillStyle = 'white';
    this.messageContext.font = '32px Arial';
    this.messageContext.textAlign = 'center';
    this.messageContext.textBaseline = 'middle';
    this.messageContext.fillText(message, 256, 64);
    this.messageTexture.needsUpdate = true;

    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    this.messagePanel.position.copy(this.camera.position).add(cameraDirection.multiplyScalar(-2));
    this.messagePanel.lookAt(this.camera.position);
    this.messagePanel.visible = true;

    setTimeout(() => {
      this.messagePanel.visible = false;
    }, duration);
  }

  updateCounter(collected, total) {
    const ctx = this.counterTexture.image.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Objetos: ${collected}/${total}`, 128, 32);
    this.counterTexture.needsUpdate = true;
  }

  updateTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = Math.floor(timeLeft % 60);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const ctx = this.timerTexture.image.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = timeLeft <= 10 ? 'red' : 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeString, 128, 32);
    this.timerTexture.needsUpdate = true;
  }

  update() {
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    // Actualizar posición del contador
    this.counterPanel.position.copy(this.camera.position);
    this.counterPanel.position.y += 0.3;
    this.counterPanel.position.x -= 0.5;
    this.counterPanel.lookAt(this.camera.position);

    // Actualizar posición del temporizador
    this.timerPanel.position.copy(this.camera.position);
    this.timerPanel.position.y += 0.3;
    this.timerPanel.position.x += 0.5;
    this.timerPanel.lookAt(this.camera.position);
  }
}

// Iluminación optimizada para móviles
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

const allCollectibles = [
  "CollectibleGeometry", 
  "SphereCollectible", 
  "CubeCollectible"
];

// Crear sistema de mensajes
const messageSystem = new VRMessageSystem(scene, camera);

// Crear objetos coleccionables
const geometry = new THREE.DodecahedronGeometry(0.5);
const material = new THREE.MeshPhongMaterial({ 
  color: 0x00ff00,
  shininess: 100
});

const collectibleObject = new THREE.Mesh(geometry, material);
collectibleObject.position.set(0, 2, -6);
collectibleObject.name = "CollectibleGeometry";
scene.add(collectibleObject);

const sphereGeometry = new THREE.SphereGeometry(0.5);
const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 100 });
const sphereCollectible = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereCollectible.position.set(-10, 2, 10);
sphereCollectible.name = "SphereCollectible";
scene.add(sphereCollectible);

const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff, shininess: 100 });
const cubeCollectible = new THREE.Mesh(cubeGeometry, cubeMaterial);
cubeCollectible.position.set(9, 2, 10);
cubeCollectible.name = "CubeCollectible";
scene.add(cubeCollectible);

// Puerta
const doortexture = new THREE.TextureLoader().load('Uv/PuertaThreeJS.png');
const doorGeometry = new THREE.BoxGeometry(4, 7, 1);
const doorMaterial = new THREE.MeshPhongMaterial({ map: doortexture });
const door = new THREE.Mesh(doorGeometry, doorMaterial);
door.name = "DoorCollectible";
door.position.set(-0.5, 4, -9);
scene.add(door);

// Variables para el sistema de mirada
let lookingAtObject = null;
let lookStartTime = 0;
const lookDuration = 2000;

// Barra de progreso
const progressBar = new THREE.Mesh(
  new THREE.PlaneGeometry(0.2, 0.02),
  new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
);
progressBar.rotation.x = -Math.PI / 2;
progressBar.visible = false;
scene.add(progressBar);

// Funciones del juego
function endGame(won = false) {
  isGameOver = true;
  if (won) {
    messageSystem.showMessage("¡Has ganado! ¡Escapaste a tiempo!");
  } else {
    messageSystem.showMessage("¡Game Over! ¡La villana te atrapó!");
  }
  setTimeout(() => {
    location.reload();
  }, 3000);
}

function checkDoorCondition() {
  const requiredItems = ["CollectibleGeometry", "SphereCollectible", "CubeCollectible"];
  const allCollected = requiredItems.every(item => collectedItems.includes(item));
  
  if (allCollected) {
    const door = scene.getObjectByName("DoorCollectible");
    if (door) {
      door.material.color.setHex(0xff0000);
    }
    endGame(true);
  } else {
    const missing = requiredItems.filter(item => !collectedItems.includes(item)).length;
    messageSystem.showMessage(`Te faltan ${missing} objetos por recolectar`);
  }
}

function updateVillain() {
  if (!villainModel || !isGameOver) return;
  
  const villainPos = villainModel.position;
  const playerPos = camera.position;
  const direction = new THREE.Vector3()
    .subVectors(playerPos, villainPos)
    .normalize();
  
  villainModel.position.add(direction.multiplyScalar(villainSpeed));
  villainModel.lookAt(playerPos);
  
  if (villainPos.distanceTo(playerPos) < 1) {
    endGame(false);
  }
}

function pickUpObject(object) {
  collectedItems.push(object.name);
  messageSystem.showMessage(`¡Objeto recolectado!`);
  messageSystem.updateCounter(collectedItems.length, allCollectibles.length);

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

        if (allCollectibles.includes(pickedObject.name)) {
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

        if (detectedObject.name === "DoorCollectible") {
          checkDoorCondition();
        } else if (allCollectibles.includes(detectedObject.name)) {
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

/////////////////////////////////////////////////////////
// Cargar las texturas
const textureLoader = new THREE.TextureLoader();

// Cargar las texturas de Pared y Piso
const paredTexture = new THREE.TextureLoader().load('Uv/Paredes.png');
const pisoTexture = new THREE.TextureLoader().load('Uv/Piso.png');
const almacenTexture = new THREE.TextureLoader().load('Uv/Almacen.png');
const cajaTexture = new THREE.TextureLoader().load('Uv/Caja.png');
const mesaTexture = new THREE.TextureLoader().load('Uv/Mesa.png');
const poster1Texture = new THREE.TextureLoader().load('Uv/Poster1.png');
const poster2Texture = new THREE.TextureLoader().load('Uv/Poster2.png');
const poster3Texture = new THREE.TextureLoader().load('Uv/Poster3.png');
const placaCodigoTexture = new THREE.TextureLoader().load('Uv/PlacaCodigo.png');
const placaEngranajeTexture = new THREE.TextureLoader().load('Uv/PlacaEngranaje.png');
const placaSalidaTexture = new THREE.TextureLoader().load('Uv/PlacaSalida.png');

// Función para aplicar las texturas al escenario
function applyTexturesToScene(scene) {
  scene.traverse((child) => {
    if (child.isMesh) {
      // Asignar la textura de la pared al mesh llamado 'pared'
      if (child.name === 'Pared') {
        child.material = new THREE.MeshStandardMaterial({
          map: paredTexture
        });
      }
      // Asignar la textura del piso al mesh llamado 'pisos'
      if (child.name === 'Pisos') {
        child.material = new THREE.MeshStandardMaterial({
          map: pisoTexture
        });
      }
    }
  });
}

// Función para aplicar texturas a los meshes de un objeto
function applyTexturesToObject(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      // Asignar las texturas a los meshes correspondientes
      if (child.name === 'AlmacenArmario') {
        child.material = new THREE.MeshStandardMaterial({
          map: almacenTexture
        });
      }
      if (child.name === 'AlmacenArmario1') {
        child.material = new THREE.MeshStandardMaterial({
          map: almacenTexture
        });
      }
      if (child.name === 'AlmacenArmario2') {
        child.material = new THREE.MeshBasicMaterial({
          map: almacenTexture
        });
      }
      if (child.name === 'AlmacenArmario3') {
        child.material = new THREE.MeshBasicMaterial({
          map: almacenTexture
        });
      }
      if (child.name === 'Caja') {
        child.material = new THREE.MeshBasicMaterial({
          map: cajaTexture
        });
      }
      if (child.name === 'Caja2') {
        child.material = new THREE.MeshBasicMaterial({
          map: cajaTexture
        });
      }
      if (child.name === 'Caja3') {
        child.material = new THREE.MeshBasicMaterial({
          map: cajaTexture
        });
      }
      if (child.name === 'Caja4') {
        child.material = new THREE.MeshBasicMaterial({
          map: cajaTexture
        });
      }
      if (child.name === 'AlmacenArmario4') {
        child.material = new THREE.MeshBasicMaterial({
          map: almacenTexture
        });
      }
      if (child.name === 'Mesa') {
        child.material = new THREE.MeshBasicMaterial({
          map: mesaTexture
        });
      }
      if (child.name === 'Poster') {
        child.material = new THREE.MeshBasicMaterial({
          map: poster1Texture
        });
      }
      if (child.name === 'Poster2') {
        child.material = new THREE.MeshBasicMaterial({
          map: poster2Texture
        });
      }
      if (child.name === 'Poster3') {
        child.material = new THREE.MeshBasicMaterial({
          map: poster3Texture
        });
      }
      if (child.name === 'PanelAcertijo') {
        child.material = new THREE.MeshBasicMaterial({
          map: placaCodigoTexture
        });
      }
      if (child.name === 'PanelServicio') {
        child.material = new THREE.MeshBasicMaterial({
          map: placaEngranajeTexture
        });
      }
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: placaSalidaTexture
        });
      }
    }
  });
}


// Cargar escenario base
const loader = new FBXLoader();
loader.load('Objs/Escenario.fbx', (object) => {
  scene.add(object);
  object.position.set(0, 0, 0);
  object.scale.set(0.4, 0.4, 0.4);

    // Aplicar las texturas al escenario cargado
    applyTexturesToScene(object);
    
  worldOctree.fromGraphNode(scene);
});

// Cargar el modelo OBJ de la villana
const objLoader = new OBJLoader();
objLoader.load('Objs/villana.obj', (object) => {
  // Agregar el objeto cargado (villana) a la escena
  scene.add(object);
  object.scale.set(0.4, 0.4, 0.4); // Escalar el modelo si es necesario
  object.position.set(0, 0, 0); // Posición del modelo en la escena
}, undefined, (error) => {
  console.error('Error al cargar el modelo OBJ:', error);
});

const materialP = new THREE.MeshPhongMaterial({map: almacenTexture});
objLoader.load("Objs/Almacen.obj", function (object) {
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material = materialP; // Asigna el material si es necesario
      object.position.set(0, 0, 0);  // Posicionar en la escena
  object.scale.set(0.4, 0.4, 0.4);  // Escalar el objeto
    }
  });
  scene.add(object);
});

const materialq = new THREE.MeshPhongMaterial({map: cajaTexture});
objLoader.load("Objs/cajas.obj", function (object) {
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material = materialq; // Asigna el material si es necesario
      object.position.set(0, 0, 0);  // Posicionar en la escena
  object.scale.set(0.4, 0.4, 0.4);  // Escalar el objeto
    }
  });
  scene.add(object);
});

const materialr = new THREE.MeshPhongMaterial({color: "gray"});
objLoader.load("Objs/Engranajes.obj", function (object) {
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material = materialr; // Asigna el material si es necesario
      object.position.set(0, 0, 0);  // Posicionar en la escena
  object.scale.set(0.4, 0.4, 0.4);  // Escalar el objeto
    }
  });
  scene.add(object);
});

const materials = new THREE.MeshPhongMaterial({map: mesaTexture});
objLoader.load("Objs/Mesa.obj", function (object) {
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material = materials; // Asigna el material si es necesario
      object.position.set(0, 0, 0);  // Posicionar en la escena
  object.scale.set(0.4, 0.4, 0.4);  // Escalar el objeto
    }
  });
  scene.add(object);
});

const materialf = new THREE.MeshPhongMaterial({map: poster1Texture});
objLoader.load("Objs/posters.obj", function (object) {
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material = materialf; // Asigna el material si es necesario
      object.position.set(0, 0, 0);  // Posicionar en la escena
  object.scale.set(0.4, 0.4, 0.4);  // Escalar el objeto
    }
  });
  scene.add(object);
});

const materialp = new THREE.MeshPhongMaterial({map: placaEngranajeTexture});
objLoader.load("Objs/puzzle.obj", function (object) {
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material = materialp; // Asigna el material si es necesario
      object.position.set(0, 0, 0);  // Posicionar en la escena
  object.scale.set(0.4, 0.4, 0.4);  // Escalar el objeto
    }
  });
  scene.add(object);
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
