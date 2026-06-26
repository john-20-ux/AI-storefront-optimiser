declare module "*.css";

// `s-app-nav` ships in App Bridge / Polaris web components at runtime but is not
// yet declared in the installed @shopify/polaris-types version. Patch the gap so
// the embedded nav in app/routes/app.tsx type-checks. (Matches how
// @shopify/app-bridge-react augments the global JSX namespace for `ui-nav-menu`.)
import type { ReactNode } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": { children?: ReactNode };
    }
  }
}

export {};
