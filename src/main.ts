/* Boot. Every HTML entry loads this; <body data-page> says which page to draw.
   "home" is the landing page, anything else is a project id. */

import '../vendor/design/tokens.css';
import '../vendor/design/badges.css';
import '../vendor/design/iconbutton.css';
import '../vendor/design/themeswitch.css';
import './styles/app.css';
import { projects } from './data/projects.js';
import { renderBar, renderFooter } from './ui/chrome.js';
import { renderHome } from './ui/home.js';
import { renderProject } from './ui/project.js';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point is missing');

const pageId = document.body.dataset['page'] ?? 'home';
// The bar applies the saved or ?theme= mode, so build it before any page
// content that reads the mode (framed demos).
const bar = renderBar();
const main = document.createElement('main');

if (pageId === 'home') {
  renderHome(main);
} else {
  const project = projects.find((p) => p.id === pageId);
  if (!project) throw new Error(`no project with id "${pageId}"`);
  renderProject(main, project);
}

app.append(bar, main, renderFooter());
