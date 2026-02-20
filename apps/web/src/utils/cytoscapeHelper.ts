import cytoscape from 'cytoscape';

let extensionsRegistered = false;

export const registerCytoscapeExtensions = async () => {
  if (extensionsRegistered) return;

  // Only run on client — plugin may access DOM / custom elements
  if (typeof window === 'undefined') return;

  try {
    if (typeof cytoscape.use === 'function') {
      // Check if extension is already registered on Cytoscape itself
      const coreProto = (cytoscape as any).Core?.prototype;
      if (coreProto && coreProto.nodeHtmlLabel) {
        extensionsRegistered = true;
        return;
      }

      // Lazy/dynamic import to avoid SSR/SES issues and to defer execution until client
      const mod = await import('cytoscape-node-html-label');
      const nodeHtmlLabel = (mod && (mod as any).default) ? (mod as any).default : mod;
      // Register plugin
      cytoscape.use(nodeHtmlLabel);
    }
    extensionsRegistered = true;
  } catch (error) {
    // Extension registration error silently handled
  }
};
