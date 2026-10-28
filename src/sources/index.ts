import type { Source } from "../types.ts";
import { boat } from "./boat.ts";

// Every source the relay takes, each at POST /<name>. A new one is a file in this folder and an entry here.
export const SOURCES: ReadonlyMap<string, Source> = new Map([boat].map((source) => [source.name, source]));
