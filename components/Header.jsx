import { useState } from "react";

export default function Header() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <header className="sticky top-0 z-20 bg-white/40 backdrop-blur-md border-b border-white/50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center">
        {!logoFailed ? (
          <img
            src="https://www.polair.com/local/templates/cult/img/logo.svg"
            alt="Polair"
            className="h-8 sm:h-9 w-auto"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-xl sm:text-2xl font-semibold tracking-wide text-polair-dark">
            Polair
          </span>
        )}
      </div>
    </header>
  );
}
