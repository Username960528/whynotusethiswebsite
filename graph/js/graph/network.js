import { EDGE_STYLES } from '../config.js';

export function initGraph(container, nodes, edges, callbacks) {
     const data = { nodes, edges };

     const options = {
          nodes: {
               shape: 'box',
               margin: 12,
               widthConstraint: {
                    minimum: 100,
                    maximum: 280
               },
               font: {
                    color: '#e0e0e0',
                    size: 14,
                    face: 'Segoe UI',
                    multi: 'html'
               },
               color: {
                    background: '#1a1a24',
                    border: '#667eea',
                    highlight: {
                         background: '#2a2a3a',
                         border: '#764ba2'
                    }
               },
               borderWidth: 2,
               shadow: {
                    enabled: true,
                    color: 'rgba(102, 126, 234, 0.2)',
                    size: 10
               },
               chosen: {
                    node: function (values, id, selected, hovering) {
                         if (selected) {
                              values.borderWidth = 4;
                              values.borderColor = '#764ba2';
                              values.shadowSize = 20;
                              values.shadowColor = 'rgba(118, 75, 162, 0.5)';
                         }
                    }
               }
          },
          edges: {
               arrows: { to: { enabled: true, scaleFactor: 0.8 } },
               smooth: { type: 'curvedCW', roundness: 0.2 },
               width: 2,
               font: {
                    color: '#666',
                    size: 11,
                    strokeWidth: 3,
                    strokeColor: '#0a0a0f'
               }
          },
          physics: {
               solver: 'forceAtlas2Based',
               forceAtlas2Based: {
                    gravitationalConstant: -50,
                    centralGravity: 0.01,
                    springLength: 150,
                    springConstant: 0.08
               },
               stabilization: { iterations: 100 }
          },
          interaction: {
               hover: true,
               tooltipDelay: 200
          }
     };

     const network = new vis.Network(container, data, options);

     // Event handlers
     if (callbacks.onClick) network.on('click', callbacks.onClick);
     if (callbacks.onSelect) network.on('selectNode', callbacks.onSelect);
     if (callbacks.onDeselect) network.on('deselectNode', callbacks.onDeselect);

     return network;
}
