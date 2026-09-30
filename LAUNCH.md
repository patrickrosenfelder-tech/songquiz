# TuneDuel — Public Launch Checklist

**Issue:** PAT-1157 · **Priority:** High  
**Status:** 🚀 Go-Live

---

## Pre-Launch (Complete Before Announcement)

### GitHub Repository
- [x] Rename repo description to "TuneDuel — real-time multiplayer music trivia"
- [x] Update README.md with product name, description, and key features
- [ ] Add repo topics: `music`, `trivia`, `game`, `react`, `multiplayer`
- [ ] Add a screenshot / demo GIF to README
- [ ] Pin repo to GitHub profile
- [ ] Set repo homepage URL once deployed

### Monitoring & Uptime
- [ ] Set up uptime monitoring (UptimeRobot or Better Uptime — free tier)
  - Alert on: HTTP errors, response time > 3 s
  - Notify: email + Slack/Telegram
- [ ] Add Sentry (or equivalent) for JS/server error tracking
  - Set alert threshold: > 5 errors/min triggers notification
- [ ] Confirm health-check endpoint responds at `/health` or `/ping`
- [ ] Set up basic analytics (Plausible, Umami, or PostHog — privacy-friendly)
- [ ] Verify production environment variables are set correctly
- [ ] Confirm CDN / static asset caching is working

---

## Launch Day

### Social Media Announcements

#### Twitter / X
```
🎵 Introducing TuneDuel — the real-time music trivia game where you race to name that song!

Challenge friends, compete against strangers, climb the leaderboard.

Play free at [URL] 👇

#MusicTrivia #TuneDuel #IndieGame #GameDev
```
*Post as a thread: hook tweet → feature highlights → link to play*

#### Reddit
- [ ] Post to r/gamedev — "Show HN: TuneDuel, a real-time multiplayer music trivia game"
- [ ] Post to r/indiegaming
- [ ] Post to r/webgames
- [ ] Post to r/music (check rules — some subreddits restrict self-promotion)

#### Hacker News
- [ ] Submit "Show HN: TuneDuel – Real-Time Multiplayer Song Recognition Game"
  - Include brief description, tech stack, and invite feedback
  - Best times: weekday mornings 8–10 AM EST

#### Discord Communities
- [ ] Post in relevant game-dev Discords
- [ ] Post in music/trivia game communities

### Product Hunt (Optional — Recommended within 7 days)
- [ ] Create Product Hunt maker account
- [ ] Draft product listing:
  - **Name:** TuneDuel
  - **Tagline:** Real-time multiplayer music trivia — name that song!
  - **Thumbnail:** 240×240 logo
  - **Gallery:** 3–5 screenshots or GIF demos
  - **Description:** 260 chars max — hook + key features
- [ ] Line up 5–10 early supporters to upvote on launch day
- [ ] Schedule launch for Tuesday–Thursday (highest traffic days)

---

## Post-Launch: First Week

### User Feedback Collection
- [ ] Add an in-app feedback button (Canny, UserVoice, or simple Google Form)
- [ ] Set up a `#feedback` channel in your Discord / Telegram
- [ ] Send a welcome email to first 50 sign-ups asking 3 questions:
  1. What did you like most?
  2. What was confusing or frustrating?
  3. What feature would make you come back more often?
- [ ] Monitor social mentions: set up Google Alerts for "TuneDuel"

### Bug Triage
- [ ] Review Sentry for launch-day errors
- [ ] Check uptime monitor for any outages
- [ ] Prioritize and hotfix any P0 bugs within 24 hours

---

## First 100 Users Milestone Tracker

| Milestone | Target Date | Actual Date | Notes |
|-----------|-------------|-------------|-------|
| 10 users  | Day 1       |             |       |
| 25 users  | Day 3       |             |       |
| 50 users  | Day 7       |             |       |
| 100 users | Day 14      |             |       |

### Channels Driving Signups (fill in as data arrives)
| Channel        | Users | Conversion Notes |
|----------------|-------|-----------------|
| Twitter/X      |       |                 |
| Reddit         |       |                 |
| Hacker News    |       |                 |
| Product Hunt   |       |                 |
| Direct / Other |       |                 |

### 100-User Celebration Ideas
- Post a "thank you" tweet tagging first users who opted in
- Share a mini retrospective blog post / thread
- Announce first community playlist challenge

---

## Ongoing (Week 2+)

- [ ] Weekly uptime report review
- [ ] Synthesize first batch of user feedback into issues
- [ ] Ship top-requested small feature or fix (shows community you listen)
- [ ] Consider a "refer a friend" mechanic to grow past 100 users organically
- [ ] Evaluate Product Hunt launch if not yet done

---

*Last updated: 2026-09-30*
