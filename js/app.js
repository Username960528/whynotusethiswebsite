/**
 * Main application logic: 3D scene, animations, glitch effects, project generator
 */

// --- 3D Scene Setup ---
let scene, camera, renderer, shape, composer, glitchPass, starfield;

function init3D() {
     const canvas = document.getElementById('bg-canvas');
     scene = new THREE.Scene();

     // Camera setup
     camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
     camera.position.z = 5;

     // Renderer setup
     renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

     // Create the starfield
     createStarfield();

     // Create a geometric shape (Icosahedron)
     const geometry = new THREE.IcosahedronGeometry(1.5, 0);
     const material = new THREE.MeshStandardMaterial({
          color: 0x4f46e5,
          emissive: 0xdb2777,
          roughness: 0.3,
          metalness: 0.6,
          wireframe: true,
     });
     shape = new THREE.Mesh(geometry, material);
     scene.add(shape);

     // Lighting
     const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
     scene.add(ambientLight);
     const pointLight = new THREE.PointLight(0xffffff, 1);
     pointLight.position.set(5, 5, 5);
     scene.add(pointLight);

     // Post-processing setup
     composer = new THREE.EffectComposer(renderer);
     composer.addPass(new THREE.RenderPass(scene, camera));

     glitchPass = new THREE.GlitchPass();
     glitchPass.enabled = false;
     composer.addPass(glitchPass);

     // Handle window resizing
     window.addEventListener('resize', onWindowResize, false);
     // Handle mouse movement
     document.addEventListener('mousemove', onMouseMove, false);

     animate();
}

// Function to create the starfield
function createStarfield() {
     const starCount = 10000;
     const positions = [];
     const geometry = new THREE.BufferGeometry();

     for (let i = 0; i < starCount; i++) {
          const x = (Math.random() - 0.5) * 2000;
          const y = (Math.random() - 0.5) * 2000;
          const z = (Math.random() - 0.5) * 2000;
          positions.push(x, y, z);
     }

     geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

     // Create a circular texture programmatically
     const canvas = document.createElement('canvas');
     canvas.width = 64;
     canvas.height = 64;
     const context = canvas.getContext('2d');
     const gradient = context.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 2
     );
     gradient.addColorStop(0, 'rgba(255,255,255,1)');
     gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
     gradient.addColorStop(1, 'rgba(255,255,255,0)');
     context.fillStyle = gradient;
     context.fillRect(0, 0, canvas.width, canvas.height);
     const starTexture = new THREE.CanvasTexture(canvas);

     const material = new THREE.PointsMaterial({
          map: starTexture,
          size: 1.5,
          sizeAttenuation: true,
          transparent: true,
          alphaTest: 0.1
     });

     starfield = new THREE.Points(geometry, material);
     scene.add(starfield);
}

// --- Animation Loop ---
const clock = new THREE.Clock();
function animate() {
     const elapsedTime = clock.getElapsedTime();

     // Animate the shape
     shape.rotation.y = .2 * elapsedTime;
     shape.rotation.x = .2 * elapsedTime;

     // Animate the starfield for a parallax effect
     if (starfield) {
          starfield.rotation.y = -0.02 * elapsedTime;
     }

     // Use composer to render the scene with effects
     composer.render();
     requestAnimationFrame(animate);
}

// --- Event Handlers ---
function onWindowResize() {
     camera.aspect = window.innerWidth / window.innerHeight;
     camera.updateProjectionMatrix();
     renderer.setSize(window.innerWidth, window.innerHeight);
     composer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
     // Move the shape subtly based on mouse position
     const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
     const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

     gsap.to(shape.rotation, {
          duration: 1,
          x: mouseY * 0.5 + shape.rotation.x * 0.1,
          y: mouseX * 0.5 + shape.rotation.y * 0.1,
          ease: 'power2.out'
     });
}

// --- Scroll Reveal Animation ---
function setupScrollReveal() {
     const revealElements = document.querySelectorAll('.reveal');

     const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
               if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
               }
          });
     }, {
          threshold: 0.1
     });

     revealElements.forEach(el => {
          observer.observe(el);
     });
}

// --- Glitch Synchronization Logic ---
function trigger3DGlitch(isWild) {
     const canvas = document.getElementById('bg-canvas');
     if (glitchPass && canvas) {
          canvas.style.opacity = '0.9';
          glitchPass.enabled = true;
          glitchPass.goWild = isWild;

          setTimeout(() => {
               glitchPass.enabled = false;
               canvas.style.opacity = '0.6';
          }, 400);
     }
}

function runGlitchSequence(iterations) {
     const typewriterDiv = document.querySelector('.typewriter');
     if (!typewriterDiv || typewriterDiv.classList.contains('glitch-active')) {
          return;
     }

     typewriterDiv.style.setProperty('--glitch-iterations', iterations);
     typewriterDiv.classList.add('glitch-active');

     if (iterations === 1) {
          setTimeout(() => trigger3DGlitch(Math.random() < 0.5), 1275);
     } else {
          setTimeout(() => trigger3DGlitch(true), 1275);
          setTimeout(() => trigger3DGlitch(false), 1275 + 2500);
     }

     const animationDuration = 2500 * iterations;
     setTimeout(() => {
          typewriterDiv.classList.remove('glitch-active');
     }, animationDuration + 100);
}

function scheduleSubsequentRandomGlitches() {
     const minDelay = 30000; // 30 seconds
     const maxDelay = 120000; // 2 minutes
     const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;

     setTimeout(() => {
          runGlitchSequence(2);
          scheduleSubsequentRandomGlitches();
     }, randomDelay);
}

// --- Gemini API Project Idea Generator ---
async function generateProjectIdea() {
     const generateCard = document.getElementById('generate-idea-card');
     const content = document.getElementById('generate-idea-content');
     const loader = document.getElementById('generate-idea-loader');

     content.classList.add('hidden');
     loader.classList.remove('hidden');
     generateCard.style.cursor = 'wait';

     const prompt = `Generate a single, creative, and futuristic project idea for a web developer's portfolio. The idea should be concise and inspiring. Respond with a single JSON object with two keys: "name" (a cool, short project name) and "description" (a one-sentence description of the project). Example: {"name": "Project Chronos", "description": "An interactive timeline visualizing the evolution of web technologies."}`;

     const payload = {
          contents: [{
               parts: [{
                    text: prompt
               }]
          }],
          generationConfig: {
               responseMimeType: "application/json",
               responseSchema: {
                    type: "OBJECT",
                    properties: {
                         "name": { "type": "STRING" },
                         "description": { "type": "STRING" }
                    },
                    required: ["name", "description"]
               }
          }
     };

     const apiKey = "";
     const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

     try {
          const response = await fetch(apiUrl, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
          });

          if (!response.ok) {
               throw new Error(`API call failed with status: ${response.status}`);
          }

          const result = await response.json();

          if (result.candidates && result.candidates.length > 0) {
               const idea = result.candidates[0].content.parts[0].text;
               const parsedIdea = JSON.parse(idea);
               addNewProjectCard(parsedIdea.name, parsedIdea.description);
          } else {
               console.error('No ideas generated from API.');
               addNewProjectCard('Ошибка генерации', 'Не удалось получить идею от API. Попробуйте снова.');
          }

     } catch (error) {
          console.error('Error calling Gemini API:', error);
          addNewProjectCard('Сетевая ошибка', 'Не удалось связаться с API. Проверьте консоль.');
     } finally {
          content.classList.remove('hidden');
          loader.classList.add('hidden');
          generateCard.style.cursor = 'pointer';
     }
}

function addNewProjectCard(name, description) {
     const projectsGrid = document.getElementById('projects-grid');
     const generatorCard = document.getElementById('generate-idea-card');

     const newCard = document.createElement('a');
     newCard.href = '#';
     newCard.className = 'project-card block glass-effect rounded-2xl overflow-hidden group';

     newCard.innerHTML = `
        <div class="p-6">
            <h3 class="text-2xl font-bold mb-2 gradient-text">${name}</h3>
            <p class="text-gray-400">${description}</p>
        </div>
    `;

     projectsGrid.insertBefore(newCard, generatorCard);
}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
     const generateCard = document.getElementById('generate-idea-card');
     if (generateCard) {
          generateCard.addEventListener('click', generateProjectIdea);
     }

     // --- Self-Destructing Content Modal Setup ---
     if (typeof setupContentModal === 'function') {
          setupContentModal();
     }

     // Wait for the typing animation to finish
     setTimeout(() => {
          // Run the first SINGLE glitch sequence immediately
          runGlitchSequence(1);

          // Schedule the FIRST RANDOM (double) glitch with a shorter delay
          const firstRandomMin = 15000; // 15 seconds
          const firstRandomMax = 60000; // 1 minute
          const firstRandomDelay = Math.random() * (firstRandomMax - firstRandomMin) + firstRandomMin;

          setTimeout(() => {
               runGlitchSequence(2);
               scheduleSubsequentRandomGlitches();
          }, firstRandomDelay);

     }, 3500); // Corresponds to the 'typing' animation duration
});

// --- GSAP Loader ---
const gsapScript = document.createElement('script');
gsapScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.9.1/gsap.min.js';
gsapScript.onload = () => {
     init3D();
     setupScrollReveal();
};
document.head.appendChild(gsapScript);
