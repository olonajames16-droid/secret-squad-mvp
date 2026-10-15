import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { io, Socket } from 'socket.io-client';

const ROLE_OPTIONS = ['INVESTIGATOR', 'TRICKSTER', 'ENGINEER'];
const OBJECTIVES = ['MISSION_MASTER', 'THE_COLLECTOR', 'THE_KINGMAKER'];

type Player = {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  host: boolean;
  role?: string;
  objective?: string;
  score?: number;
};

type RoomState = {
  code: string;
  phase: string;
  timer: number;
  players: Player[];
  hostId: string;
  actions: Array<{ missionId: string; label: string; status: string }>;
  currentMission?: string;
  role?: string;
  objective?: string;
  evidence: Array<{ id: string; type: string; authenticity: string; holder: string }>; 
  voteSummary?: Record<string, number>;
  results?: { title: string; summary: string; teamProgress: number; personal: string };
};

function BackgroundScene() {
  return (
    <Canvas camera={{ position: [0, 6, 13], fov: 42 }}>
      <color attach="background" args={['#0a1020']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.3} color="#8fd3ff" />
      <directionalLight position={[-8, 6, -5]} intensity={0.6} color="#be95ff" />

      <group>
        <mesh position={[0, -1, 0]} receiveShadow>
          <boxGeometry args={[20, 1, 20]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {[
          { pos: [-4, 0.8, -2], color: '#22d3ee' },
          { pos: [0, 0.8, -1], color: '#8b5cf6' },
          { pos: [4, 0.8, -3], color: '#f97316' },
          { pos: [-3, 0.8, 3], color: '#34d399' },
          { pos: [3, 0.8, 3], color: '#f43f5e' },
        ].map((item, index) => (
          <mesh key={index} position={item.pos as [number, number, number]}>
            <boxGeometry args={[1.8, 1.6, 1.8]} />
            <meshStandardMaterial color={item.color} emissive={item.color} emissiveIntensity={0.18} />
          </mesh>
        ))}

        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[2.6, 2.8, 2.6]} />
          <meshStandardMaterial color="#d7e5ff" />
        </mesh>
      </group>

      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3.7} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'lobby' | 'match' | 'results'>('menu');
  const [name, setName] = useState('Agent Zero');
  const [selectedColor, setSelectedColor] = useState('#22d3ee');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [voteTarget, setVoteTarget] = useState('');

  useEffect(() => {
    const s = io('http://localhost:4000', { transports: ['websocket'] });
    s.on('connect', () => {
      setConnected(true);
      setPlayerId(s.id);
    });
    s.on('disconnect', () => setConnected(false));
    s.on('roomState', (state: RoomState) => {
      setRoom(state);
      if (state.phase && state.phase !== 'WAITING_FOR_PLAYERS') {
        setScreen('match');
      } else if (state.code) {
        setScreen('lobby');
      }
    });
    s.on('matchResults', (results: { title: string; summary: string; teamProgress: number; personal: string }) => {
      setRoom((prev) => ({ ...(prev ?? { code: '', phase: 'RESULTS', timer: 0, players: [], hostId: '', actions: [] }), results, phase: 'RESULTS' }));
      setScreen('results');
    });
    s.on('errorMessage', (message: string) => setError(message));
    setSocket(s);

    return () => s.disconnect();
  }, []);

  const canStartMatch = room && room.players.length >= 4 && room.players.every((player) => player.ready);

  const currentPlayer = useMemo(() => room?.players.find((p) => p.id === playerId) ?? null, [room, playerId]);

  const createRoom = () => {
    if (!socket) return;
    socket.emit('createRoom', { name, color: selectedColor });
    setScreen('lobby');
  };

  const joinRoom = () => {
    if (!socket) return;
    socket.emit('joinRoom', { code: joinCode.trim().toUpperCase(), name, color: selectedColor });
    setScreen('lobby');
  };

  const toggleReady = () => {
    socket?.emit('toggleReady');
  };

  const startMatch = () => {
    socket?.emit('startMatch');
  };

  const completeMission = (missionId: string) => {
    socket?.emit('completeMission', { missionId });
  };

  const tradeEvidence = (fromId: string, toId: string) => {
    socket?.emit('tradeEvidence', { fromId, toId });
  };

  const submitVote = () => {
    if (!voteTarget) return;
    socket?.emit('submitVote', { targetId: voteTarget });
  };

  const requestDiscussion = () => {
    socket?.emit('requestDiscussion');
  };

  return (
    <div className="app-shell">
      <div className="background-scene">
        <BackgroundScene />
      </div>

      <header className="topbar">
        <div className="logo-block">
          <span className="logo-kicker">GAMEVOLT STUDIOS</span>
          <h1>SECRET SQUAD</h1>
        </div>
        <div className="status-pill">{connected ? 'ONLINE' : 'OFFLINE'}</div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {screen === 'menu' && (
        <main className="menu-panel panel">
          <div className="menu-grid">
            <div>
              <p className="eyebrow">Trust nobody. Play everybody.</p>
              <h2>Build a room. Bluff. Solve. Survive.</h2>
              <div className="input-row">
                <label>
                  Player name
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              </div>
              <div className="input-row">
                <label>
                  Color
                  <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} />
                </label>
              </div>

              <div className="button-stack">
                <button onClick={createRoom}>Create private room</button>
                <div className="inline-join">
                  <input placeholder="Room code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                  <button onClick={joinRoom}>Join</button>
                </div>
              </div>
            </div>

            <div className="side-list">
              <h3>Character presets</h3>
              {ROLE_OPTIONS.map((role) => (
                <div key={role} className="chip">{role}</div>
              ))}
              <h3>Mission types</h3>
              {['POWER SURGE', 'MISSING EVIDENCE', 'CODE BREAKER', 'REACTOR RESCUE'].map((mission) => (
                <div key={mission} className="chip subtle">{mission}</div>
              ))}
            </div>
          </div>
        </main>
      )}

      {screen === 'lobby' && room && (
        <main className="panel lobby-panel">
          <div className="lobby-header">
            <div>
              <p>Room code</p>
              <h2>{room.code}</h2>
            </div>
            <button onClick={toggleReady}>{currentPlayer?.ready ? 'Ready ✓' : 'Ready up'}</button>
          </div>

          <div className="player-list">
            {room.players.map((player) => (
              <div key={player.id} className="player-card">
                <span className="avatar" style={{ background: player.color }} />
                <div>
                  <strong>{player.name}</strong>
                  <small>{player.host ? 'Host' : 'Agent'} • {player.ready ? 'Ready' : 'Not ready'}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="button-row">
            <button onClick={startMatch} disabled={!canStartMatch}>Start match</button>
            <button onClick={requestDiscussion}>Request discussion</button>
          </div>
        </main>
      )}

      {screen === 'match' && room && (
        <main className="panel match-panel">
          <div className="hud-top">
            <div>
              <small>PHASE</small>
              <h3>{room.phase}</h3>
            </div>
            <div>
              <small>TIMER</small>
              <h3>{room.timer}s</h3>
            </div>
            <div>
              <small>ROLE</small>
              <h3>{room.role ?? '—'}</h3>
            </div>
            <div>
              <small>OBJECTIVE</small>
              <h3>{room.objective ?? '—'}</h3>
            </div>
          </div>

          <div className="match-grid">
            <section className="mission-panel">
              <h3>Objectives</h3>
              {room.actions?.map((action) => (
                <button key={action.missionId} className="mission-btn" onClick={() => completeMission(action.missionId)}>
                  {action.label} <span>{action.status}</span>
                </button>
              ))}
            </section>

            <section className="evidence-panel">
              <h3>Evidence</h3>
              {room.evidence.length ? room.evidence.map((item) => (
                <div key={item.id} className="evidence-card">
                  <strong>{item.type}</strong>
                  <small>{item.authenticity} • Holder: {item.holder}</small>
                </div>
              )) : <p>No evidence acquired yet.</p>}

              <div className="trade-box">
                <button onClick={() => tradeEvidence('demo-from', 'demo-to')}>Trade clue</button>
              </div>
            </section>

            <section className="vote-panel">
              <h3>Voting</h3>
              <select value={voteTarget} onChange={(e) => setVoteTarget(e.target.value)}>
                <option value="">Select target</option>
                {room.players.filter((p) => p.id !== playerId).map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
              <button onClick={submitVote}>Submit vote</button>
              {room.voteSummary && (
                <pre>{JSON.stringify(room.voteSummary, null, 2)}</pre>
              )}
            </section>
          </div>
        </main>
      )}

      {screen === 'results' && room?.results && (
        <main className="panel results-panel">
          <h2>{room.results.title}</h2>
          <p>{room.results.summary}</p>
          <div className="results-stats">
            <div><small>Team progress</small><strong>{room.results.teamProgress}%</strong></div>
            <div><small>Personal result</small><strong>{room.results.personal}</strong></div>
          </div>
          <div className="button-row">
            <button onClick={() => setScreen('menu')}>Main menu</button>
            <button onClick={() => setScreen('lobby')}>Lobby</button>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
