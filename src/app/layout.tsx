import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'E3D Studio — AI OpenSCAD by Everything 3D',
  description:
    'AI-powered OpenSCAD editor with live 3D preview, by Everything 3D. Describe a part, watch it render, export STL/3MF.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Android Chrome: shrink the layout when the keyboard opens so the chat
  // composer stays visible above it instead of being covered.
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
