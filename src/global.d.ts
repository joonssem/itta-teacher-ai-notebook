import type { IttaBridge } from './shared/contracts';

declare global {
  interface Window {
    itta: IttaBridge;
  }
}

export {};

