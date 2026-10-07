import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { WhatsAppButton } from '@/components/whatsapp-button'

/**
 * The starter designs, shown with the same renders the studio uses in its
 * starter library — these are pictures of what the app actually produces, not
 * an illustration of it.
 */
const STARTERS = [
  {
    title: 'Two-layer name piggy bank',
    blurb: 'Plate and a raised name. Prints on any two-colour setup.',
    image: '/canonicals/two-layer-name-piggy-bank.webp',
    width: 1200,
    height: 800,
  },
  {
    title: 'Three-layer name piggy bank',
    blurb: 'Plate, outline and face, for the raised two-tone look.',
    image: '/canonicals/three-layer-name-piggy-bank.webp',
    width: 1200,
    height: 800,
  },
  {
    title: 'Two-name illusion',
    blurb: 'Reads one name from the front, another from the side.',
    image: '/canonicals/two-name-illusion.webp',
    width: 1200,
    height: 600,
  },
]

const FEATURES = [
  {
    title: 'Just say what you want',
    body: 'No CAD, no measurements, no tutorials. Type "a piggy bank that says Veera in pink" and it gets built. Ask for changes the same way.',
  },
  {
    title: 'Watch it appear',
    body: 'A real 3D model spins in your browser as the AI works. Turn it, look underneath, change your mind — it re-renders while you watch.',
  },
  {
    title: 'Start from a favourite',
    body: 'Piggy banks that spell a name, signs that read two different words from two sides. Open one, swap in your name, make it yours.',
  },
  {
    title: 'Ready for the printer',
    body: 'Download STL, or 3MF with the colours already separated so a multi-colour printer knows which filament goes where.',
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
  // Signed-in visitors came here to work, not to read the pitch again.
  if (userId) redirect('/studio')

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
          <CtaLink href="/sign-in" variant="ghost">
            Sign in
          </CtaLink>
          <CtaLink href="/sign-up">Get started</CtaLink>
        </nav>
      </header>
      <div className="border-b border-neutral-200" />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Put their name on it.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-neutral-500">
          Piggy banks, keychains, name signs, little gifts that are obviously for
          one person. Describe what you want, watch it take shape in 3D, and take
          it away ready to print.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <CtaLink href="/sign-up" large>
            Make something — it&apos;s free
          </CtaLink>
          <CtaLink href="/sign-in" variant="outline" large>
            Sign in
          </CtaLink>
        </div>

        {/* What you said, and what came back. The render is the real output
            of the starter design, at the size it deserves. */}
        <div className="mx-auto mt-16 max-w-4xl">
          <figure className="overflow-hidden border border-neutral-200 bg-[#1b1d21] shadow-sm">
            <Image
              src="/canonicals/three-layer-name-piggy-bank.webp"
              alt="A mint-green piggy bank spelling VEERA, with its name-plate lid beside it in pink and magenta"
              width={1200}
              height={800}
              priority
              // The render leaves empty space above and below the object, so
              // it is cropped to a wider frame rather than shown letterboxed.
              className="aspect-[16/9] w-full object-cover"
            />
            <figcaption className="flex flex-col gap-1 border-t border-white/10 px-5 py-4 text-left sm:flex-row sm:items-baseline sm:gap-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                You said
              </span>
              <span className="text-sm text-neutral-300">
                “a piggy bank that spells VEERA — mint body, bubbly pink
                letters, and a slot big enough for coins”
              </span>
            </figcaption>
          </figure>
          <p className="mt-3 text-sm text-neutral-500">
            Then download it as STL, or 3MF with the colours kept separate.
          </p>
        </div>
      </section>

      {/* Starter gallery — real renders of the designs in the studio. */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight">
            Start from one of these
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-neutral-500">
            Open one, put in a name, and it is yours. Or start from nothing and
            describe whatever you had in mind.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {STARTERS.map((starter) => (
            <Link
              key={starter.title}
              href="/sign-up"
              className="group block border border-neutral-200 bg-white transition-colors hover:border-neutral-900"
            >
              <div className="overflow-hidden bg-[#1b1d21]">
                <Image
                  src={starter.image}
                  alt={starter.title}
                  width={starter.width}
                  height={starter.height}
                  className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                <h3 className="text-sm font-semibold">{starter.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{starter.blurb}</p>
              </div>
            </Link>
          ))}
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

      {/* Closing prompt */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight">
            Whose name are you printing?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-neutral-500">
            Start from a piggy bank, swap in a name, and see it in 3D in about a
            minute. No card, no software to install.
          </p>
          <div className="mt-8">
            <CtaLink href="/sign-up" large>
              Start for free
            </CtaLink>
          </div>
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

      <WhatsAppButton />
    </div>
  )
}
