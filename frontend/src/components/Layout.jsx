import Navbar from './Navbar'

export default function Layout({ children }) {
  const embebido = window.self !== window.top

  return (
    <div className={`min-h-screen ${embebido ? 'bg-white' : 'bg-[#eef3f7]'}`}>
      <Navbar embebido={embebido} />
      <main className={embebido
        ? 'min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8'
        : 'mx-auto max-w-[1480px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8'}>
        <div className={embebido
          ? 'min-h-[calc(100dvh-2rem)]'
          : 'min-h-[calc(100dvh-7rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8'}>
          {children}
        </div>
      </main>
    </div>
  )
}
