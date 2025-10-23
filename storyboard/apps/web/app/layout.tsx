import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Storyboard',
  description: 'AI comic/story generator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 font-semibold">Storyboard</div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-gray-500">© {new Date().getFullYear()} Storyboard</div>
        </footer>
      </body>
    </html>
  )
}
