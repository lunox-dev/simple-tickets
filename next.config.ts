// next.config.ts
import type { NextConfig } from "next";
import fs from "fs";

// Monkey-patch fs.readdirSync to swallow EPERM "scandir" errors
const _orig = fs.readdirSync;

// Overload signatures to match Node's fs.readdirSync
function readdirSync(this: any, path: fs.PathLike): string[];
function readdirSync(this: any, path: fs.PathLike, options: { encoding: BufferEncoding | null; withFileTypes?: false; recursive?: boolean }): string[];
function readdirSync(this: any, path: fs.PathLike, options: { encoding: "buffer"; withFileTypes?: false; recursive?: boolean }): Buffer[];
function readdirSync(this: any, path: fs.PathLike, options: { encoding?: BufferEncoding | "buffer" | null; withFileTypes: true; recursive?: boolean }): fs.Dirent[];
function readdirSync(this: any, path: fs.PathLike, options?: fs.ObjectEncodingOptions & { withFileTypes?: false | undefined } | BufferEncoding | null): string[];
function readdirSync(this: any, path: fs.PathLike, options: fs.ObjectEncodingOptions & { withFileTypes: true }): fs.Dirent[];
function readdirSync(this: any, path: fs.PathLike, options?: any): any {
  try {
    return _orig.apply(this, arguments as any);
  } catch (err: any) {
    if (err.code === "EPERM" && err.syscall === "scandir") {
      console.warn(`⚠️  Ignoring EPERM on scandir "${path}"`);
      if (options && typeof options === "object" && options.withFileTypes) {
        return [];
      }
      return [];
    }
    throw err;
  }
}

fs.readdirSync = readdirSync as typeof fs.readdirSync;

const nextConfig: NextConfig = {
  // your existing config here…
};

export default nextConfig;
