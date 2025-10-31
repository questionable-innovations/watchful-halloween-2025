/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { sse } from "cloudflare-workers-sse";
import type { SSEMessage } from "cloudflare-workers-sse";
import type { Greeting } from '@watchful-halloween-2025/types';

const generationLimit = 3;
const acceptsHeader = "text/event-stream";
const predictionAngles = [
	"highlights a concrete next step",
	"amplifies the emotional payoff",
	"frames the idea as a bold statement",
	"turns the concept into a question to provoke thought",
	"adds a vivid sensory detail to make it memorable"
];

export default {
	fetch: sse(handler)
} satisfies ExportedHandler<Env>;

async function* handler(request: Request, env: Env, _ctx: ExecutionContext): AsyncGenerator<SSEMessage> {
	const url = new URL(request.url);
	const generation = Number(url.searchParams.get("generation") ?? "0");
	const prompt = url.searchParams.get("prompt") ?? undefined;
	const inheritedInput = url.searchParams.get("input") ?? undefined;
	const currentInput = generation === 0 ? prompt : inheritedInput;

	if (generation === 0 && !prompt) {
		yield { event: "error", data: { message: "Missing required 'prompt' query parameter." } };
		return;
	}

	if (!currentInput) {
		yield { event: "error", data: { message: "No input available for this generation.", generation } };
		return;
	}

	if (generation === 0) {
		yield { event: "prompt", data: { text: currentInput } };
	}

	const prediction = generatePrediction(currentInput, generation);
	yield {
		event: "prediction",
		data: {
			generation,
			basedOn: currentInput,
			text: prediction
		}
	};

	await sleep(200 + generation * 100);

	if (generation >= generationLimit) {
		yield { event: "complete", data: { generation, text: prediction } };
		return;
	}

	const childUrl = new URL(url);
	childUrl.searchParams.set("generation", String(generation + 1));
	childUrl.searchParams.set("input", prediction);
	childUrl.searchParams.delete("prompt");
	const childRequest = buildChildRequest(request, childUrl.toString());

	for await (const message of streamChildWorker(childRequest, env)) {
		yield message;
	}

	if (generation === 0) {
		yield { event: "complete", data: { generation, text: prediction } };
	}
}

function generatePrediction(input: string, generation: number): string {
	const angle = predictionAngles[generation % predictionAngles.length];
	return `Generation ${generation + 1} ${angle}: ${input}`;
}

function buildChildRequest(parent: Request, url: string): Request {
	const headers = new Headers(parent.headers);
	headers.set("accept", acceptsHeader);
	headers.delete("content-length");
	headers.delete("content-encoding");
	headers.delete("transfer-encoding");

	return new Request(url, {
		method: "GET",
		headers
	});
}

async function* streamChildWorker(request: Request, env: Env): AsyncGenerator<SSEMessage> {
	const response = await env.SELF.fetch(request);

	if (!response.ok) {
		yield {
			event: "error",
			data: { status: response.status, statusText: response.statusText }
		};
		return;
	}

	const body = response.body;
	if (!body) {
		return;
	}

	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let eventName: string | undefined;
	let dataLines: string[] = [];
	let lastId: string | undefined;

	const flush = (): SSEMessage | undefined => {
		if (!dataLines.length && eventName === undefined && lastId === undefined) {
			return undefined;
		}

		const rawData = dataLines.join("\n");
		let parsed: SSEMessage["data"] = rawData.length ? rawData : null;
		if (rawData.length) {
			try {
				parsed = JSON.parse(rawData);
			} catch {
				parsed = rawData;
			}
		}

		const message: SSEMessage = {};
		if (eventName) {
			message.event = eventName;
		}
		if (parsed !== undefined) {
			message.data = parsed;
		}
		if (lastId) {
			message.id = lastId;
		}

		dataLines = [];
		eventName = undefined;
		lastId = undefined;

		return message;
	};

	while (true) {
		const { done, value } = await reader.read();
		if (value) {
			buffer += decoder.decode(value, { stream: !done });
		}
		if (done) {
			buffer += decoder.decode();
		}

		let newlineIndex: number;
		while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
			const rawLine = buffer.slice(0, newlineIndex);
			buffer = buffer.slice(newlineIndex + 1);
			const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

			if (line === "") {
				const message = flush();
				if (message) {
					yield message;
				}
				continue;
			}

			if (line.startsWith(":")) {
				continue;
			}

			const separatorIndex = line.indexOf(":");
			const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
			const valuePart = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).replace(/^\s/, "");

			switch (field) {
				case "event":
					eventName = valuePart || undefined;
					break;
				case "data":
					dataLines.push(valuePart);
					break;
				case "id":
					lastId = valuePart || undefined;
					break;
				case "retry":
					// retry hints are client-side only.
					break;
				default:
					break;
			}
		}

		if (done) {
			break;
		}
	}

	if (buffer.length) {
		const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
		if (line.length) {
			dataLines.push(line);
		}
		buffer = "";
	}

	const trailingMessage = flush();
	if (trailingMessage) {
		yield trailingMessage;
	}

	try {
		reader.releaseLock();
		await body.cancel();
	} catch {
		// stream already closed
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
