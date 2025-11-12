import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// Override the PRIMARY palette (used by default pButton) to match header color
// Base color: #016630 (hover/active slightly darker)
export const BrandPreset = definePreset(Aura, {
  semantic: {
    primary: {
      500: '#016630', // base
      600: '#015a2b', // hover
      700: '#014f26', // active
    },
  },
});
