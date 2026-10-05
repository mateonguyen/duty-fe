import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// Shared semantic tokens for all PrimeNG modules. Keep aligned with _design-system.scss.
export const BrandPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f1f8f3', 100: '#e3f1e7', 200: '#c3e1ce', 300: '#99c9ad', 400: '#65aa84',
      500: '#08643c', 600: '#064e2f', 700: '#043f26', 800: '#03331f', 900: '#022a19', 950: '#01180f',
    },
    formField: { borderRadius: '8px', paddingX: '0.85rem', paddingY: '0.65rem' },
    colorScheme: {
      light: {
        text: { color: '#18332b', hoverColor: '#08643c', mutedColor: '#596f65', hoverMutedColor: '#355547' },
        content: { background: '#ffffff', hoverBackground: '#f7faf8', borderColor: '#dce6df', color: '#18332b', hoverColor: '#18332b' },
        formField: { background: '#ffffff', borderColor: '#bccfc1', hoverBorderColor: '#65aa84', focusBorderColor: '#08643c', color: '#18332b', placeholderColor: '#596f65' },
        highlight: { background: '#eaf5ee', focusBackground: '#e3f1e7', color: '#08643c', focusColor: '#064e2f' },
      },
    },
  },
  components: { card: { root: { borderRadius: '14px', shadow: '0 2px 5px rgb(24 51 43 / 4%)' } } },
});
