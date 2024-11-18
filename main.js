import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';


// Configuración de la escena, la cámara y el renderizador
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2.5, 5); // Colocamos la cámara al centro, pero un poco hacia atrás

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.fog = new THREE.Fog("#FA612D", 1, 20);  // Color de la niebla (negro), distancias de inicio y fin


// Función para crear cubos (paredes, piso, puerta)
function createCube(width, height, depth, color, position) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(position.x, position.y, position.z);
    return cube;
}

// Crear paredes (usando cubos)
const wallThickness = 0.1; // Grosor de las paredes

// Pared frontal (al frente de la cámara)
const frontWall = createCube(10, 5, wallThickness, 0x888888, { x: 0, y: 2.5, z: -5 });
scene.add(frontWall);

// Pared trasera
const backWall = createCube(10, 5, wallThickness, 0x888888, { x: 0, y: 2.5, z: 5 });
scene.add(backWall);

// Pared izquierda
const leftWall = createCube(wallThickness, 5, 10, 0x888888, { x: -5, y: 2.5, z: 0 });
scene.add(leftWall);

// Pared derecha
const rightWall = createCube(wallThickness, 5, 10, 0x888888, { x: 5, y: 2.5, z: 0 });
scene.add(rightWall);

// Piso
const floor = createCube(10, wallThickness, 10, 0x666666, { x: 0, y: 0, z: 0 });
scene.add(floor);

// Techo
const ceiling = createCube(10, wallThickness, 10, 0x666666, { x: 0, y: 5, z: 0 });
scene.add(ceiling);

// Crear puerta (un cubo más pequeño recortado de la pared)
const doorWidth = 2;
const doorHeight = 3;
const doorThickness = 0.1;
const door = createCube(doorWidth, doorHeight, doorThickness, 0x0a7f00, { x: 0, y: 1.5, z: -5 + wallThickness / 2 });
scene.add(door);

// Variables de control de movimiento
const speed = 0.1; // Velocidad de movimiento de la cámara
let moveForward = false; // Bandera para movimiento hacia adelante
const moveDirection = new THREE.Vector3(); // Dirección del movimiento

// Configuración de PointerLockControls
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(camera);

// Activar Pointer Lock cuando se hace clic
document.body.addEventListener('click', () => {
    controls.lock();
});

// Crear un Raycaster para comprobar las colisiones
const raycaster = new THREE.Raycaster();

// Función para verificar las colisiones
function checkCollision() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Obtén la dirección en la que está mirando la cámara

    // Disparar un rayo desde la cámara hacia adelante
    raycaster.ray.origin.copy(camera.position);
    raycaster.ray.direction.copy(direction);

    // Obtener las intersecciones con las paredes (tú puedes agregar más objetos aquí)
    const intersects = raycaster.intersectObjects([frontWall, backWall, leftWall, rightWall, floor, ceiling]);

    // Si hay una colisión, desactivar el movimiento hacia adelante
    if (intersects.length > 0 && intersects[0].distance < speed) {
        moveForward = false;
    }
}

// Función de animación
function animate() {
    // Comprobar si hay colisiones
    checkCollision();

    if (moveForward) {
        // Mover la cámara hacia adelante en la dirección en que está mirando
        controls.moveForward(speed);
    }

    // Actualizar el renderizado
    renderer.render(scene, camera);
}

// Inicializa la animación usando setAnimationLoop
renderer.setAnimationLoop(animate);

// Ajusta el tamaño del renderizado cuando cambia el tamaño de la ventana
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Detectar las teclas presionadas
window.addEventListener('keydown', (event) => {
    if (event.key === 'w' || event.key === 'W') {
        moveForward = true; // Activamos el movimiento hacia adelante
    }
});

// Detectar cuando se deja de presionar las teclas
window.addEventListener('keyup', (event) => {
    if (event.key === 'w' || event.key === 'W') {
        moveForward = false; // Desactivamos el movimiento
    }
});
