<script lang="ts">
    import { onMount, tick } from "svelte";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import { Button } from '$lib/components/ui/button';
    import { MessageTree } from '$lib';
    import type { MessagePredictions, LinearMessage, PredictionRequest, TreeMessage } from '@watchful-halloween-2025/types';

    type Side = "left" | "right";

    let input = "";
    let messages: LinearMessage[] = [];
    let predictions: MessagePredictions = [];
    let messagesEnd: HTMLDivElement | null = null;
    let isLoadingPredictions = false;

    const chartConfig = {
        desktop: { label: "Desktop", color: "var(--chart-1)" },
        mobile: { label: "Mobile", color: "var(--chart-2)" },
    } satisfies Chart.ChartConfig;
    
    function uuid(): string {
        // Use native crypto.randomUUID when available, fallback to simple RFC4122 v4 generator
        try {
            if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
                return (crypto as any).randomUUID();
            }
        } catch {}

        // fallback
        const bytes = new Uint8Array(16);
        if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
            (crypto as any).getRandomValues(bytes);
        } else {
            for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        // set version and clock_seq_hi_and_reserved bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }

    onMount(() => {
  
        messages = [
            { id: uuid(), side: "left", content: "Hi you can send messages from either side." },
            { id: uuid(), side: "right", content: "Try typing below and use Send left / Send right." }
        ];
        scrollToBottom();
    
    });

    async function addMessage(side: Side) {
        const text = input.trim();
        if (!text) return;
        messages = [...messages, { id: uuid(), side, content: text }];
        input = "";
        await tick();
        scrollToBottom();
    }

    function handleKeydown(e: KeyboardEvent) {
        // Enter to send as right by default, Shift+Enter for newline
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            addMessage("right");
        }
    }

    function scrollToBottom() {
        if (messagesEnd) messagesEnd.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    function clearChat() {
        messages = [];
        predictions = [];
    }

    // Combine original messages (as linear chain) with predictions for tree display
    $: fullTree = [
        ...messages.map((m, i) => ({
            id: m.id,
            side: m.side,
            content: m.content,
            parentId: i > 0 ? messages[i - 1].id : undefined
        })),
        ...predictions
    ] as MessagePredictions;

    async function fetchPredictions() {
        if (messages.length === 0) return;
        
        isLoadingPredictions = true;
        predictions = []; // Clear existing predictions
        
        const request: PredictionRequest = {
            history: messages,
            messageBreadth: 2,
            maxDepth: 3
        };

        console.log('Sending prediction request:', request);

        try {
            const response = await fetch('/api/predictions', {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            });

            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let buffer = '';
            const seenIds = new Set<string>();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') {
                            console.log('Stream complete: [DONE]');
                            break;
                        }
                        if (data) {
                            try {
                                const rawMessage = JSON.parse(data);
                                console.log('Received message:', rawMessage);
                                
                                // Handle different response formats
                                let message: TreeMessage;
                                if ('message' in rawMessage && rawMessage.message) {
                                    // Format: { message: { id, side, content, parentId }, depth, branchPath }
                                    message = rawMessage.message;
                                } else if ('history' in rawMessage) {
                                    // Format: { history: [...] } - skip this, it's just echoing the request
                                    console.log('Skipping history echo');
                                    continue;
                                } else {
                                    // Format: { id, side, content, parentId }
                                    message = rawMessage;
                                }
                                
                                if (!message.id) {
                                    console.warn('Message missing ID, skipping:', message);
                                    continue;
                                }
                                
                                if (!seenIds.has(message.id)) {
                                    seenIds.add(message.id);
                                    predictions = [...predictions, message];
                                    console.log('Added to predictions. Total:', predictions.length);
                                } else {
                                    console.log('Duplicate ID, skipping:', message.id);
                                }
                            } catch (e) {
                                console.error('Failed to parse message:', data, e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching predictions:', error);
        } finally {
            isLoadingPredictions = false;
        }
    }

    const greeting = { message: 'Hello from the frontend!' } as const;
</script>

<div class="min-h-screen flex flex-col p-4 bg-gray-100 gap-4">
    <div class="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-md flex flex-col overflow-hidden">
        <header class="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            <h1 class="text-lg font-semibold">Chat</h1>
            <div class="flex items-center gap-2">
                <button 
                    class="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed" 
                    onclick={fetchPredictions}
                    disabled={isLoadingPredictions || messages.length === 0}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !isLoadingPredictions && messages.length > 0 && fetchPredictions()}>
                    {isLoadingPredictions ? 'Loading...' : 'Generate Predictions'}
                </button>
                <button class="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded" onclick={clearChat}>Clear</button>
            </div>
        </header>

        <!-- messages -->
        <main class="flex-1 overflow-auto p-4 space-y-4" style="background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);">
            {#each messages as m (m.id)}
                <div class="flex" class:left={m.side === 'left'} class:right={m.side === 'right'} style="justify-content: {m.side === 'right' ? 'flex-end' : 'flex-start'}">
                    <div class="max-w-[70%]">
                        <div class="flex items-end gap-2">
                            {#if m.side === "left"}
                                <div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium">L</div>
                            {/if}
                            <div class="px-3 py-2 rounded-lg break-words"
                                 class:bg-left={m.side === 'left'}
                                 class:bg-right={m.side === 'right'}
                                 style="background: {m.side === 'left' ? '#eef2ff' : '#dcfce7'}; color: #111827;">
                                <div class="whitespace-pre-wrap">{m.content}</div>
                            </div>
                            {#if m.side === "right"}
                                <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">R</div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
            <div bind:this={messagesEnd}></div>
        </main>

        <!-- input -->
        <form class="px-4 py-3 border-t bg-white flex items-center gap-3" onsubmit={() => addMessage("right")}>
            <button
                type="button"
                class="w-28 h-12 flex items-center justify-center bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 flex-shrink-0"
                onclick={() => addMessage("left")}
            >
                Send left
            </button>

            <textarea
                class="flex-1 border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 h-12"
                rows="2"
                bind:value={input}
                placeholder="Type a message..."
                onkeydown={handleKeydown}
                aria-label="Message input"
            ></textarea>

            <button
                type="submit"
                class="w-28 h-12 flex items-center justify-center bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex-shrink-0"
            >
                Send right
            </button>
        </form>
    </div>

    <!-- Message Tree Section -->
    {#if predictions.length > 0}
        <div class="w-full max-w-5xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <h2 class="text-lg font-semibold">Message Tree ({predictions.length} predictions)</h2>
            </div>
            <div class="h-[600px] p-4 bg-white overflow-auto">
                <MessageTree predictions={fullTree} orientation="vertical" />
            </div>
        </div>
    {/if}
</div>

<style>
    /* small helpers to keep template classes concise */
    .left { justify-content: flex-start; }
    .right { justify-content: flex-end; }
</style>