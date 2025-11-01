<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import { hierarchy, type HierarchyNode } from 'd3-hierarchy';
  import { curveBumpX, curveBumpY } from 'd3-shape';

  import { Chart, Group, Link, Layer, Rect, Text, Tree } from 'layerchart';
  import { cls } from '@layerstack/tailwind';

  // Local replicas of connector types to avoid depending on internal layerchart utils path
  type ConnectorSweep = 'none' | 'start' | 'end' | 'both';
  type ConnectorType = 'straight' | 'square' | 'beveled' | 'rounded' | 'd3';
  import type { MessagePredictions, TreeMessage } from '@watchful-halloween-2025/types';

  // Public props (Svelte 5 runes)
  let {
    predictions = [] as MessagePredictions,
    orientation = 'vertical' as ComponentProps<typeof Tree>['orientation'],
    layout = 'node' as 'node' | 'cluster',
    sweep = 'none' as ConnectorSweep,
    type = 'd3' as ConnectorType,
    radius = 60,
    className = ''
  } = $props<{
    predictions?: MessagePredictions;
    orientation?: ComponentProps<typeof Tree>['orientation'];
    layout?: 'node' | 'cluster';
    sweep?: ConnectorSweep;
    type?: ConnectorType;
    radius?: number;
    className?: string;
  }>();
  const curve = $derived(orientation === 'vertical' ? curveBumpY : curveBumpX);

  type TreeNode = {
    id: string;
    name: string; // message content
    side: TreeMessage['side'] | undefined;
    children?: TreeNode[];
  };

  function buildTree(messages: MessagePredictions): TreeNode {
    const nodes = new Map<string, TreeNode>();
    const childrenMap = new Map<string, TreeNode[]>();
    const root: TreeNode = { id: 'root', name: 'root', side: undefined, children: [] };

    // Materialize nodes
    for (const m of messages) {
      nodes.set(m.id, { id: m.id, name: m.content || '', side: m.side, children: [] });
    }

    // Assign parent-child relationships
    for (const m of messages) {
      const node = nodes.get(m.id)!;
      const pid = m.parentId;
      if (pid && nodes.has(pid)) {
        const arr = childrenMap.get(pid) ?? [];
        arr.push(node);
        childrenMap.set(pid, arr);
      } else {
        // No parentId or missing parent: treat as top-level under synthetic root
        root.children!.push(node);
      }
    }

    for (const [pid, arr] of childrenMap) {
      const p = nodes.get(pid);
      if (p) p.children = arr;
    }

    return root;
  }

  // Expanded state: expand all nodes by default
  const baseTree = $derived(buildTree(predictions));
  
  // Collect all node IDs to expand everything
  const allNodeIds = $derived(() => {
    const ids = ['root'];
    for (const m of predictions) {
      ids.push(m.id);
    }
    return ids;
  });
  
  let expandedIds = $state<string[]>([]);
  
  // Initialize with all IDs expanded
  $effect(() => {
    expandedIds = allNodeIds();
  });

  // Derived hierarchy data (collapsible)
  const complexDataHierarchy = $derived(
    hierarchy(baseTree, (d) => (expandedIds.includes(d.id) ? d.children : null))
  );

  function getNodeKey(node: HierarchyNode<TreeNode>) {
    return node.data.id + ':' + node.depth;
  }

  function hasChildren(n: HierarchyNode<TreeNode>) {
    return !!(n.data.children && n.data.children.length > 0);
  }

  const nodeHeight = 26;
  const nodeSiblingGap = 16;
  const nodeParentGap = 80;
  const nodeSize = $derived(
    orientation === 'horizontal'
      ? ([nodeHeight + nodeSiblingGap, 200 + nodeParentGap] as [number, number])
      : ([200 + nodeSiblingGap, nodeHeight + nodeParentGap] as [number, number])
  );

  // Measure text width to size nodes dynamically
  let measureCtx: CanvasRenderingContext2D | null = null;
  onMount(() => {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    if (measureCtx) {
      // match Text style: 11px, weight 600
      measureCtx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Noto Sans", Helvetica Neue, Arial, sans-serif';
    }
  });

  function measureTextWidth(text: string): number {
    if (!text || !measureCtx) return Math.max(40, Math.round((text?.length || 0) * 7));
    // normalize newlines to spaces for single-line rendering
    const t = text.replace(/\n/g, ' ');
    const w = measureCtx.measureText(t).width;
    return Math.ceil(w);
  }

  const paddingX = 16; // horizontal padding inside node
  const minWidth = 80;
  function nodeWidthFor(name: string): number {
    const contentWidth = measureTextWidth(name);
    return Math.max(minWidth, contentWidth + paddingX * 2);
  }

  // Highlight the most recent message node (last in list)
  const lastId = $derived(predictions.at(-1)?.id);

  function toggle(id: string) {
    expandedIds = expandedIds.includes(id)
      ? expandedIds.filter((x) => x !== id)
      : [...expandedIds, id];
  }

  function colorForSide(side?: 'left' | 'right') {
    return side === 'left'
      ? { fill: '#eef2ff', stroke: '#6366f1', text: '#3730a3' }
      : side === 'right'
      ? { fill: '#f0fdf4', stroke: '#16a34a', text: '#166534' }
      : { fill: '#ffffff', stroke: '#9ca3af', text: '#374151' };
  }
</script>

<div class={cls('w-full h-full overflow-auto', className)}>
  <div class="w-full h-full" style="padding-left: 50%;">
  <Chart
    padding={{ top: 24, bottom: 24, left: 24, right: 24 }}
    transform={{
      mode: 'canvas',
      motion: { type: 'tween', duration: 800, easing: cubicOut }
    }}
  >
    {#snippet children()}
      <Tree hierarchy={complexDataHierarchy} {orientation} nodeSize={layout === 'node' ? nodeSize : undefined}>
        {#snippet children({ nodes, links })}
          <Layer type={"svg"} class="w-full h-full">
            {#each links as link (getNodeKey(link.source) + '_' + getNodeKey(link.target))}
              {#if link.target.depth > 0}
              <Link
                data={link}
                {orientation}
                {curve}
                {type}
                {sweep}
                {radius}
                motion="tween"
                class="opacity-70"
                style="stroke: #cbd5e1; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; fill: none;"
              />
              {/if}
            {/each}

            {#each nodes as node (getNodeKey(node))}
              {#key getNodeKey(node)}
                {#if node.depth > 0}
                <Group
                  x={(orientation === 'horizontal' ? node.y : node.x) - nodeWidthFor(node.data.name) / 2}
                  y={(orientation === 'horizontal' ? node.x : node.y) - nodeHeight / 2}
                  motion="tween"
                  onclick={() => toggle(node.data.id)}
                  class={cls(hasChildren(node) && 'cursor-pointer')}
                >
                  <Rect
                    width={nodeWidthFor(node.data.name)}
                    height={nodeHeight}
                    rx={10}
                    style={`
                      ${(() => {
                        const c = colorForSide(node.data.side);
                        const strokeWidth = node.data.id === lastId ? 2 : 1.5;
                        return `fill: ${c.fill}; stroke: ${c.stroke}; stroke-width: ${strokeWidth};`;
                      })()}
                    `}
                  />
                  <Text
                    value={node.data.name}
                    x={nodeWidthFor(node.data.name) / 2}
                    y={nodeHeight / 2}
                    dy={-2}
                    textAnchor="middle"
                    verticalAnchor="middle"
                    class="pointer-events-none"
                    style={`
                      ${(() => {
                        const c = colorForSide(node.data.side);
                        return `fill: ${c.text}; font-size: 11px; font-weight: 600;`;
                      })()}
                    `}
                  />
                </Group>
                {/if}
              {/key}
            {/each}
          </Layer>
        {/snippet}
      </Tree>
    {/snippet}
  </Chart>
  </div>
</div>

<style>
  /* No component-scoped styles; colors are inline for clarity */
</style>
