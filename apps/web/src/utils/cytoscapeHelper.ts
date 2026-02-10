import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import nodeHtmlLabel from 'cytoscape-node-html-label';

let extensionsRegistered = false;

export const registerCytoscapeExtensions = () => {
  if (extensionsRegistered) return;

  try {
    if (typeof cytoscape.use === 'function') {
        cytoscape.use(fcose);
        cytoscape.use(nodeHtmlLabel);
    }
    extensionsRegistered = true;
    console.log('[CytoscapeHelper] Extensions registered successfully');
  } catch (error) {
    console.warn('[CytoscapeHelper] Error registering extensions:', error);
  }
};
