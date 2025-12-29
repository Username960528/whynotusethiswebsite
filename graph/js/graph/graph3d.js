import { CATEGORY_COLORS } from '../config.js';

let graph3DInstance = null;

export function init3DGraph(container, nodes, edges, callbacks) {
     try {
          // Check if required libraries are loaded
          if (typeof THREE === 'undefined') {
               console.error('THREE.js is not loaded');
               return;
          }
          if (typeof ForceGraph3D === 'undefined') {
               console.error('ForceGraph3D is not loaded');
               return;
          }

          const graphData = {
               nodes: nodes.get().map(n => ({
                    id: n.id,
                    name: n.label,
                    group: n.group,
                    description: n.title,
                    category: n.category,
                    color: n.color,
                    // ForceGraph3D needs x,y,z if they exist to maintain positions, 
                    // but usually it calculates them. 
                    // If we want to sync positions from 2D, it's harder because 2D is 2D.
               })),
               links: edges.get().map(e => ({
                    source: e.from,
                    target: e.to,
                    type: e.edgeType || 'causal'
               }))
          };

          if (!graph3DInstance) {
               const { width, height } = container.getBoundingClientRect();
               graph3DInstance = ForceGraph3D()(container)
                    .width(width)
                    .height(height)
                    .graphData(graphData)
                    .backgroundColor('rgba(0,0,0,0)') // Transparent to show space background
                    .nodeThreeObjectExtend(false)
                    .nodeThreeObject(node => {
                         // Use custom canvas sprite generation for reliability
                         const colorObj = CATEGORY_COLORS[node.category] || node.color || CATEGORY_COLORS['Core'];
                         const bgColor = colorObj.background || '#3498db';
                         const borderColor = colorObj.border || '#2980b9';

                         return createTextSprite(node.name, bgColor, borderColor);
                    })
                    .linkWidth(2.5)
                    .linkColor(link => {
                         const styles = {
                              causal: '#ff6b6b',
                              multiway: '#4a90e2',
                              branchial: '#26de81'
                         };
                         return styles[link.type] || '#888';
                    })
                    .linkDirectionalArrowLength(3.5)
                    .linkDirectionalArrowRelPos(1)
                    .onNodeClick(node => {
                         if (callbacks.onNodeClick) callbacks.onNodeClick(node);

                         const distance = 40;
                         const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
                         graph3DInstance.cameraPosition(
                              { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                              node,
                              3000
                         );
                    })
                    .onBackgroundClick(() => {
                         if (callbacks.onBackgroundClick) callbacks.onBackgroundClick();
                    });

               // Handle resize
               new ResizeObserver(() => {
                    const { clientWidth, clientHeight } = container;
                    graph3DInstance.width(clientWidth);
                    graph3DInstance.height(clientHeight);
               }).observe(container);
          } else {
               graph3DInstance.graphData(graphData);
          }

          return graph3DInstance;
     } catch (error) {
          console.error('Error initializing 3D graph:', error);
          throw error;
     }
}

// Helper to create text sprites using Canvas
function createTextSprite(text, color, borderColor) {
     const canvas = document.createElement('canvas');
     const context = canvas.getContext('2d');

     // High resolution for sharp text
     const fontSize = 60;
     const padding = 30;
     const font = `bold ${fontSize}px "Segoe UI", Sans-Serif`;

     context.font = font;
     const textWidth = context.measureText(text).width;

     canvas.width = textWidth + padding * 2;
     canvas.height = fontSize + padding * 2;

     // Draw background box
     context.fillStyle = color;
     context.strokeStyle = borderColor;
     context.lineWidth = 10;

     // Rounded rectangle
     const x = 5;
     const y = 5;
     const w = canvas.width - 10;
     const h = canvas.height - 10;
     const r = 20;

     context.beginPath();
     context.moveTo(x + r, y);
     context.lineTo(x + w - r, y);
     context.quadraticCurveTo(x + w, y, x + w, y + r);
     context.lineTo(x + w, y + h - r);
     context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
     context.lineTo(x + r, y + h);
     context.quadraticCurveTo(x, y + h, x, y + h - r);
     context.lineTo(x, y + r);
     context.quadraticCurveTo(x, y, x + r, y);
     context.closePath();

     context.fill();
     context.stroke();

     // Draw text
     context.fillStyle = 'white';
     context.font = font;
     context.textAlign = 'center';
     context.textBaseline = 'middle';
     context.fillText(text, canvas.width / 2, canvas.height / 2);

     const texture = new THREE.CanvasTexture(canvas);
     const material = new THREE.SpriteMaterial({ map: texture });
     const sprite = new THREE.Sprite(material);

     // Scale sprite to be reasonable size in 3D space
     // Aspect ratio based on canvas dimensions
     const scaleFactor = 0.1;
     sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);

     return sprite;
}
