// Retroactively remove suspected bot clicks from link_clicks.
//
// Historical clicks weren't tagged with user-agent, so we rely on two
// signals that strongly correlate with carrier scanners / link previewers:
//
//   1. Clicks within BOT_WINDOW_SECONDS of the matching outbound Message's
//      createdAt — carrier scanners pre-fetch within seconds of delivery,
//      well before a human would plausibly read + tap.
//   2. Duplicate clicks for the same (linkId, subscriberId) — keep the
//      latest, drop earlier ones (the latest is the most likely human tap
//      after any pre-fetch noise).
//
// Run with --dry-run first (default). Pass --apply to actually delete.

import { config } from 'dotenv';
import { PrismaClient } from '@/generated/prisma';

config();

const BOT_WINDOW_SECONDS = 30;

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();

  console.log(`\n🧹 Bot click cleanup — mode: ${apply ? 'APPLY (deleting)' : 'DRY RUN'}\n`);

  const clicks = await prisma.linkClick.findMany({
    include: {
      link: { select: { broadcastId: true } },
    },
    orderBy: { clickedAt: 'asc' },
  });

  console.log(`Total clicks in DB: ${clicks.length}`);

  const broadcastIds = [
    ...new Set(
      clicks
        .map((c) => c.link.broadcastId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const sendTimesByBroadcastSubscriber = new Map<string, Date>();
  for (const bId of broadcastIds) {
    const messages = await prisma.message.findMany({
      where: { broadcastId: bId, direction: 'OUTBOUND' },
      select: { phoneNumber: true, createdAt: true },
    });
    const phoneNumbers = [...new Set(messages.map((m) => m.phoneNumber))];
    const subs = await prisma.subscriber.findMany({
      where: { phoneNumber: { in: phoneNumbers } },
      select: { id: true, phoneNumber: true },
    });
    const phoneToSub = new Map(subs.map((s) => [s.phoneNumber, s.id]));
    for (const m of messages) {
      const sid = phoneToSub.get(m.phoneNumber);
      if (!sid) continue;
      sendTimesByBroadcastSubscriber.set(`${bId}:${sid}`, m.createdAt);
    }
  }

  const toDelete = new Set<string>();
  let earlyWindowHits = 0;
  let dupeHits = 0;

  for (const c of clicks) {
    if (!c.subscriberId || !c.link.broadcastId) continue;
    const sentAt = sendTimesByBroadcastSubscriber.get(
      `${c.link.broadcastId}:${c.subscriberId}`
    );
    if (!sentAt) continue;
    const deltaSec = (c.clickedAt.getTime() - sentAt.getTime()) / 1000;
    if (deltaSec >= 0 && deltaSec <= BOT_WINDOW_SECONDS) {
      toDelete.add(c.id);
      earlyWindowHits++;
    }
  }

  const byKey = new Map<string, typeof clicks>();
  for (const c of clicks) {
    if (!c.subscriberId) continue;
    const key = `${c.linkId}:${c.subscriberId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(c);
  }
  for (const group of byKey.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort(
      (a, b) => b.clickedAt.getTime() - a.clickedAt.getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      if (!toDelete.has(sorted[i].id)) dupeHits++;
      toDelete.add(sorted[i].id);
    }
  }

  console.log(`\nFlagged for deletion:`);
  console.log(`  • Within ${BOT_WINDOW_SECONDS}s of send (carrier scanners): ${earlyWindowHits}`);
  console.log(`  • Duplicates per (link, subscriber), keeping latest: ${dupeHits}`);
  console.log(`  • Unique click rows to delete: ${toDelete.size}`);
  console.log(`  • Remaining after cleanup: ${clicks.length - toDelete.size}\n`);

  const byBroadcast = new Map<string, { before: number; afterDelete: number }>();
  for (const c of clicks) {
    const b = c.link.broadcastId;
    if (!b) continue;
    if (!byBroadcast.has(b)) byBroadcast.set(b, { before: 0, afterDelete: 0 });
    byBroadcast.get(b)!.before++;
    if (toDelete.has(c.id)) byBroadcast.get(b)!.afterDelete++;
  }

  const broadcasts = await prisma.broadcast.findMany({
    where: { id: { in: broadcastIds } },
    select: { id: true, name: true, createdAt: true },
  });
  const bNames = new Map(broadcasts.map((b) => [b.id, b.name || b.id.slice(0, 8)]));

  console.log('Per broadcast (clicks before → after):');
  const rows = [...byBroadcast.entries()].sort((a, b) => b[1].before - a[1].before);
  for (const [bId, stats] of rows) {
    const name = bNames.get(bId) || bId.slice(0, 8);
    console.log(`  ${name.padEnd(40)} ${stats.before} → ${stats.before - stats.afterDelete}`);
  }

  if (!apply) {
    console.log('\n⚠️  Dry run — no rows deleted. Re-run with --apply to commit.\n');
    await prisma.$disconnect();
    return;
  }

  const ids = [...toDelete];
  const batchSize = 500;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const res = await prisma.linkClick.deleteMany({ where: { id: { in: batch } } });
    deleted += res.count;
    console.log(`  deleted ${deleted}/${ids.length}`);
  }

  console.log(`\n✅ Done. Deleted ${deleted} click rows.\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
