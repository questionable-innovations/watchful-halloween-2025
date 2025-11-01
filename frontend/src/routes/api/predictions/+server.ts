import type { RequestHandler } from './$types';
import type { PredictionRequest } from '@watchful-halloween-2025/types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body: PredictionRequest = await request.json();

        const response = await fetch('http://localhost:8787', {
            method: 'POST',
            headers: {
                'Accept': 'text/event-stream',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ error: `HTTP error! status: ${response.status}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Forward the streaming response
        return new Response(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new Response(JSON.stringify({ error: 'Failed to proxy request' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
