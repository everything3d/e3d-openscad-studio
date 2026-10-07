import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { WhatsAppButton } from '@/components/whatsapp-button'

export const metadata: Metadata = {
  title: 'E3D Studio — design your own 3D prints, just by describing them',
  description:
    'You have a 3D printer. Now make exactly what you want for it. Describe it in plain words, watch it appear in 3D, and download a print-ready STL or multi-colour 3MF. No CAD, no coding.',
}

/**
 * The starter designs, shown with the same renders the studio uses in its
 * starter library — these are pictures of what the app actually produces, not
 * an illustration of it.
 */
const STARTERS = [
  {
    title: 'Two-layer name piggy bank',
    blurb: 'A coin bank and a raised name. Two filaments, no supports.',
    image: '/canonicals/two-layer-name-piggy-bank.webp',
    width: 1200,
    height: 800,
  },
  {
    title: 'Three-layer name piggy bank',
    blurb: 'Plate, outline and letters, for the raised two-tone look.',
    image: '/canonicals/three-layer-name-piggy-bank.webp',
    width: 1200,
    height: 800,
  },
  {
    title: 'Two-name illusion',
    blurb: 'Reads one name from the front and another from the side.',
    image: '/canonicals/two-name-illusion.webp',
    width: 1200,
    height: 600,
  },
]

const STEPS = [
  {
    title: 'Say what you want',
    body: 'Type it the way you would explain it to a friend. Add sizes if they matter, or attach a photo or a sketch.',
  },
  {
    title: 'Watch it appear',
    body: 'The model builds in 3D right in your browser. Spin it, check it, then ask for changes: “make the letters thicker”, “10 cm wide”.',
  },
  {
    title: 'Send it to your printer',
    body: 'Download an STL, or a 3MF with each colour as its own part, and open it in the slicer you already use.',
  },
]

/** Things the studio is good at: printable objects you can describe in a sentence. */
const IDEAS = [
  'A desk nameplate for my son, Arjun',
  'A keychain that says “Home” with a heart cut-out',
  'Plant markers for basil, mint and tulsi',
  'A hook that clips onto a 2 cm shelf',
  'A coaster with a geometric pattern',
  'A box with a sliding lid, 8 × 5 × 3 cm',
]

const FEATURES = [
  {
    title: 'No CAD. No code.',
    body: 'If you can describe it, you can make it. You never see a menu of tools or a line of code unless you go looking for it.',
  },
  {
    title: 'Real measurements',
    body: 'Ask for 42 mm and you get 42 mm. Make it fit the shelf, the battery, the gap behind the desk — not “close enough”.',
  },
  {
    title: 'Multi-colour ready',
    body: 'Colours come out as separate parts in the 3MF, so your AMS or multi-material setup knows which filament goes where.',
  },
  {
    title: 'Show, don\u2019t explain',
    body: 'Hard to put into words? Attach a photo of the broken part or a quick sketch on paper and build from that.',
  },
]

const FAQS = [
  {
    q: 'Do I need to know CAD or coding?',
    a: 'No. You describe what you want in everyday words and the AI does the modelling. You can ask for changes the same way.',
  },
  {
    q: 'Will it work with my printer?',
    a: 'Yes. You get standard STL and 3MF files that open in Bambu Studio, PrusaSlicer, OrcaSlicer, Cura and any other slicer.',
  },
  {
    q: 'Does it cost anything?',
    a: 'Designing is free. Create an account in a few seconds — no card needed.',
  },
  {
    q: 'What if I want it printed for me?',
    a: 'If your printer can’t do the colours or the size, order the print from Everything 3D right inside the studio and we’ll ship it to you.',
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
  const base = large ? 'px-6 py-3 text-base' : 'px-3 py-2 text-sm sm:px-4'
  const styles = {
    solid: 'bg-neutral-900 text-white hover:bg-neutral-700',
    outline: 'border border-neutral-300 text-neutral-900 hover:border-neutral-900',
    ghost: 'text-neutral-700 hover:text-neutral-900',
  }[variant]
  return (
    <Link href={href} className={`inline-block whitespace-nowrap rounded-none font-medium tracking-wide ${base} ${styles}`}>
      {children}
    </Link>
  )
}

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-10 text-center">
      <h2 className="text-balance text-3xl font-semibold tracking-tight">{title}</h2>
      {body && <p className="mx-auto mt-3 max-w-xl text-pretty text-neutral-500">{body}</p>}
    </div>
  )
}

export default async function LandingPage() {
  const { userId } = await auth()
  // Signed-in visitors came here to work, not to read the pitch again.
  if (userId) redirect('/studio')

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Image src="/brand/e3d-mark.png" alt="Everything 3D" width={34} height={34} />
          <div className="leading-tight">
            <div className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm sm:tracking-[0.18em]">
              Everything 3D
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">Studio</div>
          </div>
        </div>
        <nav className="flex items-center gap-1 sm:gap-4">
          <CtaLink href="/sign-in" variant="ghost">
            Sign in
          </CtaLink>
          <CtaLink href="/sign-up">Get started</CtaLink>
        </nav>
      </header>
      <div className="border-b border-neutral-200" />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">
          For people who own a 3D printer
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Print what you actually want.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-neutral-500">
          Stop scrolling model sites for something close enough. Describe the
          thing in your own words and get a print-ready file in minutes. No CAD,
          no coding.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <CtaLink href="/sign-up" large>
            Design something — it&apos;s free
          </CtaLink>
          <CtaLink href="#how-it-works" variant="outline" large>
            See how it works
          </CtaLink>
        </div>

        {/* What you said, and what came back. The render is the real output
            of the starter design, at the size it deserves. */}
        <div className="mx-auto mt-16 max-w-4xl">
          <figure className="overflow-hidden border border-neutral-200 bg-[#1b1d21] shadow-sm">
            <figcaption className="flex flex-col gap-1 border-b border-white/10 px-5 py-4 text-left sm:flex-row sm:items-baseline sm:gap-3">
              <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                You type
              </span>
              <span className="text-sm text-neutral-300">
                “a piggy bank that spells VEERA — mint body, bubbly pink
                letters, and a slot big enough for coins”
              </span>
            </figcaption>
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
            <div className="flex flex-col gap-1 border-t border-white/10 px-5 py-4 text-left sm:flex-row sm:items-baseline sm:gap-3">
              <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                You get
              </span>
              <span className="text-sm text-neutral-300">
                A 3MF with the body and letters as separate colours, ready for
                your slicer.
              </span>
            </div>
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8 border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            title="From idea to print bed in three steps"
            body="It works like messaging someone who is very good at 3D modelling."
          />
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border border-neutral-200 bg-white p-6">
                <span className="flex size-8 items-center justify-center bg-neutral-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Ideas — prompts that show the range without promising the impossible. */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          title="Things you could ask for"
          body="Gifts with someone's name on them, fixes around the house, little things that need to be exactly the right size."
        />
        <ul className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
          {IDEAS.map((idea) => (
            <li
              key={idea}
              className="border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700"
            >
              “{idea}”
            </li>
          ))}
        </ul>
      </section>

      {/* Starter gallery — real renders of the designs in the studio. */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionHeading
          title="Or start from one of these"
          body="Open a starter, put in a name, and it is yours. Every one of these was made in the studio."
        />
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
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em]">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <SectionHeading title="Questions" />
        <div className="divide-y divide-neutral-200 border-y border-neutral-200">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span
                  aria-hidden
                  className="text-xl leading-none text-neutral-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing prompt */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-balance text-3xl font-semibold tracking-tight">
            What&apos;s your printer making next?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-neutral-500">
            Describe it and see it in 3D in about a minute. No card, nothing to
            install.
          </p>
          <div className="mt-8">
            <CtaLink href="/sign-up" large>
              Start designing for free
            </CtaLink>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 pb-24 pt-8 text-sm text-neutral-500 sm:flex-row sm:px-6">
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
