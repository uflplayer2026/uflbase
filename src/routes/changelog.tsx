import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import {
  CHANGELOG_CATEGORIES,
  listChangelog,
  saveChangelogEntry,
  deleteChangelogEntry,
  type ChangelogCategory,
  type ChangelogEntry,
} from "@/lib/changelog.functions";
import { ErrorState, LoadingState } from "@/components/CardsState";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — What's New in UFLBase" },
      {
        name: "description",
        content:
          "Public release notes for UFLBase: new features, improvements, fixes and performance work, newest first.",
      },
      { property: "og:title", content: "Changelog — What's New in UFLBase" },
      {
        property: "og:description",
        content: "Public release notes for the UFLBase player card database.",
      },
    ],
  }),
  component: ChangelogPage,
});

type FormState = {
  id?: string;
  version: string;
  entryDate: string;
  title: string;
  description: string;
  categories: Record<ChangelogCategory, string>;
};

const emptyForm = (): FormState => ({
  version: "",
  entryDate: new Date().toISOString().slice(0, 10),
  title: "",
  description: "",
  categories: { New: "", Improved: "", Fixed: "", Performance: "" },
});

function toForm(entry: ChangelogEntry): FormState {
  const categories = { New: "", Improved: "", Fixed: "", Performance: "" } as Record<
    ChangelogCategory,
    string
  >;
  for (const key of CHANGELOG_CATEGORIES) categories[key] = (entry.categories[key] ?? []).join("\n");
  return {
    id: entry.id,
    version: entry.version,
    entryDate: entry.entryDate,
    title: entry.title,
    description: entry.description,
    categories,
  };
}

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function ChangelogPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listChangelog);
  const adminFn = useServerFn(isCurrentUserAdmin);
  const saveFn = useServerFn(saveChangelogEntry);
  const removeFn = useServerFn(deleteChangelogEntry);

  const [signedIn, setSignedIn] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const entries = useQuery({
    queryKey: ["changelog"],
    queryFn: () => listFn(),
    retry: false,
  });

  const admin = useQuery({
    queryKey: ["changelog-admin"],
    queryFn: () => adminFn(),
    enabled: signedIn,
    retry: false,
  });
  const isAdmin = Boolean(admin.data?.isAdmin);

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const categories: Partial<Record<ChangelogCategory, string[]>> = {};
      for (const key of CHANGELOG_CATEGORIES) {
        const items = state.categories[key]
          .split("\n")
          .map((s) => s.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean);
        if (items.length > 0) categories[key] = items;
      }
      return saveFn({
        data: {
          ...(state.id ? { id: state.id } : {}),
          version: state.version,
          entryDate: state.entryDate,
          title: state.title,
          description: state.description,
          categories,
        },
      });
    },
    onSuccess: () => {
      setForm(null);
      setNotice("Entry saved.");
      queryClient.invalidateQueries({ queryKey: ["changelog"] });
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      setNotice("Entry removed.");
      queryClient.invalidateQueries({ queryKey: ["changelog"] });
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const list = entries.data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">What’s New</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Release notes for UFLBase, newest first.
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn-primary focus-ring"
            onClick={() => setForm(emptyForm())}
          >
            <Plus className="mr-1 inline size-4" aria-hidden /> New entry
          </button>
        ) : null}
      </header>

      {notice ? <p className="mb-4 text-sm text-muted-foreground">{notice}</p> : null}

      {isAdmin && form ? (
        <form
          className="surface-panel mb-6 space-y-3 p-4 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="field focus-ring min-h-11"
              placeholder="Version (e.g. v1.4)"
              aria-label="Version"
              required
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
            />
            <input
              className="field focus-ring min-h-11"
              type="date"
              aria-label="Date"
              required
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
          </div>
          <input
            className="field focus-ring min-h-11 w-full"
            placeholder="Short title"
            aria-label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="field focus-ring w-full"
            rows={2}
            placeholder="Description (optional)"
            aria-label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANGELOG_CATEGORIES.map((key) => (
              <label key={key} className="block text-xs uppercase tracking-widest text-muted-foreground">
                {key}
                <textarea
                  className="field focus-ring mt-1 w-full text-sm normal-case tracking-normal text-foreground"
                  rows={3}
                  placeholder="One item per line"
                  value={form.categories[key]}
                  onChange={(e) =>
                    setForm({ ...form, categories: { ...form.categories, [key]: e.target.value } })
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary focus-ring" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save entry"}
            </button>
            <button type="button" className="btn-secondary focus-ring" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {entries.isPending ? (
        <LoadingState label="Loading changelog…" />
      ) : entries.isError ? (
        <ErrorState
          message={(entries.error as Error).message}
          onRetry={() => void entries.refetch()}
        />
      ) : list.length === 0 ? (
        <div className="surface-panel">
          <h2 className="text-base font-semibold">No changelog entries yet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Release notes will appear here as soon as they are published.
          </p>
        </div>
      ) : (
        <ol className="space-y-4 list-none">
          {list.map((entry) => (
            <li key={entry.id} className="surface-panel p-4 text-left sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip" data-active="true">
                      {entry.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.entryDate)}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold break-words">{entry.title}</h2>
                </div>
                {isAdmin ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="icon-btn focus-ring"
                      aria-label={`Edit ${entry.version}`}
                      onClick={() => setForm(toForm(entry))}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="icon-btn focus-ring"
                      aria-label={`Delete ${entry.version}`}
                      onClick={() => remove.mutate(entry.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>

              {entry.description ? (
                <p className="mt-2 text-sm text-muted-foreground break-words">{entry.description}</p>
              ) : null}

              <div className="mt-3 space-y-3">
                {CHANGELOG_CATEGORIES.filter((c) => (entry.categories[c] ?? []).length > 0).map(
                  (category) => (
                    <div key={category}>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
                        {category}
                      </h3>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {(entry.categories[category] ?? []).map((item, i) => (
                          <li key={i} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
