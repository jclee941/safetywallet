import { Hono } from "hono";
import type { Context } from "hono";
import type { Env, AuthContext } from "../../../types";

export type ActionsImageRouteApp = Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

export type ActionsImageContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

export function extractR2Key(fileUrl: string): string {
  if (!fileUrl) {
    return "";
  }

  return fileUrl
    .replace(/^.*\/files\//, "")
    .replace(/^.*\/r2\//, "")
    .replace(/^\/?r2\//, "");
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}
