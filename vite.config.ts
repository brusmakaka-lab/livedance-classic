import { defineConfig } from "vite";
export default defineConfig({
  cacheDir: "temp/vite-cache",
  server: {
    host: "127.0.0.1",
    port: 5581,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5580",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (out, req) => {
            if (req.headers.origin === "http://127.0.0.1:5581")
              out.setHeader("Origin", "http://127.0.0.1:5580");
          });
        },
      },
    },
  },
});
