import { type ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  onAddClick: () => void
}

export default function Layout({ children, onAddClick }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Retro Reader
          </h1>
          <button
            onClick={onAddClick}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            + 글 추가
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
