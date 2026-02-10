import cytoscape from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';

let extensionsRegistered = false;

export const registerCytoscapeExtensions = () => {
  if (extensionsRegistered) return;

  try {
    if (typeof cytoscape.use === 'function') {
        // fcose removed to prevent 'Super constructor null' crash
        cytoscape.use(nodeHtmlLabel);
    }
    extensionsRegistered = true;
    console.log('[CytoscapeHelper] Extensions registered successfully');
    extensionsRegistered = true;
    console.log('[CytoscapeHelper] Extensions registered successfully');
  } catch (error) {
    console.warn('[CytoscapeHelper] Error registering extensions:', error);
  }
};
