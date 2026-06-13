import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

HTMLAnchorElement.prototype.click = () => {};

afterEach(() => {
  window.localStorage.clear();
  cleanup();
});
