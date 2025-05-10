export default async function handler(req, res) {
  const leagueId = "1104276981148995584";
  const week = parseInt(req.query.week) || getCurrentNFLWeek();

  const [matchupsRes, rostersRes, usersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
  ]);

  const matchups = await matchupsRes.json();
  const rosters = await rostersRes.json();
  const users = await usersRes.json();

  const rosterMap = {};
  for (const user of users) {
    const roster = rosters.find(r => r.owner_id === user.user_id);
    if (roster) {
      rosterMap[roster.roster_id] = user.display_name;
    }
  }

  const grouped = {};
  for (const entry of matchups) {
    if (!entry.matchup_id) continue;
    grouped[entry.matchup_id] = grouped[entry.matchup_id] || [];
    grouped[entry.matchup_id].push(entry);
  }

  let markdown = `## Week ${week} Matchups\n\n`;

  Object.values(grouped).forEach(([a, b]) => {
    if (!a || !b) return;
    const nameA = rosterMap[a.roster_id] || "Team A";
    const nameB = rosterMap[b.roster_id] || "Team B";
    markdown += `🏈 ${nameA} vs ${nameB}\n🔢 ${a.points.toFixed(1)} – ${b.points.toFixed(1)}\n\n`;
  });

  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ markdown });

  function getCurrentNFLWeek() {
    const nflStart = new Date("2024-09-05T00:00:00Z");
    const today = new Date();
    const diffDays = Math.floor((today - nflStart) / (1000 * 60 * 60 * 24));
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(Math.max(week, 1), 18); // force range 1–18
  }
}
