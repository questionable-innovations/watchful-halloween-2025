<script lang="ts">
    import { onMount, tick } from "svelte";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import { Button } from '$lib/components/ui/button';
    import { MessageTree } from '$lib';
    import type { MessagePredictions } from '@watchful-halloween-2025/types';

    type Side = "left" | "right";
    type Message = { id: string; side: Side; text: string; };
    type MessageOption = { id: string; side: Side; text: string; parent: string; };

    let input = "";
    let messages: Message[] = [];
    let showTree = false;
    let predictions: MessagePredictions = [];
    let messagesEnd: HTMLDivElement | null = null;

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
            { id: uuid(), side: "left", text: "Hi you can send messages from either side." },
            { id: uuid(), side: "right", text: "Try typing below and use Send left / Send right." }
        ];
        scrollToBottom();
    
    });

    async function addMessage(side: Side) {
        const text = input.trim();
        if (!text) return;
        messages = [...messages, { id: uuid(), side, text }];
        input = "";
        await tick();
        scrollToBottom();
    }

    // Build tree predictions by linking each message to the previous one (simple linear chain)
    $: predictions = messages.map((m, i) => ({
        id: m.id,
        side: m.side,
        content: m.text,
        parentId: i > 0 ? messages[i - 1].id : undefined
    }));

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
    }

    const greeting = { message: 'Hello from the frontend!' } as const;
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-gray-100">
    <div class="w-full max-w-2xl bg-white rounded-lg shadow-md flex flex-col overflow-hidden">
        <header class="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            <h1 class="text-lg font-semibold">Chat</h1>
            <button class="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded" onclick={() => (showTree = true)}
                onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showTree = true)}>See Tree</button>
            <button class="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded" onclick={clearChat}>Clear</button>
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
                                <div class="whitespace-pre-wrap">{m.text}</div>
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
</div>

<div class="flex h-screen w-full items-center justify-center">
	<div class="flex flex-col items-center space-y-4">
		<h1 class="text-4xl font-bold">{greeting.message}</h1>
		<Button>Click me</Button>
	</div>
</div>

<style>
    /* small helpers to keep template classes concise */
    .left { justify-content: flex-start; }
    .right { justify-content: flex-end; }
</style>

{#if showTree}
    <!-- Modal overlay -->
    <div class="fixed inset-0 z-40 bg-black/50" role="button" tabindex="0" aria-label="Close modal" onclick={() => (showTree = false)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTree = false; } }}></div>
    <!-- Modal content -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div class="w-full max-w-5xl bg-white rounded-lg shadow-lg overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="message-tree-title" onclick={stopPropagation} onkeydown={stopPropagation}>
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <h2 class="text-lg font-semibold" id="message-tree-title">Message Tree</h2>
                <button class="text-gray-600 hover:text-gray-800" onclick={() => (showTree = false)}>Close</button>
            </div>
            <div class="max-h-[80vh] h-[min(80vh,800px)] p-4 bg-white">
                <MessageTree {predictions} orientation="vertical" />
            </div>
        </div>
    </div>
{/if}