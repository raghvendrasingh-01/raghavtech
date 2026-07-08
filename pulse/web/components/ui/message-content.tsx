import { RichText } from "./rich-text";

/**
 * Renders an assistant message: fenced ```code``` blocks become monospace
 * panels (used for schedule timelines), everything else supports **bold**
 * and preserves line breaks.
 */
export function MessageContent({ text }: { text: string }) {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.startsWith("```") && seg.endsWith("```")) {
          const body = seg.slice(3, -3).replace(/^\n/, "").replace(/\n$/, "");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-xl border border-border bg-bg/60 p-3 font-mono text-[12px] leading-relaxed text-fg"
            >
              {body}
            </pre>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap text-muted">
            <RichText text={seg} />
          </div>
        );
      })}
    </div>
  );
}
