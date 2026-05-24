import { Fragment, memo, ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Code, Table2, X } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
  reduceMotion?: boolean;
}

type TextBlock = { type: 'text'; lines: string[] };
type CodeBlock = { type: 'code'; code: string; language?: string };
type TableBlock = { type: 'table'; rows: string[][] };
type Block = TextBlock | CodeBlock | TableBlock;
type PreviewBlock = CodeBlock | TableBlock;

type PreviewState = {
  title: string;
  block: PreviewBlock;
};

const splitTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isTableDivider = (line: string) => {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const isTableStart = (lines: string[], index: number) =>
  lines[index]?.includes('|') && lines[index + 1]?.includes('|') && isTableDivider(lines[index + 1]);

const parseBlocks = (content: string): Block[] => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    if (!textLines.length) return;
    blocks.push({ type: 'text', lines: textLines });
    textLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = line.match(/^```([\w-]+)?\s*$/);

    if (fence) {
      flushText();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', language: fence[1], code: codeLines.join('\n') });
      continue;
    }

    if (isTableStart(lines, i)) {
      flushText();
      const tableRows = [splitTableRow(lines[i])];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        tableRows.push(splitTableRow(lines[i]));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'table', rows: tableRows });
      continue;
    }

    textLines.push(line);
  }

  flushText();
  return blocks;
};

const renderAnimatedText = (text: string, keyPrefix: string, reduceMotion: boolean): ReactNode[] => {
  if (reduceMotion) return [text];

  return (
  Array.from(text).map((char, index) => (
    <motion.span
      key={`${keyPrefix}-char-${index}`}
      initial={{ opacity: 0, filter: 'blur(6px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.008, 0.35), ease: 'easeOut' }}
    >
      {char}
    </motion.span>
  ))
  );
};

const renderInlineMarkdown = (text: string, keyPrefix: string, reduceMotion: boolean): ReactNode[] => {
  const parts: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderAnimatedText(text.slice(lastIndex, match.index), `${keyPrefix}-${lastIndex}`, reduceMotion));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        parts.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
            {link[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="rounded-md bg-white/[0.055] px-1 py-0.5 font-mono text-[0.88em] text-zinc-200 break-words">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      parts.push(
        <strong key={key} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('~~')) {
      parts.push(
        <del key={key} className="text-zinc-400 decoration-white/30">
          {token.slice(2, -2)}
        </del>
      );
    } else {
      parts.push(
        <em key={key} className="italic text-zinc-300">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(...renderAnimatedText(text.slice(lastIndex), `${keyPrefix}-${lastIndex}`, reduceMotion));
  }

  return parts;
};

const renderInline = (text: string, keyPrefix: string, reduceMotion: boolean) => renderInlineMarkdown(text, keyPrefix, reduceMotion);

const renderTextLine = (line: string, key: string, reduceMotion: boolean) => {
  if (!line.trim()) {
    return <div key={key} className="h-3" />;
  }

  const heading = line.match(/^(#{1,4})\s+(.+)$/);
  if (heading) {
    const weight = heading[1].length <= 2 ? 'font-semibold text-zinc-100' : 'font-medium text-zinc-200';
    return (
      <div key={key} className={`${weight} mt-3 first:mt-0 break-words`}>
        {renderInline(heading[2], key, reduceMotion)}
      </div>
    );
  }

  const quote = line.match(/^>\s?(.+)$/);
  if (quote) {
    return (
      <div key={key} className="my-2 border-l border-white/10 pl-3 text-zinc-400 break-words">
        {renderInline(quote[1], key, reduceMotion)}
      </div>
    );
  }

  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
  if (unordered) {
    return (
      <div key={key} className="flex gap-2 break-words">
        <span className="mt-[0.05em] text-zinc-600">•</span>
        <span className="min-w-0 break-words">{renderInline(unordered[1], key, reduceMotion)}</span>
      </div>
    );
  }

  const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/);
  if (ordered) {
    return (
      <div key={key} className="flex gap-2 break-words">
        <span className="text-zinc-600">{ordered[1]}.</span>
        <span className="min-w-0 break-words">{renderInline(ordered[2], key, reduceMotion)}</span>
      </div>
    );
  }

  if (/^---+$/.test(line.trim())) {
    return <div key={key} className="my-3 h-px w-full bg-white/10" />;
  }

  return (
    <div key={key} className="break-words [overflow-wrap:anywhere]">
      {renderInline(line, key, reduceMotion)}
    </div>
  );
};

const renderTextBlock = (block: TextBlock, blockIndex: number, reduceMotion: boolean) => (
  <div key={`text-${blockIndex}`} className="space-y-1 break-words [overflow-wrap:anywhere]">
    {block.lines.map((line, lineIndex) => renderTextLine(line, `text-${blockIndex}-${lineIndex}`, reduceMotion))}
  </div>
);

const renderCodeCard = (block: CodeBlock, blockIndex: number, openPreview: (preview: PreviewState) => void) => {
  const lineCount = block.code.trim() ? block.code.trim().split('\n').length : 0;
  const title = block.language ? `${block.language} code block` : 'Code block';

  return (
    <button
      key={`code-${blockIndex}`}
      type="button"
      onClick={() => openPreview({ title, block })}
      className="my-3 flex w-full max-w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.035] px-3 py-2.5 text-left text-neutral-400 active:scale-[0.99] transition-transform"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Code className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        <span className="truncate font-sans-hermes text-[13px]">See code block</span>
      </span>
      <span className="shrink-0 font-mono text-[11px] text-neutral-600">
        {lineCount} lines
      </span>
    </button>
  );
};

const renderTableCard = (block: TableBlock, blockIndex: number, openPreview: (preview: PreviewState) => void) => {
  const columns = block.rows[0]?.length ?? 0;
  const rows = Math.max(block.rows.length - 1, 0);

  return (
    <button
      key={`table-${blockIndex}`}
      type="button"
      onClick={() => openPreview({ title: 'Table', block })}
      className="my-3 flex w-full max-w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.035] px-3 py-2.5 text-left text-neutral-400 active:scale-[0.99] transition-transform"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Table2 className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        <span className="truncate font-sans-hermes text-[13px]">See table</span>
      </span>
      <span className="shrink-0 font-mono text-[11px] text-neutral-600">
        {rows}×{columns}
      </span>
    </button>
  );
};

const renderCodePreview = (block: CodeBlock) => (
  <pre className="max-h-[64vh] overflow-auto whitespace-pre p-4 font-mono text-[12px] leading-relaxed text-neutral-300">
    <code>{block.code.trim()}</code>
  </pre>
);

const renderTablePreview = (block: TableBlock, reduceMotion: boolean) => {
  const [head, ...body] = block.rows;

  return (
    <div className="max-h-[64vh] overflow-auto">
      <table className="min-w-max border-collapse font-sans-hermes text-[13px] leading-relaxed text-neutral-300">
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index} className="sticky top-0 border-b border-white/[0.06] bg-neutral-950 px-3 py-2 text-left font-medium text-zinc-100 align-top">
                {renderInline(cell, `preview-h-${index}`, reduceMotion)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/[0.035] last:border-0">
              {head.map((_, cellIndex) => (
                <td key={cellIndex} className="max-w-[240px] px-3 py-2 align-top text-neutral-400 break-words [overflow-wrap:anywhere]">
                  {renderInline(row[cellIndex] || '', `preview-${rowIndex}-${cellIndex}`, reduceMotion)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MarkdownPreviewDialog = ({ preview, onClose, reduceMotion }: { preview: PreviewState; onClose: () => void; reduceMotion: boolean }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-xl" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={preview.title}
      onClick={(event) => event.stopPropagation()}
      className="w-full max-w-[94vw] overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl sm:max-w-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-neutral-300">
          {preview.block.type === 'code' ? <Code className="h-4 w-4 shrink-0 text-neutral-500" /> : <Table2 className="h-4 w-4 shrink-0 text-neutral-500" />}
          <span className="truncate font-sans-hermes text-[13px] font-medium">{preview.title}</span>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95">
          <X className="h-4 w-4" />
        </button>
      </div>
      {preview.block.type === 'code' ? renderCodePreview(preview.block) : renderTablePreview(preview.block, reduceMotion)}
    </div>
  </div>
);

export const MarkdownMessage = memo(function MarkdownMessage({ content, reduceMotion = false }: MarkdownMessageProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const blocks = parseBlocks(content);

  return (
    <>
      <div className="w-full max-w-full space-y-2 break-words [overflow-wrap:anywhere]">
        {blocks.map((block, index) => (
          <Fragment key={index}>
            {block.type === 'text' && renderTextBlock(block, index, reduceMotion)}
            {block.type === 'code' && renderCodeCard(block, index, setPreview)}
            {block.type === 'table' && renderTableCard(block, index, setPreview)}
          </Fragment>
        ))}
      </div>
      {preview && createPortal(
        <MarkdownPreviewDialog preview={preview} onClose={() => setPreview(null)} reduceMotion={reduceMotion} />,
        document.body
      )}
    </>
  );
});
