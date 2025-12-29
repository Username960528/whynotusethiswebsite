// import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';
// Using global THREE from index.html

export function initSpaceBackground() {
     if (typeof THREE === 'undefined') {
          console.error('THREE.js is not loaded. Space background disabled.');
          return;
     }
     const scene = new THREE.Scene();
     scene.background = new THREE.Color(0x000000);

     const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
     camera.position.set(0, 0, 400);

     const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderer.setPixelRatio(window.devicePixelRatio);
     renderer.domElement.id = 'space-background';
     renderer.domElement.style.position = 'fixed';
     renderer.domElement.style.top = '0';
     renderer.domElement.style.left = '0';
     renderer.domElement.style.width = '100%';
     renderer.domElement.style.height = '100%';
     renderer.domElement.style.zIndex = '-1';
     document.body.appendChild(renderer.domElement);

     // --- Background Image (Pillars of Creation) ---
     const loader = new THREE.TextureLoader();
     // Using the 1155x2000 rendition for better performance
     const bgTexture = loader.load('https://assets.science.nasa.gov/content/dam/science/missions/webb/science/2022/10/STScI-01GGF8H15VZ09MET9HFBRQX4S3.png/jcr:content/renditions/1155x2000.png');
     bgTexture.colorSpace = THREE.SRGBColorSpace;

     // Create a plane that covers the screen
     // We need to calculate the plane size based on the camera FOV and distance
     const distance = 1000;
     const vFOV = THREE.MathUtils.degToRad(camera.fov);
     const height = 2 * Math.tan(vFOV / 2) * distance + 200; // Add margin for movement
     const width = height * camera.aspect + 200; // Add margin for movement

     const bgGeometry = new THREE.PlaneGeometry(width, height);
     const bgMaterial = new THREE.MeshBasicMaterial({
          map: bgTexture,
          depthWrite: false,
          side: THREE.DoubleSide
     });
     const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial);
     bgPlane.position.z = -distance + 400; // Place it relative to camera
     // Actually, let's just place it at 0,0,0 and move camera back, or place it far back.
     // Camera is at 0,0,400.
     // If we place plane at 0,0,-600, distance is 1000.
     bgPlane.position.set(0, 0, -600);
     scene.add(bgPlane);

     // --- Stars ---
     // Keep some stars for the twinkling effect, but fewer to not distract from the image
     function createStarTexture() {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const context = canvas.getContext('2d');

          const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
          gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

          context.fillStyle = gradient;
          context.fillRect(0, 0, 32, 32);

          return new THREE.CanvasTexture(canvas);
     }

     const starGeometry = new THREE.BufferGeometry();
     const starCount = 1500;
     const starPositions = new Float32Array(starCount * 3);
     const starSizes = new Float32Array(starCount);

     for (let i = 0; i < starCount; i++) {
          starPositions[i * 3] = (Math.random() - 0.5) * 2000;
          starPositions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
          starPositions[i * 3 + 2] = (Math.random() - 0.5) * 1000; // Keep stars closer than background
          starSizes[i] = Math.random() * 3 + 0.5;
     }

     starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
     starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

     const starMaterial = new THREE.ShaderMaterial({
          uniforms: {
               time: { value: 0 },
               pointTexture: { value: createStarTexture() }
          },
          vertexShader: `
            attribute float size;
            varying float vOpacity;
            uniform float time;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = size * (250.0 / -mvPosition.z);
                float twinkle = sin(time * 3.0 + position.x * 0.5 + position.y * 0.3) * 0.3 + 0.7;
                vOpacity = twinkle;
            }
        `,
          fragmentShader: `
            uniform sampler2D pointTexture;
            varying float vOpacity;
            void main() {
                vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                gl_FragColor = vec4(1.0, 1.0, 1.0, vOpacity * 0.9) * texColor;
            }
        `,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          transparent: true
     });

     const stars = new THREE.Points(starGeometry, starMaterial);
     scene.add(stars);

     // --- Animation Loop ---
     let time = 0;
     function animate() {
          time += 0.01; // Increased time speed
          starMaterial.uniforms.time.value += 0.02; // Faster twinkling

          // More noticeable movement
          bgPlane.rotation.z = Math.sin(time * 0.1) * 0.05;
          bgPlane.position.x = Math.sin(time * 0.2) * 50; // Increased movement range
          bgPlane.position.y = Math.cos(time * 0.15) * 30;

          renderer.render(scene, camera);
          requestAnimationFrame(animate);
     }

     animate();

     // Resize Handler
     window.addEventListener('resize', () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);

          // Update background plane size to cover new window
          const vFOV = THREE.MathUtils.degToRad(camera.fov);
          const height = 2 * Math.tan(vFOV / 2) * distance + 200; // Add margin for movement
          const width = height * camera.aspect + 200; // Add margin for movement
          bgPlane.geometry.dispose();
          bgPlane.geometry = new THREE.PlaneGeometry(width, height);
     });
}
