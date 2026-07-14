"use client";

import { Sparkles } from "lucide-react";

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

export type BuilderProject = { id: string; name: string };

/**
 * Dashboard entry to the "Sev speaks first" packet flow: describe what you're
 * about to do, and Sev proposes the context to bring into your next AI prompt.
 */
export function BuildPacketDialog({ projects }: { projects: BuilderProject[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="rounded-full">
          <Sparkles className="size-4" />
          Build a packet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Build a Context Packet</DialogTitle>
          <DialogDescription>
            Describe your task — Sev proposes the relevant context to bring into
            your next AI prompt.
          </DialogDescription>
        </DialogHeader>
        <PacketBuilder projects={projects} goalEditable />
      </DialogContent>
    </Dialog>
  );
}
