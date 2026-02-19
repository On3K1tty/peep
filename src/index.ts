import './styles/core.css';
import { App } from './app/app';

const app = new App('#app');

// Expose for debugging
(window as any).voxelApp = app;
