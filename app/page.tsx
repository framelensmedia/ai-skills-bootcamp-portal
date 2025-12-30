import Link from "next/link";

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#B7FF00]">
      {text}
    </span>
  );
}

function CourseCard({
  category,
  title,
  price,
}: {
  category: string;
  title: string;
  price: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
      <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#B7FF00]">{category}</span>
        <span className="text-xs text-white/60">★ 4.9</span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-white/60">by AI Skills Bootcamp</span>
        <span className="text-sm font-semibold text-[#B7FF00]">{price}</span>
      </div>
    </div>
  );
}

function ResourceCard({
  tag,
  title,
  desc,
}: {
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
      <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
      <p className="mt-4 text-xs font-semibold text-[#B7FF00]">{tag}</p>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{desc}</p>
      <div className="mt-4">
        <span className="text-xs text-white/60 hover:text-white">Read now →</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="bg-black">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <div>
            <Tag text="No prior experience required" />

            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              MASTER{" "}
              <span className="text-[#B7FF00]">HIGH-VALUE</span>
              <br />
              SKILLS
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              Join learners leveling up their business and creative output with AI.
              Stop wasting time on outdated theory. Start building real-world results.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 sm:w-auto">
                <span className="text-xs text-white/60">🔎</span>
                <input
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                  placeholder="What skill do you want?"
                />
              </div>

              <Link
                href="/pricing"
                className="inline-flex w-full items-center justify-center rounded-md bg-[#B7FF00] px-4 py-3 text-sm font-semibold text-black hover:opacity-90 sm:w-auto"
              >
                Find Courses →
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-3 text-xs text-white/60">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                ★
              </span>
              Trusted by entrepreneurs and creators
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/50" />
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3">
              <div>
                <p className="text-xs text-white/60">Your progress</p>
                <p className="text-sm font-semibold text-white">Top 5% of learners</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">Growth</p>
                <p className="text-sm font-semibold text-[#B7FF00]">+125%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY BAR */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          {["All", "Design", "Development", "Business", "Marketing", "Photography"].map((c) => (
            <button
              key={c}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${
                c === "All"
                  ? "bg-white text-black"
                  : "border border-white/10 bg-black/30 text-white/70 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* TOP RATED COURSES */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">
              Top rated
            </p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">Courses</h2>
            <p className="mt-2 text-sm text-white/60">
              Hand-picked, practical, and built for real outcomes.
            </p>
          </div>
          <Link href="/pricing" className="hidden text-sm text-white/70 hover:text-white md:block">
            View all →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CourseCard category="DEVELOPMENT" title="AI Content Agency Blueprint" price="$29/mo" />
          <CourseCard category="DESIGN" title="AI Brand Kit Masterclass" price="$29/mo" />
          <CourseCard category="BUSINESS" title="AI Marketing Strategy" price="$29/mo" />
          <CourseCard category="CREATOR" title="Short Form Content Engine" price="$29/mo" />
        </div>

        <div className="mt-6 md:hidden">
          <Link href="/pricing" className="text-sm text-white/70 hover:text-white">
            View all →
          </Link>
        </div>
      </section>

      {/* INSIGHTS & RESOURCES */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:pb-14">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">
            Insights
          </p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Resources</h2>
          <p className="mt-2 text-sm text-white/60">
            Tutorials, trends, and playbooks to keep you sharp.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ResourceCard
            tag="PRODUCTIVITY"
            title="Master time management with AI"
            desc="Build a weekly workflow that saves hours without losing quality."
          />
          <ResourceCard
            tag="AI TRENDS"
            title="What’s changing right now"
            desc="Tools and updates that matter for creators and entrepreneurs."
          />
          <ResourceCard
            tag="CAREER"
            title="Top skills employers want"
            desc="Practical skill stacking so you can earn faster."
          />
        </div>
      </section>

      {/* TESTIMONIAL STRIP */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:pb-14">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center md:p-10">
          <p className="text-sm text-white/70">
            “I stopped guessing and started executing. The prompts and workflows paid for themselves fast.”
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/50">
            Member, AI Skills Bootcamp
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-black p-6 text-center md:p-10">
          <h2 className="text-2xl font-black md:text-4xl">
            READY TO <span className="text-[#B7FF00]">LEVEL UP?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 md:text-base">
            Unlock premium prompts, member resources, and the full learning path. Cancel anytime.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/pricing"
              className="inline-flex w-full justify-center rounded-md bg-[#B7FF00] px-5 py-3 text-sm font-semibold text-black hover:opacity-90 sm:w-auto"
            >
              Get Started
            </Link>
            <Link
              href="/prompts"
              className="inline-flex w-full justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Browse Resources
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/50">
            No credit card required for free tier. Upgrade anytime.
          </p>
        </div>
      </section>
    </div>
  );
}
