// Stub screen: shows the title only. The real screen replaces this file.

/**
 * @param {HTMLElement} view  The emptied <main class="app-view">.
 * @returns {void | (() => void)} Optional cleanup.
 */
export function render(view) {
  view.innerHTML = '<div class="screen"><h1 class="screen-title">Today</h1></div>';
}
