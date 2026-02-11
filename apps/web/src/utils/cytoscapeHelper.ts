import cytoscape from 'cytoscape';

let extensionsRegistered = false;

export const registerCytoscapeExtensions = async () => {
  if (extensionsRegistered) return;

  // Only run on client — plugin may access DOM / custom elements
  if (typeof window === 'undefined') return;

  try {
    if (typeof cytoscape.use === 'function') {
      // Lazy/dynamic import to avoid SSR/SES issues and to defer execution until client
      const mod = await import('cytoscape-node-html-label');
      const nodeHtmlLabel = (mod && (mod as any).default) ? (mod as any).default : mod;
      // Register plugin
      cytoscape.use(nodeHtmlLabel);
    }
    extensionsRegistered = true;
    console.log('[CytoscapeHelper] Extensions registered successfully');
  } catch (error) {
    console.warn('[CytoscapeHelper] Error registering extensions:', error);
  }
};
