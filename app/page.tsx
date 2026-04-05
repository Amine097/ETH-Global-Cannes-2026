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

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [pendingBattle, setPendingBattle] = useState<PendingBattle | null>(null);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("player");
    // const worldVerified = localStorage.getItem("world_verified") === "true";

    if (saved) {
      try {
        const p = JSON.parse(saved) as PlayerData;
        // World ID check disabled for now — skip verify step
        // if (p.publicKey && p.username && worldVerified) {
        if (p.publicKey && p.username) {
          setPlayer(p);
          // Fetch wallet address
          fetch(`/api/players/check?pk=${encodeURIComponent(p.publicKey)}`)
            .then(r => r.json())
            .then(d => { if (d.player?.walletAddress) setWalletAddress(d.player.walletAddress); })
            .catch(() => {});
          setView("profile");
          return;
        }
        // World ID re-verify disabled for now
        // if (p.publicKey && p.username && !worldVerified) {
        //   setPlayer(p);
        //   setView("verify");
        //   return;
        // }
      } catch { /* ignore */ }
    }

    // World ID redirect check disabled for now
    // const pending = localStorage.getItem("pending_verify");
    // if (pending === "true") {
    //   setView("verify");
    //   return;
    // }

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

    // If player already exists (re-verify flow), go straight to profile
    if (player) {
      setView("profile");
      return;
    }

    setView("scan");
  }

  async function handleScan(data: ScanData) {
    // Check if this bracelet is already bound to an account
    const res = await fetch(`/api/players/check?pk=${encodeURIComponent(data.publicKey)}`);
    const check = await res.json();

    if (check.registered && check.player.username) {
      // Already bound → log them in directly
      const p: PlayerData = {
        publicKey: check.player.publicKey,
        etherAddress: check.player.etherAddress,
        username: check.player.username,
      };
      setPlayer(p);
      setWalletAddress(check.player.walletAddress ?? "");
      localStorage.setItem("player", JSON.stringify(p));
      setView("profile");
    } else if (check.registered && !check.player.username) {
      // Registered but no username yet → go to username chooser
      setScanData(data);
      setView("username");
    } else {
      // New bracelet → go to username chooser
      setScanData(data);
      setView("username");
    }
  }

  function handleConnectWallet() {
    setView("wallet-connect");
  }

  function handleWalletConnected(address: string) {
    setWalletAddress(address);
    setView("profile");
  }

  function handleLogout() {
    localStorage.removeItem("player");
    localStorage.removeItem("world_verified");
    localStorage.removeItem("pending_verify");
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
    return <Welcome onEnter={() => startAuth()} />;
  }

  if (view === "verify") {
    return (
      <WorldVerify
        onVerified={handleVerified}
        onBack={() => {
          localStorage.removeItem("pending_verify");
          setView("welcome");
        }}
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
          localStorage.setItem("player", JSON.stringify(p));
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
          onDone={() => {
            setActiveBattleId(null);
            setView("profile");
          }}
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

  return null;
}
