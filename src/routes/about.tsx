import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — UFL Mobile Player Card Database" },
      {
        name: "description",
        content:
          "A community-made UFL Mobile player card database powered by a maintained Google Sheets source. Not affiliated with Strikerz Inc.",
      },
      { property: "og:title", content: "About — UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content:
          "A community-made UFL Mobile player card database powered by a maintained Google Sheets source.",
      },
    ],
  }),
  component: AboutPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-panel mb-4 text-left">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="mb-5 text-2xl font-bold sm:text-3xl">About this database</h1>

      <Section title="What this is">
        <p>
          This is a community-made UFL Mobile player card database. It collects player cards with
          their rating, position, nation, the six core stats and perk, so you can search and compare
          them quickly on your phone.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Every card shown here comes from a maintained Google Sheets document, which is the single
          source of truth. Each spreadsheet row is one card — several cards of the same player stay
          separate entries.
        </p>
        <p>
          The website reads that sheet on a schedule and keeps a cached copy so browsing stays fast.
          Card details are never edited on the website itself; they are maintained in the sheet and
          appear here after the next sync.
        </p>
      </Section>

      <Section title="Not an official product">
        <p>
          This project is made by the community and is not an official product of Strikerz Inc. It
          is not affiliated with, endorsed by, or sponsored by the developers or publishers of UFL
          or UFL Mobile. All names and trademarks belong to their respective owners.
        </p>
      </Section>

      <Link to="/cards" className="btn-primary focus-ring">
        Browse the card database
      </Link>
    </main>
  );
}
