import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@clerk/nextjs/server'

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

/* Monochrome, light — matched to everything3dindia.com. Colors are explicit
   (not theme tokens) because the app shell forces the dark theme globally. */

function CtaLink({
  href,
  children,
  variant = 'solid',
  large = false,
}: {
  href: string
  children: React.ReactNode
  variant?: 'solid' | 'outline' | 'ghost'
  large?: boolean
}) {
  const base = large ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
  const styles = {
    solid: 'bg-neutral-900 text-white hover:bg-neutral-700',
    outline: 'border border-neutral-300 text-neutral-900 hover:border-neutral-900',
    ghost: 'text-neutral-700 hover:text-neutral-900',
  }[variant]
  return (
    <Link href={href} className={`inline-block rounded-none font-medium tracking-wide ${base} ${styles}`}>
      {children}
    </Link>
  )
}

export default async function LandingPage() {
  const { userId } = await auth()
  const signedIn = Boolean(userId)

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Image src="/brand/e3d-mark.png" alt="Everything 3D" width={34} height={34} />
          <div className="leading-tight">
            <div className="text-sm font-semibold uppercase tracking-[0.18em]">Everything 3D</div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">
              OpenSCAD Studio
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          {signedIn ? (
            <CtaLink href="/studio">Open studio</CtaLink>
          ) : (
            <>
              <CtaLink href="/sign-in" variant="ghost">
                Sign in
              </CtaLink>
              <CtaLink href="/sign-up">Get started</CtaLink>
            </>
          )}
        </nav>
      </header>
      <div className="border-b border-neutral-200" />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Describe it. Watch it become a part.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-neutral-500">
          An AI-powered OpenSCAD workshop by Everything&nbsp;3D. Chat your way to
          precise, parametric 3D models — rendered live in the browser, exported
          ready to print.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          {signedIn ? (
            <CtaLink href="/studio" large>
              Open the studio
            </CtaLink>
          ) : (
            <>
              <CtaLink href="/sign-up" large>
                Start building — it&apos;s free
              </CtaLink>
              <CtaLink href="/sign-in" variant="outline" large>
                Sign in
              </CtaLink>
            </>
          )}
        </div>

        {/* Product mock: prompt → code → model */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 text-left sm:grid-cols-2">
          <div className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-400">
              <span className="size-2 rounded-full bg-emerald-500" /> chat
            </div>
            <p className="bg-neutral-100 px-4 py-3 text-sm text-neutral-800">
              a 12-tooth gear on a mounting plate, 5&nbsp;mm bore — make the gear
              red and the plate blue
            </p>
            <pre className="mt-4 overflow-x-auto bg-neutral-900 p-4 font-mono text-xs leading-relaxed text-emerald-200/90">
              {SAMPLE_CODE}
            </pre>
          </div>
          <div className="flex flex-col border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-neutral-400">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-sky-500" /> live preview
              </span>
              <span className="bg-emerald-50 px-2 py-0.5 font-medium normal-case tracking-normal text-emerald-600">
                Rendered
              </span>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0f1115] py-10">
              <svg viewBox="0 0 200 160" className="w-56" aria-hidden>
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
                <rect x="30" y="126" width="140" height="16" rx="4" fill="#3380ff" />
                <circle cx="48" cy="134" r="4" fill="#0f1115" />
                <circle cx="152" cy="134" r="4" fill="#0f1115" />
              </svg>
            </div>
            <div className="mt-3 flex justify-end gap-2 text-xs text-neutral-500">
              <span className="border border-neutral-300 px-2 py-1">↓ STL</span>
              <span className="border border-neutral-300 px-2 py-1">↓ 3MF</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em]">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-neutral-500">
          <span className="flex items-center gap-3">
            <Image src="/brand/e3d-mark.png" alt="" width={20} height={20} />
            <span className="uppercase tracking-[0.18em]">Everything 3D</span>
          </span>
          <a
            href="https://everything3dindia.com"
            className="hover:text-neutral-900"
            target="_blank"
            rel="noreferrer"
          >
            everything3dindia.com
          </a>
        </div>
      </footer>
    </div>
  )
}
