import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };


export function uuid(): string {
	// Use native crypto.randomUUID when available, fallback to simple RFC4122 v4 generator
	try {
		if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
			return (crypto).randomUUID();
		}
	} catch { /* empty */ }
	// fallback
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	
	// set version and clock_seq_hi_and_reserved bits
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;

}
