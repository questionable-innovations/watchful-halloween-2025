/**
 * Recursive prediction worker entry point.
 */

import { sse } from "cloudflare-workers-sse";
import type { SSEMessage } from "cloudflare-workers-sse";
import type { PredictionRequest } from "../../packages/types/src";
import { generatePredictions } from "./prediction";
import { buildChildRequest, streamChildWorker } from "./child";

const absoluteMaxDepth = 3;
const absoluteMaxBreadth = 2;

export default {
	fetch: sse(handler)
} satisfies ExportedHandler<Env>;

async function* handler(request: Request, env: Env, _ctx: ExecutionContext): AsyncGenerator<SSEMessage> {
	if (request.method !== "POST") {
		return;
	}

	const payload = (await request.json()) as PredictionRequest;
	const history = payload.history;
	const messageBreadth = Math.min(payload.messageBreadth, absoluteMaxBreadth);
	const maxDepth = Math.min(payload.maxDepth, absoluteMaxDepth);
	const depth = payload.depth ?? 0;
	const branchPath = payload.branchPath ?? [];

	if (depth === 0) {
		yield { event: "history", data: { history } };
	}

	if (messageBreadth <= 0 || depth >= maxDepth) {
		if (depth === 0) {
			yield { event: "complete", data: { depth, branchCount: 0 } };
		}
		return;
	}


	const predictions = await generatePredictions({ history, depth, messageBreadth, branchPath, ai: env.AI });

	for (const { message, branchPath: nextPath } of predictions) {
		yield {
			event: "prediction",
			data: {
				message,
				depth: depth + 1,
				branchPath: nextPath
			}
		};

		if (depth + 1 >= maxDepth) {
			yield { event: "branchComplete", data: { depth: depth + 1, branchPath: nextPath } };
			continue;
		}

		const childPayload: PredictionRequest = {
			...payload,
			history: [...history, message],
			depth: depth + 1,
			branchPath: nextPath
		};
		const childRequest = buildChildRequest(request, childPayload);

		for await (const messageEvent of streamChildWorker(childRequest, env)) {
			yield messageEvent;
		}

		yield { event: "branchComplete", data: { depth: depth + 1, branchPath: nextPath } };
	}

	if (depth === 0) {
		yield { event: "complete", data: { depth, branchCount: predictions.length } };
	}
}
