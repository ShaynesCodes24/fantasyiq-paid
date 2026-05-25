from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


CORE_POSITIONS = ("QB", "RB", "WR", "TE", "DST", "K")
STARTER_TARGETS = {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "DST": 1, "K": 1}
DEPTH_TARGETS = {"QB": 1, "RB": 4, "WR": 5, "TE": 1, "DST": 1, "K": 1}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def as_number(value: Any, fallback: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def player_name(player: dict[str, Any]) -> str:
    return str(player.get("Player") or player.get("player") or player.get("name") or "Unknown player")


def player_position(player: dict[str, Any]) -> str:
    return str(player.get("Pos") or player.get("position") or "").upper()


def player_value(player: dict[str, Any]) -> float:
    projection = as_number(
        player.get("Native Projection")
        or player.get("Proj PPR Pts")
        or player.get("Projection")
        or player.get("projected")
        or player.get("points")
    )
    value = as_number(player.get("Value Score") or player.get("Value") or player.get("VOR") or player.get("value"))
    upside = as_number(player.get("Upside") or player.get("Ceiling") or player.get("upside"))
    risk = as_number(player.get("Risk") or player.get("risk"))
    rank = as_number(player.get("Rank") or player.get("rank"), 999)
    pos_rank = as_number(player.get("Pos Rank") or player.get("positionRank"), 99)
    position = player_position(player)
    rank_score = max(22.0, min(98.0, 100.0 - max(0.0, rank - 1.0) * 0.55)) if rank < 999 else value or 55.0
    pos_multiplier = 2.2 if position in {"QB", "TE"} else 4.0 if position in {"DST", "K"} else 1.45
    pos_rank_score = max(25.0, min(96.0, 101.0 - pos_rank * pos_multiplier)) if pos_rank < 99 else value or 55.0
    projection_score = max(45.0, min(95.0, projection / 3.4)) if projection else 55.0
    base = value or (rank_score * 0.65 + projection_score * 0.25 + upside * 0.1)
    return round(base * 0.58 + rank_score * 0.18 + pos_rank_score * 0.1 + projection_score * 0.08 + upside * 0.06 - risk * 0.25, 2)


@dataclass
class RosterProfile:
    counts: dict[str, int]
    strengths: list[dict[str, Any]]
    weaknesses: list[dict[str, Any]]
    starter_quality: float
    bench_depth: float
    bye_week_risk: float
    team_strength: float


def roster_counts(roster: list[dict[str, Any]]) -> dict[str, int]:
    counts = {position: 0 for position in CORE_POSITIONS}
    for player in roster:
        position = player_position(player)
        if position in counts:
            counts[position] += 1
    return counts


def evaluate_roster(roster: list[dict[str, Any]]) -> RosterProfile:
    counts = roster_counts(roster)
    by_position = {position: [] for position in CORE_POSITIONS}
    for player in roster:
        position = player_position(player)
        if position in by_position:
            by_position[position].append(player)

    strengths = []
    weaknesses = []
    starter_values = []
    bench_values = []
    bye_weeks: dict[int, int] = {}
    starter_gap_penalty = 0.0
    depth_gap_penalty = 0.0

    for position, players in by_position.items():
        ranked = sorted(players, key=player_value, reverse=True)
        starter_target = STARTER_TARGETS[position]
        depth_target = DEPTH_TARGETS[position]
        starters = ranked[:starter_target]
        bench = ranked[starter_target:]
        starter_score = sum(player_value(player) for player in starters)
        depth_score = sum(player_value(player) for player in bench[: max(0, depth_target - starter_target)])
        starter_values.extend(player_value(player) for player in starters)
        bench_values.extend(player_value(player) for player in bench)

        for player in players:
            bye = int(as_number(player.get("Bye") or player.get("bye"), 0))
            if bye:
                bye_weeks[bye] = bye_weeks.get(bye, 0) + 1

        starter_gap = max(0, starter_target - len(starters))
        depth_gap = max(0, depth_target - len(ranked))
        starter_gap_penalty += starter_gap * (0.5 if position in {"DST", "K"} else 2.0)
        depth_gap_penalty += depth_gap * (0.0 if position in {"DST", "K"} else 0.45)
        position_score = starter_score + depth_score * 0.35 - starter_gap * 7 - depth_gap * 2
        profile = {
            "pos": position,
            "count": len(ranked),
            "starterGap": starter_gap,
            "depthGap": depth_gap,
            "score": round(position_score, 2),
            "topValue": round(player_value(ranked[0]), 2) if ranked else 0,
        }
        if starter_gap or depth_gap or position_score < 18:
            weaknesses.append({**profile, "detail": f"{position} needs {starter_gap} starter and {depth_gap} depth slot(s)."})
        else:
            strengths.append({**profile, "detail": f"{position} has playable starter quality and usable depth."})

    starter_quality = sum(starter_values) / max(1, len(starter_values))
    bench_depth = sum(bench_values) / max(1, len(bench_values))
    bye_week_risk = max(bye_weeks.values(), default=0) * 8.0
    roster_size_bonus = min(6.0, len(roster) * 0.35)
    team_strength = max(
        0.0,
        min(
            100.0,
            starter_quality * 0.86
            + bench_depth * 0.14
            + roster_size_bonus
            + (4.0 if bench_depth == 0 and starter_quality > 0 else 0.0)
            - starter_gap_penalty
            - depth_gap_penalty
            - bye_week_risk * 0.15,
        ),
    )

    return RosterProfile(
        counts=counts,
        strengths=sorted(strengths, key=lambda item: item["score"], reverse=True),
        weaknesses=sorted(weaknesses, key=lambda item: (item["starterGap"], item["depthGap"], -item["score"]), reverse=True),
        starter_quality=round(starter_quality, 2),
        bench_depth=round(bench_depth, 2),
        bye_week_risk=round(bye_week_risk, 2),
        team_strength=round(team_strength, 2),
    )


def best_waiver(roster: list[dict[str, Any]], waiver_pool: list[dict[str, Any]], profile: RosterProfile) -> dict[str, Any] | None:
    weakest_position = profile.weaknesses[0]["pos"] if profile.weaknesses else ""
    weakest_player = min(roster, key=player_value, default=None)
    ranked = sorted(
        waiver_pool,
        key=lambda player: player_value(player) + (8 if player_position(player) == weakest_position else 0),
        reverse=True,
    )
    if not ranked:
        return None
    add = ranked[0]
    gain = player_value(add) - (player_value(weakest_player) if weakest_player else 0)
    return {
        "add": player_name(add),
        "drop": player_name(weakest_player) if weakest_player else "",
        "position": player_position(add),
        "valueGain": round(gain, 2),
        "priority": "high" if gain >= 8 else "medium" if gain >= 3 else "watch",
    }


def best_trade(roster: list[dict[str, Any]], targets: list[dict[str, Any]], profile: RosterProfile) -> dict[str, Any] | None:
    if not roster or not targets:
        return None
    surplus_position = profile.strengths[0]["pos"] if profile.strengths else ""
    need_position = profile.weaknesses[0]["pos"] if profile.weaknesses else ""
    give = sorted(
        roster,
        key=lambda player: (player_position(player) == surplus_position, player_value(player)),
        reverse=True,
    )[0]
    target = sorted(
        targets,
        key=lambda player: player_value(player) + (10 if player_position(player) == need_position else 0),
        reverse=True,
    )[0]
    return {
        "give": player_name(give),
        "get": player_name(target),
        "needPosition": need_position,
        "surplusPosition": surplus_position,
        "valueDelta": round(player_value(target) - player_value(give), 2),
    }


def best_draft_pick(board: list[dict[str, Any]], profile: RosterProfile) -> dict[str, Any] | None:
    need_position = profile.weaknesses[0]["pos"] if profile.weaknesses else ""
    ranked = sorted(
        board,
        key=lambda player: player_value(player) + (7 if player_position(player) == need_position else 0),
        reverse=True,
    )
    if not ranked:
        return None
    pick = ranked[0]
    return {
        "player": player_name(pick),
        "position": player_position(pick),
        "score": player_value(pick),
        "reason": f"{player_position(pick) or 'Player'} is the best blend of board value and roster fit.",
    }


def fantasy_iq_score(profile: RosterProfile, waiver: dict[str, Any] | None, trade: dict[str, Any] | None) -> int:
    score = profile.team_strength
    if waiver and waiver["priority"] == "high":
        score -= 3
    if trade and trade["valueDelta"] > 4:
        score += 2
    score -= min(6, profile.bye_week_risk * 0.12)
    return int(max(1, min(99, round(score))))


def recommendation(payload: dict[str, Any]) -> dict[str, Any]:
    roster = payload.get("roster") if isinstance(payload.get("roster"), list) else []
    waiver_pool = payload.get("waiverPool") if isinstance(payload.get("waiverPool"), list) else []
    trade_targets = payload.get("tradeTargets") if isinstance(payload.get("tradeTargets"), list) else []
    board = payload.get("draftBoard") if isinstance(payload.get("draftBoard"), list) else []

    profile = evaluate_roster(roster)
    waiver = best_waiver(roster, waiver_pool, profile)
    trade = best_trade(roster, trade_targets, profile)
    draft = best_draft_pick(board, profile)
    iq_score = fantasy_iq_score(profile, waiver, trade)

    if waiver and waiver["valueGain"] >= 3:
        action = "ACT_NOW"
        main_move = f"Add {waiver['add']}" + (f" and drop {waiver['drop']}" if waiver["drop"] else "")
        reasons = [
            f"Waiver value gain grades at {waiver['valueGain']}.",
            f"{waiver['position']} maps against the current roster weakness profile.",
            f"Fantasy IQ score is {iq_score}, so an upgrade is more valuable than standing still.",
        ]
    elif trade and trade["valueDelta"] >= 2:
        action = "ACT_NOW"
        main_move = f"Offer {trade['give']} for {trade['get']}"
        reasons = [
            f"Trade value delta is {trade['valueDelta']}.",
            f"The deal turns {trade['surplusPosition'] or 'surplus'} into {trade['needPosition'] or 'need'} help.",
            f"Starter quality is {profile.starter_quality}; roster fit matters more than bench points.",
        ]
    elif draft:
        action = "TARGET"
        main_move = f"Draft {draft['player']}"
        reasons = [draft["reason"], f"Draft score is {draft['score']}.", "The board path beats a low-edge waiver or trade move."]
    else:
        action = "WAIT"
        main_move = "Do Nothing"
        reasons = [
            "No backend roster, waiver, trade, or draft payload has a positive edge yet.",
            "Holding waiver priority, FAAB, and trade flexibility is currently the strongest default.",
            "Send roster and market snapshots to unlock a stronger recommendation.",
        ]

    return {
        "action": action,
        "mainMove": main_move,
        "supportingQuantitativeReasons": reasons,
        "riskWarning": f"Bye week cluster risk is {profile.bye_week_risk}; monitor schedule concentration before locking moves.",
        "alternativePath": "Refresh after ESPN roster sync, injury news, or a meaningful board change.",
        "confidenceScore": max(35, min(88, iq_score)),
        "dataFreshnessStatus": f"Backend engine evaluated at {utc_now()}.",
    }


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    profile = evaluate_roster(payload.get("roster") if isinstance(payload.get("roster"), list) else [])
    waiver = best_waiver(
        payload.get("roster") if isinstance(payload.get("roster"), list) else [],
        payload.get("waiverPool") if isinstance(payload.get("waiverPool"), list) else [],
        profile,
    )
    trade = best_trade(
        payload.get("roster") if isinstance(payload.get("roster"), list) else [],
        payload.get("tradeTargets") if isinstance(payload.get("tradeTargets"), list) else [],
        profile,
    )
    draft = best_draft_pick(payload.get("draftBoard") if isinstance(payload.get("draftBoard"), list) else [], profile)
    score = fantasy_iq_score(profile, waiver, trade)
    return {
        "teamStrength": profile.team_strength,
        "rosterWeakness": profile.weaknesses,
        "starterQuality": profile.starter_quality,
        "benchDepth": profile.bench_depth,
        "byeWeekRisk": profile.bye_week_risk,
        "tradeValue": trade,
        "waiverPriority": waiver,
        "draftRecommendation": draft,
        "fantasyIqScore": score,
        "recommendation": recommendation(payload),
    }
