import Modality from './Modality';
import ReviewModality from './ReviewModality';
import ModalityRegistry from './ModalityRegistry';

// Export all modality-related components
export {
  Modality,
  ReviewModality,
  ModalityRegistry
};

// Initialize the modality registry
// This can be called in the app startup code
export function initializeModalities() {
  ModalityRegistry.initialize();
} 