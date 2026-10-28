import { ImageResponse } from 'next/og'
import { getProjectSharePreview, getProjectSharePreviewImage } from '@/lib/db/queries'

export const alt = 'E3D Studio project preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ token: string }> }

/**
 * The card chat apps and social sites show for a share link: the render the
 * owner saw when they made the link, with the project name underneath. Links
 * made before previews existed (and order links) fall back to the name alone.
 */
export default async function Image({ params }: Props) {
  const { token } = await params
  const [share, previewImage] = await Promise.all([
    getProjectSharePreview(token),
    getProjectSharePreviewImage(token),
  ])
  const name = share?.name ?? 'Shared project'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f1115',
          color: '#fafafa',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewImage} alt="" width={800} height={500} style={{ borderRadius: 16 }} />
          ) : (
            <div style={{ fontSize: 72, fontWeight: 600, padding: '0 80px', textAlign: 'center' }}>
              {name}
            </div>
          )}
        </div>
        <div
          style={{
            height: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 56px',
            borderTop: '1px solid #262a33',
            fontSize: 34,
          }}
        >
          <div style={{ display: 'flex', maxWidth: 860, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {previewImage ? name : 'Open a private copy'}
          </div>
          <div style={{ display: 'flex', color: '#a3a3a3', fontSize: 28 }}>E3D Studio</div>
        </div>
      </div>
    ),
    size,
  )
}
