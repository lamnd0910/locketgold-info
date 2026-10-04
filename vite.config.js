import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        pricing: resolve(import.meta.dirname, "len-gold/index.html"),
        trust: resolve(import.meta.dirname, "uy-tin/index.html"),
        posts: resolve(import.meta.dirname, "bai-viet/index.html"),
        guide: resolve(import.meta.dirname, "huong-dan/index.html"),
        ctv: resolve(import.meta.dirname, "cong-tac-vien/index.html"),
        contact: resolve(import.meta.dirname, "lien-he/index.html"),
        dns: resolve(import.meta.dirname, "tai-dns/index.html"),
        checkout: resolve(import.meta.dirname, "thanh-toan/index.html"),
        admin: resolve(import.meta.dirname, "quan-tri-locket/index.html"),
      },
    },
  },
  server: {
    host: true,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
