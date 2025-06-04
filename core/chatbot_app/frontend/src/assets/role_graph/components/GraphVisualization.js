import React, { useRef, useEffect, useState } from 'react';
import { DataSet, Network } from 'vis-network/standalone'; // Use standalone for React

function GraphVisualization({ graphData, onNodeClick }) {
  const visJsContainer = useRef(null);
  const [network, setNetwork] = useState(null);

  useEffect(() => {
    if (visJsContainer.current && graphData) {
      const nodes = [];
      const edges = [];

      // Create nodes
      if (graphData.roles) {
        Object.keys(graphData.roles).forEach(roleName => {
          nodes.push({ id: roleName, label: roleName });
        });

        // Create edges (ideas)
        Object.entries(graphData.roles).forEach(([sourceRole, data]) => {
          if (data.ideas) {
            Object.entries(data.ideas).forEach(([targetRole, ideasList]) => {
              if (ideasList && ideasList.length > 0) {
                ideasList.forEach((idea, index) => {
                    edges.push({
                        from: sourceRole,
                        to: targetRole,
                        label: idea,
                        arrows: 'to',
                        // Add a unique ID for multi-edges
                        id: `${sourceRole}-${targetRole}-idea-${index}`
                    });
                });
              }
            });
          }
        });
      }

      // Use DataSet correctly
      const data = {
        nodes: new DataSet(nodes),
        edges: new DataSet(edges),
      };

      const options = {
        nodes: {
          shape: 'box',
          size: 20,
          font: {
            size: 12,
            color: '#333',
          },
          borderWidth: 1,
          shadow:true
        },
        edges: {
          width: 1,
          shadow:true,
          smooth: {
              type: 'continuous'
          },
          font: {
            size: 10,
            align: 'middle'
          },
          color: { inherit: 'from' },
        },
        physics: {
            enabled: true,
             solver: 'barnesHut',
             barnesHut: {
                 gravitationalConstant: -2000,
                 centralGravity: 0.3,
                 springLength: 100,
                 springConstant: 0.04,
                 damping: 0.09,
                 avoidOverlap: 0.5
             }
           // enabled: false // Disable physics if you want static layout
        },
        interaction: {
           navigationButtons: true,
           keyboard: true
        },
         layout: {
            improvedLayout: true // Use improved layout algorithm
            // hierarchical: { enabled: true } // Uncomment for hierarchical layout if needed
         }
      };

      const networkInstance = new Network(visJsContainer.current, data, options);
      setNetwork(networkInstance);

      // Add event listener for node clicks
      networkInstance.on("selectNode", function (params) {
        if (params.nodes.length === 1) {
          const nodeId = params.nodes[0];
           if (onNodeClick) {
               onNodeClick(nodeId);
           }
        }
      });

       // Add event listener for clicking outside nodes to deselect
       networkInstance.on("deselectNode", function (params) {
           if (params.nodes.length === 0) {
               if (onNodeClick) {
                   onNodeClick(null); // Deselect in parent state
               }
           }
       });


      // Cleanup function to destroy the network instance on component unmount
      return () => {
        if (networkInstance) {
          networkInstance.destroy();
        }
      };
    }
  }, [graphData, onNodeClick]); // Re-run effect if graphData or onNodeClick changes


    // Handle resizing if the container size changes
    useEffect(() => {
        const handleResize = () => {
            if (network) {
                network.fit(); // Adjusts the view to fit all nodes
            }
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [network]);


  return (
    <div ref={visJsContainer} style={{ height: '500px', border: '1px solid lightgray' }}>
      {/* The network visualization will be rendered inside this div */}
    </div>
  );
}

export default GraphVisualization;