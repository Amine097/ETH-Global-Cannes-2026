"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Welcome } from "@/components/Welcome";
import { WorldVerify } from "@/components/WorldVerify";
import { BraceletScan } from "@/components/BraceletScan";
import { UsernameChooser } from "@/components/UsernameChooser";
import { NotRegistered } from "@/components/NotRegistered";
import { PlayerProfile } from "@/components/PlayerProfile";
import { BattleScanner } from "@/components/BattleScanner";
import { BattleInvite } from "@/components/BattleInvite";
import { BattleArena } from "@/components/BattleArena";

type View =
  | "loading"
  | "welcome"
  | "verify"
  | "scan-login"
  | "scan-signup"
  | "username"
  | "not-registered"
  | "profile"
  | "battle"
  | "battle-invite"
  | "battle-arena";

type AuthMode = "login" | "signup";

interface PlayerData {
  publicKey: string;
  etherAddress: string;
  username: string;
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
}

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [pendingBattle, setPendingBattle] = useState<PendingBattle | null>(null);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("player");
    const worldVerified = localStorage.getItem("world_verified") === "true";

    if (saved) {
      try {
        const p = JSON.parse(saved) as PlayerData;
        if (p.publicKey && p.username && worldVerified) {
          setPlayer(p);
          setView("profile");
          return;
        }
        // Player exists but not World ID verified — force re-verify
        if (p.publicKey && p.username && !worldVerified) {
          setPlayer(p);
          setAuthMode("login");
          setView("verify");
          return;
        }
      } catch { /* ignore */ }
    }

    const pendingMode = localStorage.getItem("pending_auth_mode");
    if (pendingMode === "login" || pendingMode === "signup") {
      setAuthMode(pendingMode);
      setView("verify");
      return;
    }

    setView("welcome");
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

  function startAuth(mode: AuthMode) {
    setAuthMode(mode);
    localStorage.setItem("pending_auth_mode", mode);
    setView("verify");
  }

  function handleVerified() {
    localStorage.setItem("world_verified", "true");
    localStorage.removeItem("pending_auth_mode");

    // If player already exists (re-verify flow), go straight to profile
    if (player) {
      setView("profile");
      return;
    }

    setView(authMode === "login" ? "scan-login" : "scan-signup");
  }

  async function handleLoginScan(data: ScanData) {
    const res = await fetch(`/api/players/check?pk=${encodeURIComponent(data.publicKey)}`);
    const check = await res.json();

    if (check.registered && check.player.username) {
      const p: PlayerData = {
        publicKey: check.player.publicKey,
        etherAddress: check.player.etherAddress,
        username: check.player.username,
      };
      setPlayer(p);
      localStorage.setItem("player", JSON.stringify(p));
      setView("profile");
    } else {
      setView("not-registered");
    }
  }

  function handleSignupScan(data: ScanData) {
    setScanData(data);
    setView("username");
  }

  function handleLogout() {
    localStorage.removeItem("player");
    localStorage.removeItem("world_verified");
    localStorage.removeItem("pending_auth_mode");
    pollingRef.current = false;
    setPlayer(null);
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
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
      </main>
    );
  }

  if (view === "welcome") {
    return (
      <Welcome
        onLogin={() => startAuth("login")}
        onSignup={() => startAuth("signup")}
      />
    );
  }

  if (view === "verify") {
    return (
      <WorldVerify
        onVerified={handleVerified}
        onBack={() => {
          localStorage.removeItem("pending_auth_mode");
          setView("welcome");
        }}
      />
    );
  }

  if (view === "scan-login") {
    return <BraceletScan mode="login" onResult={handleLoginScan} onBack={() => setView("welcome")} />;
  }

  if (view === "scan-signup") {
    return <BraceletScan mode="signup" onResult={handleSignupScan} onBack={() => setView("welcome")} />;
  }

  if (view === "not-registered") {
    return <NotRegistered onBack={() => setView("welcome")} />;
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
          localStorage.setItem("player", JSON.stringify(p));
          setView("profile");
        }}
      />
    );
  }

  if (view === "battle-invite" && pendingBattle) {
    return (
      <BattleInvite
        attackerUsername={pendingBattle.attackerUsername}
        attackerLevel={pendingBattle.attackerLevel}
        attackerSkin={pendingBattle.attackerSkin}
        attackerRank={pendingBattle.attackerRank}
        onAccept={handleAcceptBattle}
        onDecline={handleDeclineBattle}
      />
    );
  }

  if (view === "battle-arena" && activeBattleId && player) {
    return (
      <BattleArena
        battleId={activeBattleId}
        playerPk={player.publicKey}
        role="defender"
        onDone={() => {
          setActiveBattleId(null);
          setView("profile");
        }}
      />
    );
  }

  if (view === "battle" && player) {
    return (
      <BattleScanner
        playerPk={player.publicKey}
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
        onBattle={() => setView("battle")}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}
