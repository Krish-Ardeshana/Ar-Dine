import type React from 'react';

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          poster?: string;
          alt?: string;
          'camera-controls'?: boolean | string;
          'auto-rotate'?: boolean | string;
          'shadow-intensity'?: string | number;
          'shadow-softness'?: string | number;
          exposure?: string | number;
          ar?: boolean | string;
          'ar-modes'?: string;
          loading?: 'auto' | 'lazy' | 'eager';
          style?: React.CSSProperties;
        },
        HTMLElement
      >;
    }
  }
}
