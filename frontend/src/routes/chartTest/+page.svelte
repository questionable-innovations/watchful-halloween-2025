<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { hierarchy, type HierarchyNode } from 'd3-hierarchy';
  import { curveBumpX, curveBumpY, curveStep, curveStepBefore, curveStepAfter } from 'd3-shape';

  import { Chart, Group, Link, Layer, Rect, Text, Tree } from 'layerchart';
  import { Field, RangeField, ToggleGroup, ToggleOption } from 'svelte-ux';
  import { cls } from '@layerstack/tailwind';

  import type { ConnectorSweep, ConnectorType } from 'layerchart/utils/connectorUtils.js';

  import data from "./flare.json"

  let expandedNodeNames = $state(['flare']);

  const complexDataHierarchy = $derived(
    hierarchy(data, (d) => (expandedNodeNames.includes(d.name) ? d.children : null))
  );
  // .sum((d) => d.value)
  // .sort(sortFunc('value', 'desc'));

  let orientation: ComponentProps<typeof Tree>['orientation'] = $state('vertical');
  let curve = $state(curveBumpY);
  let layout = $state('node');
  let selected = $state();
  let sweep: ConnectorSweep = $state('none'); // Sweep direction
  let type: ConnectorType = $state('d3'); // Connector type: 'straight', 'square', 'beveled', 'rounded', 'd3'
  let radius = $state(60); // Corner radius (for 'beveled', 'rounded')

  function getNodeKey(node: HierarchyNode<{ name: string }>) {
    return node.data.name + node.depth;
  }

  const nodeWidth = 120;
  const nodeHeight = 20;
  const nodeSiblingGap = 20;
  const nodeParentGap = 100;
  const nodeSize = $derived(
    orientation === 'horizontal'
      ? ([nodeHeight + nodeSiblingGap, nodeWidth + nodeParentGap] as [number, number])
      : ([nodeWidth + nodeSiblingGap, nodeHeight + nodeParentGap] as [number, number])
  );
</script>

<h2>Basic</h2>

  <div class="max-h-[80vh] h-[min(80vh,800px)] p-4 border rounded-sm overflow-auto relative bg-white">
    <Chart
      class="w-full h-full"
      padding={{ top: 24, left: nodeWidth / 2, right: nodeWidth / 2 }}
      transform={{
        mode: 'canvas',
        motion: { type: 'tween', duration: 800, easing: cubicOut },
      }}
    >
      {#snippet children()}

        <Tree
          hierarchy={complexDataHierarchy}
          {orientation}
          nodeSize={layout === 'node' ? nodeSize : undefined}
        >
          {#snippet children({ nodes, links })}
            <Layer type={"svg"} class="w-full h-full">
              {#each links as link (getNodeKey(link.source) + '_' + getNodeKey(link.target))}
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
              {/each}

              {#each nodes as node (getNodeKey(node))}
                <Group
                  x={(orientation === 'horizontal' ? node.y : node.x) - nodeWidth / 2}
                  y={(orientation === 'horizontal' ? node.x : node.y) - nodeHeight / 2}
                  motion="tween"
                  onclick={() => {
                    if (expandedNodeNames.includes(node.data.name)) {
                      expandedNodeNames = expandedNodeNames.filter(
                        (name) => name !== node.data.name
                      );
                    } else {
                      expandedNodeNames = [...expandedNodeNames, node.data.name];
                    }
                    selected = node;
                  }}
                  class={cls(node.data.children && 'cursor-pointer')}
                >
                  <Rect
                    width={nodeWidth}
                    height={nodeHeight}
                    rx={10}
                    style={`fill: ${node.data.children ? '#eef2ff' : '#ffffff'}; stroke: ${node.data.children ? '#6366f1' : '#9ca3af'}; stroke-width: ${node.data.children ? 1.5 : 1};`}
                  />
                  <Text
                    value={node.data.name}
                    x={nodeWidth / 2}
                    y={nodeHeight / 2}
                    dy={-2}
                    textAnchor="middle"
                    verticalAnchor="middle"
                    class="pointer-events-none"
                    style={`fill: ${node.data.children ? '#3730a3' : '#374151'}; font-size: 11px; font-weight: 600;`}
                  />
                </Group>
              {/each}
            </Layer>
          {/snippet}
        </Tree>
      {/snippet}
    </Chart>
  </div>
