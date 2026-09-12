import type { Preview } from "@storybook/nextjs-vite";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    a11y: { test: "todo" },
    backgrounds: { default: "canvas", values: [{ name: "canvas", value: "#f1efe9" }] },
  },
};
export default preview;
