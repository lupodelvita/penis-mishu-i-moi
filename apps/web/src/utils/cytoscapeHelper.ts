import cytoscape from 'cytoscape';

let extensionsRegistered = false;
const EXTENSION_MARK = '__nodeHtmlLabelRegistered';

export const registerCytoscapeExtensions = async () => {
  if (extensionsRegistered) return;

  // Only run on client — plugin may access DOM / custom elements
  if (typeof window === 'undefined') return;

  try {
    const globalWindow = window as Window & { [EXTENSION_MARK]?: boolean };
    if (globalWindow[EXTENSION_MARK]) {
      extensionsRegistered = true;
      return;
    }

    if (typeof cytoscape.use === 'function') {
      // Check if extension is already registered on Cytoscape itself
      const coreProto = (cytoscape as any).Core?.prototype;
      if (coreProto && coreProto.nodeHtmlLabel) {
        extensionsRegistered = true;
        globalWindow[EXTENSION_MARK] = true;
        return;
      }

      // Lazy/dynamic import to avoid SSR/SES issues and to defer execution until client
      const mod = await import('cytoscape-node-html-label');
      const nodeHtmlLabel = (mod && (mod as any).default) ? (mod as any).default : mod;
      // Register plugin
      try {
        cytoscape.use(nodeHtmlLabel);
      } catch (error: any) {
        const message = String(error?.message || error || '').toLowerCase();
        const duplicateRegistration =
          message.includes('already exists in the prototype') ||
          message.includes('can not be overridden');

        if (!duplicateRegistration) {
          throw error;
        }
      }
    }
    extensionsRegistered = true;
    globalWindow[EXTENSION_MARK] = true;
  } catch (error) {
    // Extension registration error silently handled
  }
};
