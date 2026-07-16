export default function Header() {
  return (
    <header className="bg-polair-dark text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-white flex items-center justify-center flex-shrink-0">
          <span className="text-polair-dark font-bold text-lg">P</span>
        </div>
        <span className="text-xl sm:text-2xl font-semibold tracking-wide">Polair</span>
      </div>
    </header>
  );
}
