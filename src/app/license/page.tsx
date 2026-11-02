import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'License — E3D Studio',
  description:
    'Designs you create in E3D Studio are yours to use, sell and print commercially, with no attribution required. Starter designs are released under CC0.',
}

/**
 * Plain-language licensing page. People running small 3D-printing businesses
 * keep asking whether they may sell prints of what they make here; this is the
 * page we point them to, and the page the agent and the download menu link to.
 */
export default function LicensePage() {
  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <Image src="/brand/e3d-mark.png" alt="Everything 3D" width={34} height={34} />
          <div className="leading-tight">
            <div className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm sm:tracking-[0.18em]">
              Everything 3D
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">Studio</div>
          </div>
        </Link>
        <Link
          href="/studio"
          className="inline-block whitespace-nowrap rounded-none bg-neutral-900 px-3 py-2 text-sm font-medium tracking-wide text-white hover:bg-neutral-700 sm:px-4"
        >
          Open the studio
        </Link>
      </header>
      <div className="border-b border-neutral-200" />

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">License</p>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight">
          What you make here is yours. Sell it, print it, share it.
        </h1>
        <p className="mt-6 text-pretty text-lg text-neutral-500">
          Yes, you can use designs from E3D Studio commercially. You can 3D print them and
          sell the prints, sell the files, use them in your own products, modify them, and
          share them. No attribution, no fee, no permission needed.
        </p>

        <section className="mt-14 space-y-10">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Designs you create</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Everything 3D claims no ownership of the designs, OpenSCAD code, STL and 3MF
              files you generate in the studio. They belong to you. To the extent Everything 3D
              holds any copyright or related rights in them, we waive those rights under the{' '}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                className="underline underline-offset-4 hover:text-neutral-900"
                target="_blank"
                rel="noreferrer"
              >
                Creative Commons CC0 1.0 Universal
              </a>{' '}
              public domain dedication, so there is nothing we could later ask you for.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight">Starter designs</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              The starter designs in the library (piggy banks, nameplates, keychains and the
              rest) were made by Everything 3D and are released under{' '}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                className="underline underline-offset-4 hover:text-neutral-900"
                target="_blank"
                rel="noreferrer"
              >
                CC0 1.0
              </a>
              . Put in a customer&apos;s name, print it, sell it. Anything you derive from a
              starter is yours under the same terms as any other design you create.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight">Commercial use, in plain words</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-600">
              <li>Sell 3D prints of your designs, on Etsy, Instagram, your own shop or anywhere else.</li>
              <li>Sell or give away the STL and 3MF files.</li>
              <li>Use the designs in products, packaging, gifts or client work.</li>
              <li>Modify them in any slicer or CAD tool and keep the result.</li>
              <li>No credit to Everything 3D is required. A mention is welcome, never expected.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight">The few things to keep in mind</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-600">
              <li>
                <span className="font-medium text-neutral-900">Other people&apos;s rights.</span>{' '}
                The license covers what Everything 3D and the studio contribute. It cannot clear
                rights we do not hold: a brand logo, a cartoon character, a celebrity&apos;s likeness
                or a design you uploaded belong to whoever owns them, and selling prints of those
                is your responsibility.
              </li>
              <li>
                <span className="font-medium text-neutral-900">Fonts.</span> Text uses Google Fonts
                and other open fonts licensed under the SIL Open Font License or similar, which
                permit commercial use of the shapes they produce. Extruded lettering in your
                files is fine to sell.
              </li>
              <li>
                <span className="font-medium text-neutral-900">No warranty.</span> Designs are
                provided as-is. Check fit, strength and safety yourself before selling a print,
                especially anything for children or for food.
              </li>
              <li>
                <span className="font-medium text-neutral-900">The software is separate.</span>{' '}
                This page is about the designs. The studio itself, its name and branding stay
                with Everything 3D.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight">Still unsure?</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Message us on WhatsApp from the studio or write to{' '}
              <a
                href="https://everything3dindia.com"
                className="underline underline-offset-4 hover:text-neutral-900"
                target="_blank"
                rel="noreferrer"
              >
                everything3dindia.com
              </a>
              . We would also love to see what you make.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:px-6">
          <span className="flex items-center gap-3">
            <Image src="/brand/e3d-mark.png" alt="" width={20} height={20} />
            <span className="uppercase tracking-[0.18em]">Everything 3D</span>
          </span>
          <Link href="/" className="hover:text-neutral-900">
            Back to E3D Studio
          </Link>
        </div>
      </footer>
    </div>
  )
}
