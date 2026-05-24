import type { ChatSegment, ToolActivity } from '../hooks/useHermes';

export type ToolTraceGroup = {
  id: string;
  type: 'tool-group';
  label: string;
  rawTool: string;
  tools: ToolActivity[];
  status: ToolActivity['status'];
};

export type GroupedChatSegment = ChatSegment | ToolTraceGroup;

const exactToolLabels: Record<string, string> = {
  terminal: 'Terminal',
  read_file: 'Read File',
  write_file: 'Write File',
  patch: 'Patch',
  search_files: 'Search Files',
  web_search: 'Web Search',
  browser: 'Browser',
  memory: 'Memory',
  cronjob: 'Schedule',
  clarify: 'Clarify',
  session_search: 'Session Search',
  honcho_context: 'Honcho Context',
  honcho_search: 'Honcho Search',
};

const toTitleWords = (value: string) => value
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .split(/[^a-zA-Z0-9]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

export const normalizeToolKey = (tool?: string) => (tool || 'tool').trim().toLowerCase();

export const getToolDisplayLabel = (tool?: string) => {
  const rawTool = (tool || '').trim();
  if (!rawTool) return 'Tool Call';

  const exact = exactToolLabels[rawTool.toLowerCase()];
  if (exact) return exact;

  const mcpMatch = rawTool.match(/^mcp__([^_]+(?:_[^_]+)*)__([a-zA-Z0-9_.-]+)$/);
  if (mcpMatch) {
    return `${toTitleWords(mcpMatch[1])} ${toTitleWords(mcpMatch[2].replace(/_for_/g, '_'))}`;
  }

  const namespaceMatch = rawTool.match(/^(functions|web|image_gen|tool_search|multi_tool_use)\.([a-zA-Z0-9_.-]+)$/);
  if (namespaceMatch) {
    return toTitleWords(namespaceMatch[2]);
  }

  return toTitleWords(rawTool) || 'Tool Call';
};

const getGroupStatus = (tools: ToolActivity[]): ToolActivity['status'] => {
  if (tools.some((tool) => tool.status === 'failed')) return 'failed';
  if (tools.some((tool) => tool.status === 'running')) return 'running';
  return 'completed';
};

export const formatToolGroupLabel = (group: ToolTraceGroup) => (
  group.tools.length > 1 ? `${group.label} x${group.tools.length}` : group.label
);

export const getToolGroupCount = (tools: ToolActivity[]) => {
  const keys = new Set(tools.map((tool) => normalizeToolKey(tool.tool)));
  return keys.size;
};

export const groupChatToolSegments = (segments: ChatSegment[]): GroupedChatSegment[] => {
  const grouped: GroupedChatSegment[] = [];
  let activeGroup: ToolTraceGroup | null = null;

  const flushGroup = () => {
    if (activeGroup) {
      grouped.push({
        ...activeGroup,
        status: getGroupStatus(activeGroup.tools),
      });
      activeGroup = null;
    }
  };

  for (const segment of segments) {
    if (segment.type !== 'tool') {
      flushGroup();
      grouped.push(segment);
      continue;
    }

    const key = normalizeToolKey(segment.tool.tool);
    if (!activeGroup || activeGroup.rawTool !== key) {
      flushGroup();
      activeGroup = {
        id: `tool-group-${segment.tool.id}`,
        type: 'tool-group',
        label: getToolDisplayLabel(segment.tool.tool),
        rawTool: key,
        tools: [segment.tool],
        status: segment.tool.status,
      };
      continue;
    }

    activeGroup.tools.push(segment.tool);
  }

  flushGroup();
  return grouped;
};
