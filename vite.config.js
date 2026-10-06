import path from "node:path";

// Optional external dependency directory for restricted build environments.
const deps = process.env.FRONTEND_DEPENDENCIES;
export default {
  base: "./",
  resolve: deps
    ? {
        alias: ["react", "react-dom", "lucide-react"].map((name) => ({
          find: new RegExp(`^${name}(/.*)?$`),
          replacement: path.join(deps, name) + "$1",
        })),
      }
    : {},
  // Direct icon imports keep the graph small. Disable Rollup's tree-shaking pass,
  // which stalls on this bounded build environment; minification stays enabled.
  build: {
    target: "es2022",
    rollupOptions: { treeshake: false, maxParallelFileOps: 20 },
  },
};
