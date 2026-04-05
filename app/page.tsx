"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Welcome } from "@/components/Welcome";
import { WorldVerify } from "@/components/WorldVerify";
import { BraceletScan } from "@/components/BraceletScan";
import { UsernameChooser } from "@/components/UsernameChooser";
import { PlayerProfile } from "@/components/PlayerProfile";
import { BattleScanner } from "@/components/BattleScanner";
import { BattleInvite } from "@/components/BattleInvite";
import { BattleArena } from "@/components/BattleArena";
import { WalletConnect } from "@/components/WalletConnect";
import { WithDynamic } from "@/components/WithDynamic";

// Session expires after 4 hours
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

type View =
  | "loading"
  | "welcome"
  | "verify"
  | "scan"
  | "username"
  | "profile"
  | "wallet-connect"
  | "battle"
  | "battle-invite"
  | "battle-arena";

interface PlayerData {
  publicKey: string;
  etherAddress: string;
  username: string;
}

interface SessionData {
  player: PlayerData;
  loginAt: number;
}

interface ScanData {
  challenge: string;
  signature: string;
  publicKey: string;
  etherAddress: string;
}

interface PendingBattle {
  id: string;
  attackerUsername: string;
  attackerLevel: number;
  attackerSkin: number;
  attackerRank: string;
  battleMode: "free" | "wager";
  wagerAmount?: string;
}

// ── Session helpers ──

function saveSession(player: PlayerData) {
  const session: SessionData = { player, loginAt: Date.now() };
  localStorage.setItem("session", JSON.stringify(session));
  // Clean old key
  localStorage.removeItem("player");
}

function loadSession(): PlayerData | null {
  // Try new session format
  const raw = localStorage.getItem("session");
  if (raw) {
    try {
      const session = JSON.parse(raw) as SessionData;
      // Check expiration
      if (Date.now() - session.loginAt > SESSION_TTL_MS) {
        localStorage.removeItem("session");
        return null;
      }
      if (session.player?.publicKey && session.player?.username) {
        return session.player;
      }
    } catch { /* corrupt */ }
    localStorage.removeItem("session");
  }
  // Migrate old format
  const old = localStorage.getItem("player");
  if (old) {
    try {
      const p = JSON.parse(old) as PlayerData;
      if (p.publicKey && p.username) {
        saveSession(p); // migrate
        return p;
      }
    } catch { /* corrupt */ }
    localStorage.removeItem("player");
  }
  return null;
}

function clearSession() {
  localStorage.removeItem("session");
  localStorage.removeItem("player");
  localStorage.removeItem("world_verified");
  localStorage.removeItem("pending_verify");
}

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [pendingBattle, setPendingBattle] = useState<PendingBattle | null>(null);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const pollingRef = useRef(false);

  // ── Init: load session + verify with server ──
  useEffect(() => {
    const p = loadSession();
    if (!p) {
      setView("welcome");
      return;
    }

    // Verify the player still exists on the server (ENS-backed)
    fetch(`/api/players/check?pk=${encodeURIComponent(p.publicKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.registered && data.player?.username) {
          // Server confirmed — log in
          const confirmed: PlayerData = {
            publicKey: data.player.publicKey,
            etherAddress: data.player.etherAddress,
            username: data.player.username,
          };
          setPlayer(confirmed);
          setWalletAddress(data.player.walletAddress ?? "");
          saveSession(confirmed); // refresh session timestamp
          setView("profile");
        } else {
          // Server says not registered — session is stale
          clearSession();
          setView("welcome");
        }
      })
      .catch(() => {
        // Network error — trust local session as fallback
        setPlayer(p);
        setView("profile");
      });
  }, []);

  // ── Poll for incoming battle invites while on profile ──
  const pollForInvites = useCallback(() => {
    if (!player) return;
    pollingRef.current = true;

    const interval = setInterval(async () => {
      if (!pollingRef.current) { clearInterval(interval); return; }
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll-invite", playerPk: player.publicKey }),
        });
        const data = await res.json();
        if (data.battle) {
          pollingRef.current = false;
          clearInterval(interval);
          setPendingBattle({
            id: data.battle.id,
            attackerUsername: data.battle.attacker.username,
            attackerLevel: data.battle.attacker.level,
            attackerSkin: data.battle.attacker.skinIndex,
            attackerRank: data.battle.attacker.rank,
            battleMode: data.battle.mode ?? "free",
            wagerAmount: data.battle.wagerAmount,
          });
          setView("battle-invite");
        }
      } catch { /* retry */ }
    }, 2000);

    return () => { pollingRef.current = false; clearInterval(interval); };
  }, [player]);

  useEffect(() => {
    if (view === "profile" && player) {
      const cleanup = pollForInvites();
      return cleanup;
    } else {
      pollingRef.current = false;
    }
  }, [view, player, pollForInvites]);

  // ── Auth flow ──

  function startAuth() {
    // World ID verify disabled for now — go straight to scan
    // localStorage.setItem("pending_verify", "true");
    // setView("verify");
    setView("scan");
  }

  function handleVerified() {
    localStorage.setItem("world_verified", "true");
    localStorage.removeItem("pending_verify");
    if (player) { setView("profile"); return; }
    setView("scan");
  }

  async function handleScan(data: ScanData) {
    const res = await fetch(`/api/players/check?pk=${encodeURIComponent(data.publicKey)}`);
    const check = await res.json();

    if (check.registered && check.player.username) {
      const p: PlayerData = {
        publicKey: check.player.publicKey,
        etherAddress: check.player.etherAddress,
        username: check.player.username,
      };
      setPlayer(p);
      setWalletAddress(check.player.walletAddress ?? "");
      saveSession(p);
      setView("profile");
    } else if (check.registered && !check.player.username) {
      setScanData(data);
      setView("username");
    } else {
      setScanData(data);
      setView("username");
    }
  }

  function handleConnectWallet() { setView("wallet-connect"); }

  function handleWalletConnected(address: string) {
    setWalletAddress(address);
    setView("profile");
  }

  function handleLogout() {
    clearSession();
    pollingRef.current = false;
    setPlayer(null);
    setWalletAddress("");
    setView("welcome");
  }

  // ── Battle invite response ──

  async function handleAcceptBattle() {
    if (!pendingBattle) return;
    await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "respond", battleId: pendingBattle.id, accept: true }),
    });
    setActiveBattleId(pendingBattle.id);
    setPendingBattle(null);
    setView("battle-arena");
  }

  async function handleDeclineBattle() {
    if (!pendingBattle) return;
    await fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "respond", battleId: pendingBattle.id, accept: false }),
    });
    setPendingBattle(null);
    setView("profile");
  }

  // ── Render ──

  if (view === "loading") {
    return (
      <main className="realm-bg flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 spinner-gold" />
      </main>
    );
  }

  if (view === "welcome") {
    return <Welcome onEnter={() => startAuth()} />;
  }

  if (view === "verify") {
    return (
      <WorldVerify
        onVerified={handleVerified}
        onBack={() => { localStorage.removeItem("pending_verify"); setView("welcome"); }}
      />
    );
  }

  if (view === "scan") {
    return <BraceletScan mode="signup" onResult={handleScan} onBack={() => setView("welcome")} />;
  }

  if (view === "username" && scanData) {
    return (
      <UsernameChooser
        publicKey={scanData.publicKey}
        etherAddress={scanData.etherAddress}
        challenge={scanData.challenge}
        signature={scanData.signature}
        onDone={(username) => {
          const p: PlayerData = {
            publicKey: scanData.publicKey,
            etherAddress: scanData.etherAddress,
            username,
          };
          setPlayer(p);
          saveSession(p);
          setView("profile");
        }}
      />
    );
  }

  if (view === "wallet-connect" && player) {
    return (
      <WithDynamic>
        <WalletConnect
          playerPk={player.publicKey}
          onConnected={handleWalletConnected}
          onBack={() => setView("profile")}
        />
      </WithDynamic>
    );
  }

  if (view === "battle-invite" && pendingBattle) {
    return (
      <BattleInvite
        attackerUsername={pendingBattle.attackerUsername}
        attackerLevel={pendingBattle.attackerLevel}
        attackerSkin={pendingBattle.attackerSkin}
        attackerRank={pendingBattle.attackerRank}
        battleMode={pendingBattle.battleMode}
        wagerAmount={pendingBattle.wagerAmount}
        onAccept={handleAcceptBattle}
        onDecline={handleDeclineBattle}
      />
    );
  }

  if (view === "battle-arena" && activeBattleId && player) {
    return (
      <WithDynamic>
        <BattleArena
          battleId={activeBattleId}
          playerPk={player.publicKey}
          role="defender"
          onDone={() => { setActiveBattleId(null); setView("profile"); }}
        />
      </WithDynamic>
    );
  }

  if (view === "battle" && player) {
    return (
      <BattleScanner
        playerPk={player.publicKey}
        hasWallet={!!walletAddress}
        onConnectWallet={handleConnectWallet}
        onBack={() => setView("profile")}
      />
    );
  }

  if (view === "profile" && player) {
    return (
      <PlayerProfile
        etherAddress={player.etherAddress}
        publicKey={player.publicKey}
        username={player.username}
        walletAddress={walletAddress}
        onBattle={() => setView("battle")}
        onConnectWallet={handleConnectWallet}
        onLogout={handleLogout}
      />
    );
  }

  // Fallback — should never happen, but safety net
  return <Welcome onEnter={() => startAuth()} />;
}
