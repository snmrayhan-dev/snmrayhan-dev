// Node.js 18+ built-in fetch script to generate a 100% crash-free Streak SVG
const fs = require('fs');
const path = require('path');

const USERNAME = 'snmrayhan-dev';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function fetchGraphQL(query, variables = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'GitHub-Streak-Action'
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

async function getContributions() {
  const queryYears = `
    query($login: String!) {
      user(login: $login) {
        createdAt
        contributionsCollection {
          contributionYears
        }
      }
    }
  `;

  const data = await fetchGraphQL(queryYears, { login: USERNAME });
  const years = data.user.contributionsCollection.contributionYears;

  let allDays = [];

  for (const year of years) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    const queryDays = `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const yearData = await fetchGraphQL(queryDays, { login: USERNAME, from, to });
    const weeks = yearData.user.contributionsCollection.contributionCalendar.weeks;
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        allDays.push(day);
      }
    }
  }

  // Deduplicate and sort by date ascending
  const dayMap = new Map();
  for (const d of allDays) {
    dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.contributionCount);
  }

  const sortedDates = Array.from(dayMap.keys()).sort();
  let totalContributions = 0;
  for (const count of dayMap.values()) {
    totalContributions += count;
  }

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let currentStreakStart = '';
  let currentStreakEnd = '';
  let longestStreakStart = '';
  let longestStreakEnd = '';
  let tempStreakStart = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const count = dayMap.get(date);

    if (count > 0) {
      if (tempStreak === 0) tempStreakStart = date;
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStreakStart = tempStreakStart;
        longestStreakEnd = date;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Calculate current streak ending today or yesterday
  let idx = sortedDates.length - 1;
  // skip future dates if any
  while (idx >= 0 && sortedDates[idx] > todayStr) idx--;

  if (idx >= 0 && sortedDates[idx] === todayStr && dayMap.get(todayStr) === 0) {
    idx--; // today not committed yet, check yesterday
  }

  while (idx >= 0 && dayMap.get(sortedDates[idx]) > 0) {
    if (currentStreak === 0) currentStreakEnd = sortedDates[idx];
    currentStreak++;
    currentStreakStart = sortedDates[idx];
    idx--;
  }

  const firstDate = sortedDates[0] || '2025-10-23';

  function formatDate(dStr) {
    if (!dStr) return '';
    const date = new Date(dStr);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  }

  function formatShortDate(dStr) {
    if (!dStr) return '';
    const date = new Date(dStr);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  }

  const totalDateRange = `${formatDate(firstDate)} - Present`;
  const currentStreakRange = currentStreak > 0 ? `${formatShortDate(currentStreakStart)} - ${formatShortDate(currentStreakEnd)}` : 'No active streak';
  const longestStreakRange = longestStreak > 0 ? `${formatShortDate(longestStreakStart)} - ${formatShortDate(longestStreakEnd)}` : 'None';

  return {
    totalContributions,
    currentStreak,
    longestStreak,
    totalDateRange,
    currentStreakRange,
    longestStreakRange
  };
}

function generateSVG(data) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 495 195" width="495" height="195">
  <defs>
    <style>
      .bg { fill: #ffffff; stroke: #d0d7de; stroke-width: 1.5; rx: 10px; }
      .stat-num { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; fill: #1f2328; text-anchor: middle; }
      .current-num { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; fill: #0969da; text-anchor: middle; }
      .stat-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; fill: #57606a; text-anchor: middle; }
      .current-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; fill: #0969da; text-anchor: middle; }
      .stat-date { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; fill: #6e7781; text-anchor: middle; }
      .divider { stroke: #d0d7de; stroke-width: 1; stroke-dasharray: 2 2; }
      .ring { fill: none; stroke: #0969da; stroke-width: 4; stroke-linecap: round; }
      .ring-bg { fill: none; stroke: #eaeef2; stroke-width: 4; }
      .fire { fill: #0969da; }
    </style>
  </defs>

  <!-- Background -->
  <rect class="bg" x="1" y="1" width="493" height="193" rx="10" />

  <!-- Dividers -->
  <line class="divider" x1="165" y1="30" x2="165" y2="165" />
  <line class="divider" x1="330" y1="30" x2="330" y2="165" />

  <!-- Left: Total Contributions -->
  <g transform="translate(82.5, 0)">
    <text class="stat-num" x="0" y="76">${data.totalContributions}</text>
    <text class="stat-label" x="0" y="112">Total Contributions</text>
    <text class="stat-date" x="0" y="136">${data.totalDateRange}</text>
  </g>

  <!-- Center: Current Streak -->
  <g transform="translate(247.5, 0)">
    <!-- Ring -->
    <circle class="ring-bg" cx="0" cy="68" r="28" />
    <circle class="ring" cx="0" cy="68" r="28" stroke-dasharray="176" stroke-dashoffset="30" transform="rotate(-90 0 68)" />
    
    <!-- Flame Icon -->
    <path class="fire" d="M -0.5 32 C -1.5 35 -3 37 -3 40 C -3 42.5 -1 44.5 1.5 44.5 C 4 44.5 6 42.5 6 40 C 6 38 4.5 36.5 3.5 35 C 3.5 37 2.5 38 1.5 38 C 0.5 38 -0.5 37 -0.5 32 Z" />

    <text class="current-num" x="0" y="77">${data.currentStreak}</text>
    <text class="current-label" x="0" y="122">Current Streak</text>
    <text class="stat-date" x="0" y="144">${data.currentStreakRange}</text>
  </g>

  <!-- Right: Longest Streak -->
  <g transform="translate(412.5, 0)">
    <text class="stat-num" x="0" y="76">${data.longestStreak}</text>
    <text class="stat-label" x="0" y="112">Longest Streak</text>
    <text class="stat-date" x="0" y="136">${data.longestStreakRange}</text>
  </g>
</svg>`;
}

async function main() {
  try {
    console.log('Fetching contributions for', USERNAME);
    const data = await getContributions();
    console.log('Stats calculated:', data);

    const svg = generateSVG(data);
    const outputPath = path.join(process.cwd(), 'profile-streak.svg');
    fs.writeFileSync(outputPath, svg, 'utf8');
    console.log('Successfully generated profile-streak.svg at', outputPath);
  } catch (err) {
    console.error('Error generating streak SVG:', err);
    process.exit(1);
  }
}

main();
