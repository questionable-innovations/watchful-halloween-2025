declare module "cloudflare-workers-sse" {
	export interface SSEMessage {
		event?: string;
		data?: unknown;
		id?: string;
	}

	export function sse<Environment = unknown>(
		handler: (
			request: Request,
			env: Environment,
			ctx: ExecutionContext
		) => AsyncGenerator<SSEMessage> | Promise<Response>
	): ExportedHandler<Environment>["fetch"];
}
