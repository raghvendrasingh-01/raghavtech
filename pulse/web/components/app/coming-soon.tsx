import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Placeholder for pages being built in later phases. */
export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <Card className="grid place-items-center py-24 text-center">
      <div className="max-w-md px-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-3">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-sm text-muted">{note}</p>
      </div>
    </Card>
  );
}
