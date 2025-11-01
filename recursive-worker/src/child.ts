import type { PredictionRequest } from "../../packages/types/src";
import type { SSEMessage } from "cloudflare-workers-sse";

const acceptsHeader = "text/event-stream";

export function buildChildRequest(parent: Request, payload: PredictionRequest): Request {
	const headers = new Headers(parent.headers);
	headers.set("accept", acceptsHeader);
	headers.set("content-type", "application/json");
	headers.delete("content-length");
	headers.delete("content-encoding");
	headers.delete("transfer-encoding");

	return new Request(parent.url, {
		method: "POST",
		headers,
		body: JSON.stringify(payload)
	});
}

export async function* streamChildWorker(request: Request, env: Env): AsyncGenerator<SSEMessage> {
	const response = await env.SELF.fetch(request);

	if (!response.ok) {
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
		return;
	}
}
