import { CATEGORY_COLORS } from '../config.js';

export function clusterByCategory(network, category) {
     const clusterOptionsByData = {
          joinCondition: function (childOptions) {
               return childOptions.category === category;
          },
          processProperties: function (clusterOptions, childNodes) {
               const count = childNodes.length;
               const colorObj = CATEGORY_COLORS[category] || CATEGORY_COLORS['Core'];

               return {
                    id: `cluster:${category}`,
                    label: `${category} (${count})`,
                    category: category, // Keep category for unclustering
                    color: colorObj,
                    shape: 'box',
                    font: { size: 18, color: '#ffffff', face: 'Segoe UI' },
                    borderWidth: 3,
                    shadow: true
               };
          },
          clusterNodeProperties: {
               allowSingleNodeCluster: true
          }
     };

     network.cluster(clusterOptionsByData);
}

export function openCluster(network, category) {
     try {
          network.openCluster(`cluster:${category}`);
     } catch (e) {
          console.warn(`Cluster for ${category} not found or already opened.`);
     }
}

export function isClustered(network, category) {
     return network.isCluster(`cluster:${category}`);
}

export function toggleCluster(network, category) {
     if (isClustered(network, category)) {
          openCluster(network, category);
          return false; // Now open
     } else {
          clusterByCategory(network, category);
          return true; // Now clustered
     }
}
