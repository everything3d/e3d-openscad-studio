import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { Button } from '@/components/ui/button'

const SAMPLE_CODE = `// gear_mount.scad
teeth = 12;
bore = 5;

color("tomato")
  gear(teeth, mod = 2);

color([0.2, 0.5, 1])
  translate([0, 0, 8])
    mounting_plate(bore);`

const FEATURES = [
  {
    title: 'Chat is the CAD',
    body: 'Describe the part in plain language. An AI agent writes complete, parametric OpenSCAD — every turn is a full program, always renderable.',
  },
  {
    title: 'Real OpenSCAD, in your browser',
    body: 'The actual OpenSCAD compiler (WebAssembly, Manifold backend) renders live as you type. No install, no server round-trips.',
  },
  {
    title: 'Projects are chats',
    body: 'Each model keeps its full conversation, code, and imported files (SVG, DXF, STL). Fork any project to branch an idea.',
  },
  {
    title: 'Print-ready export',
    body: 'Download binary STL, or 3MF with color() preserved as materials for multi-color slicing in Prusa, Bambu, or Cura.',
  },
]

function HexLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon
        points="50,6 88,28 88,72 50,94 12,72 12,28"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <polygon points="50,30 68,40 68,60 50,70 32,60 32,40" fill="currentColor" />
    </svg>
  )
}

export default async function LandingPage() {
  const { userId } = await auth()
  const signedIn = Boolean(userId)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 font-semibold">
          <HexLogo className="size-6 text-primary" />
          E3D Studio
        </div>
        <nav className="flex items-center gap-3">
          {signedIn ? (
            <Button render={<Link href="/studio" />}>Open studio</Button>
          ) : (
            <>
              <Button variant="ghost" render={<Link href="/sign-in" />}>
                Sign in
              </Button>
              <Button render={<Link href="/sign-up" />}>Get started</Button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-96 max-w-3xl rounded-full opacity-25 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, oklch(0.65 0.19 255), transparent)',
          }}
          aria-hidden
        />
        <h1 className="relative mx-auto max-w-3xl text-balance text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Describe it. Watch it become a part.
        </h1>
        <p className="relative mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          E3D Studio is an AI-powered OpenSCAD workshop. Chat your way to precise,
          parametric 3D models — rendered live in the browser, exported ready to
          print.
        </p>
        <div className="relative mt-10 flex items-center justify-center gap-4">
          {signedIn ? (
            <Button size="lg" render={<Link href="/studio" />}>
              Open the studio
            </Button>
          ) : (
            <>
              <Button size="lg" render={<Link href="/sign-up" />}>
                Start building — it&apos;s free
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/sign-in" />}>
                Sign in
              </Button>
            </>
          )}
        </div>

        {/* Product mock: prompt → code → model */}
        <div className="relative mx-auto mt-16 grid max-w-4xl gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-400" /> chat
            </div>
            <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
              a 12-tooth gear on a mounting plate, 5&nbsp;mm bore — make the gear
              red and the plate blue
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-xs leading-relaxed text-emerald-200/90">
              {SAMPLE_CODE}
            </pre>
          </div>
          <div className="flex flex-col rounded-xl border bg-card p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-sky-400" /> live preview
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-400">
                Rendered
              </span>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-[#0f1115] py-10">
              <svg viewBox="0 0 200 160" className="w-56" aria-hidden>
                {/* stylized gear */}
                <g transform="translate(100,64)">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <rect
                      key={i}
                      x="-6"
                      y="-52"
                      width="12"
                      height="14"
                      rx="2"
                      fill="#ff6347"
                      transform={`rotate(${i * 30})`}
                    />
                  ))}
                  <circle r="42" fill="#ff6347" />
                  <circle r="10" fill="#0f1115" />
                </g>
                {/* plate */}
                <rect x="30" y="126" width="140" height="16" rx="4" fill="#3380ff" />
                <circle cx="48" cy="134" r="4" fill="#0f1115" />
                <circle cx="152" cy="134" r="4" fill="#0f1115" />
              </svg>
              <div className="absolute inset-x-6 bottom-3 h-px bg-white/5" />
            </div>
            <div className="mt-3 flex justify-end gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border px-2 py-1">↓ STL</span>
              <span className="rounded-md border px-2 py-1">↓ 3MF</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card/50 p-6">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <HexLogo className="size-4" /> E3D Studio
          </span>
          <span>Real OpenSCAD. Real geometry. In your browser.</span>
        </div>
      </footer>
    </div>
  )
}
