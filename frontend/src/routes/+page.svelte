<script lang="ts">
    import { onMount, tick } from "svelte";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import { Button } from '$lib/components/ui/button';
    import { MessageTree } from '$lib';
    import type { MessagePredictions, LinearMessage, PredictionRequest, TreeMessage } from '@watchful-halloween-2025/types';
	import { uuid } from "$lib/utils";
    import { messageTemplates } from "$lib/templates";

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
    

    onMount(() => {
        loadTemplate(0);
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

    function loadTemplate(templateIndex: number) {
        const template = messageTemplates[templateIndex];
        if (!template) return;
        
        messages = template.messages.map(msg => ({
            id: uuid(),
            side: msg.side as Side,
            content: msg.content
        }));
        predictions = [];
        
        tick().then(() => scrollToBottom());
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

    // For display in the tree, only show the last message (root) + predictions
    $: treeDisplay = [
        ...(messages.length > 0 ? [{
            id: messages[messages.length - 1].id,
            side: messages[messages.length - 1].side,
            content: messages[messages.length - 1].content,
            parentId: undefined // Make it the root for display
        }] : []),
        ...predictions
    ] as MessagePredictions;

    async function fetchPredictions() {
        if (messages.length === 0) return;
        
        isLoadingPredictions = true;
        predictions = []; // Clear existing predictions
        
        const request: PredictionRequest = {
            history: messages,
            messageBreadth: 2,
            maxDepth: 4
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

    // Handle clicking on a tree node - trace path from root and add to chat
    async function handleNodeClick(nodeId: string) {
        // Find the clicked node in fullTree
        const clickedNode = fullTree.find((n: TreeMessage) => n.id === nodeId);
        if (!clickedNode) return;

        // Build a path from root to this node by tracing parentIds
        const path: TreeMessage[] = [];
        let currentId: string | undefined = nodeId;
        const maxIterations = 100; // Safety limit to prevent infinite loops
        let iterations = 0;
        
        while (currentId && iterations < maxIterations) {
            const node = fullTree.find((n: TreeMessage) => n.id === currentId);
            if (!node) break;
            path.unshift(node); // Add to beginning to maintain order
            currentId = node.parentId;
            iterations++;
        }

        // Convert path to linear messages
        const newMessages: LinearMessage[] = path.map(node => ({
            id: node.id,
            side: node.side,
            content: node.content
        }));

        // Update messages and clear predictions
        messages = newMessages;
        predictions = [];
        
        // Scroll to bottom and wait for UI update
        await tick();
        scrollToBottom();
        
        // Auto-generate new predictions
        await fetchPredictions();
    }
</script>

<div class="min-h-screen p-4 bg-gray-100">
    <h1 class="text-4xl font-bold text-center mb-4">Human Interaction Simulator</h1>
    
    <div class="flex gap-4 h-[calc(100vh-8rem)]">
        <!-- Chat Section - Left Side -->
        <div class="w-[400px] flex-shrink-0 bg-white rounded-lg shadow-md flex flex-col overflow-hidden">
            <!-- Template Selector Header -->
            <div class="px-4 py-3 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
                <h2 class="text-sm font-medium text-white/90 mb-2">Start with a template:</h2>
                <div class="flex flex-wrap gap-2">
                    {#each messageTemplates as template, index}
                        <button
                            class="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 text-white rounded transition-colors"
                            onclick={() => loadTemplate(index)}
                        >
                            {template.name}
                        </button>
                    {/each}
                </div>
            </div>

            <header class="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <h2 class="text-lg font-semibold">Chat</h2>
                <div class="flex items-center gap-2">
                    <button 
                        class="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed" 
                        onclick={fetchPredictions}
                        disabled={isLoadingPredictions || messages.length === 0}
                        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !isLoadingPredictions && messages.length > 0 && fetchPredictions()}>
                        {isLoadingPredictions ? 'Loading...' : 'Predict'}
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
                    class="w-20 h-12 flex items-center justify-center bg-indigo-600 text-white px-2 py-2 rounded-md hover:bg-indigo-700 flex-shrink-0 text-sm"
                    onclick={() => addMessage("left")}
                >
                    Send L
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
                    class="w-20 h-12 flex items-center justify-center bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 flex-shrink-0 text-sm"
                >
                    Send R
                </button>
            </form>
        </div>

        <!-- Message Tree Section - Right Side -->
        <div class="flex-1 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
            <div class="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <h2 class="text-lg font-semibold">
                    {#if predictions.length > 0}
                        Message Tree ({predictions.length} predictions)
                    {:else}
                        Message Tree
                    {/if}
                </h2>
            </div>
            <div class="flex-1 p-4 bg-white overflow-auto">
                {#if predictions.length > 0}
                    <MessageTree predictions={treeDisplay} orientation="horizontal" onNodeClick={handleNodeClick} />
                {:else}
                    <div class="flex items-center justify-center h-full text-gray-400">
                        <p>Generate predictions to see the message tree</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    /* small helpers to keep template classes concise */
    .left { justify-content: flex-start; }
    .right { justify-content: flex-end; }
</style>