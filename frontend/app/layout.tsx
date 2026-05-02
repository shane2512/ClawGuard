import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Courier_Prime } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ClawGuard — Layer 2.5 Security Middleware for AI Agents',
  description: 'Declarative capability enforcement, tamper-proof audit logs on 0G Storage, and on-chain manifest registry for OpenClaw agents. Stop unauthorized tool calls before they execute.',
  keywords: ['AI agent security', 'capability enforcement', 'middleware', '0G Storage', 'ENS', 'OpenClaw', 'blockchain audit'],
  authors: [{ name: 'ClawGuard' }],
  openGraph: {
    title: 'ClawGuard — Layer 2.5 Security Middleware for AI Agents',
    description: 'Declarative capability enforcement · Tamper-proof audit logs · On-chain manifest registry · ENS skill discovery',
    type: 'website',
    url: 'https://clawguard.dev',
    siteName: 'ClawGuard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClawGuard — Layer 2.5 Security Middleware for AI Agents',
    description: 'Declarative capability enforcement · Tamper-proof audit logs · On-chain manifest registry',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
