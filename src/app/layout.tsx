import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'E3D OpenSCAD Studio',
  description: 'AI-powered OpenSCAD editor with live 3D preview.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
