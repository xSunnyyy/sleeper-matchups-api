export default async function handler(req, res) {
  const leagueParam = (req.query.league || "").toLowerCase();
  const week = parseInt(req.query.week) || getCurrentNFLWeek();

  const leagueIds = {
    "veto_city": "1104276981148995584",
    "fight_club": "1121929315211468800",
    "dynasty_gurus": "1214712822336868352",
    "mod_and_friends": "1180912660638216192"
  };

  const leagueId = leagueIds[leagueParam];

  if (!leagueId) {
    return res.status(400).json({ error: "Invalid or missing league" });
  }

  try {
    // Get current rosters and users once
    const [rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
    ]);
    const rosters = await rostersRes.json();
    const users = await usersRes.json();

    const rosterMap = {};
    for (const user of users) {
      const roster = rosters.find(r => r.owner_id === user.user_id);
      if (roster) {
        rosterMap[roster.roster_id] = user.display_name;
      }
    }

    // Initialize win/loss records
    const recordMap = {};
    for (const roster of rosters) {
      recordMap[roster.roster_id] = { wins: 0, losses: 0 };
    }

    // Calculate records from previous weeks
    for (let w = 1; w < week; w++) {
      const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${w}`);
      const matchups = await res.json();

      const grouped = {};
      for (const entry of matchups) {
        if (!entry.matchup_id) continue;
        grouped[entry.matchup_id] = grouped[entry.matchup_id] || [];
        grouped[entry.matchup_id].push(entry);
      }

      Object.values(grouped).forEach((entries) => {
        if (entries.length < 2) return;
        const [a, b] = entries;
        const scoreA = a.points ?? 0;
        const scoreB = b.points ?? 0;

        if (scoreA > scoreB) {
          recordMap[a.roster_id].wins += 1;
          recordMap[b.roster_id].losses += 1;
        } else if (scoreB > scoreA) {
          recordMap[b.roster_id].wins += 1;
          recordMap[a.roster_id].losses += 1;
        }
      });
    }

    // Fetch current week matchups
    const matchupsRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
    const matchups = await matchupsRes.json();

    const grouped = {};
    for (const entry of matchups) {
      if (!entry.matchup_id) continue;
      grouped[entry.matchup_id] = grouped[entry.matchup_id] || [];
      grouped[entry.matchup_id].push(entry);
    }

    let markdown = `## Week ${week} Matchups\n\n`;

    Object.values(grouped).forEach((entries) => {
      if (entries.length < 2) return;
      const [a, b] = entries;

      const nameA = rosterMap[a.roster_id] || `Roster ${a.roster_id}`;
      const nameB = rosterMap[b.roster_id] || `Roster ${b.roster_id}`;
      const recordA = recordMap[a.roster_id] || { wins: 0, losses: 0 };
      const recordB = recordMap[b.roster_id] || { wins: 0, losses: 0 };
      const scoreA = a.points?.toFixed(1) ?? "0.0";
      const scoreB = b.points?.toFixed(1) ?? "0.0";

      const labelA = `${nameA} (${recordA.wins}-${recordA.losses})`;
      const labelB = `${nameB} (${recordB.wins}-${recordB.losses})`;

      let line = "";
      if (parseFloat(scoreA) > parseFloat(scoreB)) {
        line = `**${labelA} ${scoreA}** vs ${labelB} ${scoreB}`;
      } else if (parseFloat(scoreB) > parseFloat(scoreA)) {
        line = `${labelA} ${scoreA} vs **${labelB} ${scoreB}**`;
      } else {
        line = `${labelA} ${scoreA} vs ${labelB} ${scoreB}`;
      }

      markdown += `${line}\n\n`;
    });

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ markdown });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch league data", details: error.message });
  }

  function getCurrentNFLWeek() {
    const nflStart = new Date("2024-09-05T00:00:00Z");
    const today = new Date();
    const diffDays = Math.floor((today - nflStart) / (1000 * 60 * 60 * 24));
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(Math.max(week, 1), 18);
  }
}
