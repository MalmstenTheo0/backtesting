import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Desmonta el árbol de React entre tests para que no se filtre estado entre casos.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
