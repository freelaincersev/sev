"use client";

import { Upload } from "lucide-react";

import { PacketBuilder } from "@/components/packet-builder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Export an Ask answer as a Context Packet. Sev proposes the relevant sources
 * (suggestion-first, via PacketBuilder) using the answered question as the
 * goal; the user confirms which to include, then copies for ChatGPT/Claude/
 * Cursor/Markdown.
 */
export function AnswerExportDialog({
  projectId,
  query,
  disabled,
}: {
  projectId: string;
  query: string;
  disabled?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
        >
          <Upload className="size-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">Export as Context Packet</DialogTitle>
          <DialogDescription>
            Sev pulls the relevant memory for this question — confirm what to
            include, then paste it into ChatGPT, Claude, or Cursor.
          </DialogDescription>
        </DialogHeader>
        <PacketBuilder projectId={projectId} initialGoal={query} />
      </DialogContent>
    </Dialog>
  );
}
