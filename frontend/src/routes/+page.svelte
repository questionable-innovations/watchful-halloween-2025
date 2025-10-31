<script lang="ts">
    import { onMount, tick } from "svelte";

    type Side = "left" | "right";
    type Message = { id: string; side: Side; text: string; };

    let input = "";
    let messages: Message[] = [];
    let messagesEnd: HTMLDivElement | null = null;

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
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-gray-100">
    <div class="w-full max-w-2xl bg-white rounded-lg shadow-md flex flex-col overflow-hidden">
        <header class="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            <h1 class="text-lg font-semibold">Chat</h1>
            <button class="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded" on:click={clearChat}>Clear</button>
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
        <form class="px-4 py-3 border-t bg-white flex items-center gap-3" on:submit|preventDefault={() => addMessage("right")}>
            <button
                type="button"
                class="w-28 h-12 flex items-center justify-center bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 flex-shrink-0"
                on:click={() => addMessage("left")}
            >
                Send left
            </button>

            <textarea
                class="flex-1 border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 h-12"
                rows="2"
                bind:value={input}
                placeholder="Type a message..."
                on:keydown={handleKeydown}
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

<style>
    /* small helpers to keep template classes concise */
    .left { justify-content: flex-start; }
    .right { justify-content: flex-end; }
</style>