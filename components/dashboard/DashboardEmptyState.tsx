import { CreateProjectDialog } from "@/components/create-project-dialog";

/** First-run home: no projects yet. */
export function DashboardEmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h2 className="text-lg font-semibold tracking-tight">
        Start your memory
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Create a project, add your files, notes, or a good AI answer, and Sev
        turns them into memory you can ask and reuse with any AI.
      </p>
      <div className="mt-5 flex justify-center">
        <CreateProjectDialog />
      </div>
    </div>
  );
}
