import React, { useState, useEffect } from 'react';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { Monitor, Smartphone } from 'lucide-react';

export const App: React.FC = () => {
  const [role, setRole] = useState<'PLAYER' | 'HOST'>('PLAYER');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pin')) {
      setRole('PLAYER');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <header className="bg-black/30 backdrop-blur border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRole('PLAYER')}>
          <span className="text-3xl font-black text-yellow-400 tracking-wider">KAHOOT!</span>
          <span className="bg-kahoot-purple text-xs font-bold px-2 py-1 rounded text-white uppercase">Open Source</span>
        </div>

        <div className="flex bg-white/10 p-1 rounded-xl">
          <button
            onClick={() => setRole('PLAYER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
              role === 'PLAYER' ? 'bg-yellow-400 text-kahoot-darkPurple shadow' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" /> Joueur
          </button>
          <button
            onClick={() => setRole('HOST')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
              role === 'HOST' ? 'bg-yellow-400 text-kahoot-darkPurple shadow' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" /> Animateur (Host)
          </button>
        </div>
      </header>

      <main className="flex-1 py-6">
        {role === 'HOST' ? <HostView /> : <PlayerView />}
      </main>

      <footer className="text-center py-4 text-xs text-gray-400 border-t border-white/10">
        Kahoot Open Source sur Kubernetes — Conçu pour la performance et le temps réel.
      </footer>
    </div>
  );
};

export default App;
