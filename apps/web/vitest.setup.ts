import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

beforeAll(() => {
  if (typeof HTMLDialogElement === 'undefined') return; // node-environment test files
  // jsdom does not implement the modal behaviour of <dialog>. Model the parts components rely
  // on: showModal() opens it, close() closes it and fires the native `close` event. Focus
  // trapping and focus return are browser features and are covered by the Playwright tests.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
});
