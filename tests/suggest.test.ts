import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestStats } from '../src/domain/habits/suggest.ts';
import { finalBossParty, emptyData } from '../src/domain/game.ts';

test('suggests stats from the habit name', () => {
  const s = suggestStats('Study for exams');
  assert.equal(s[0].stat, 'INT');
  assert.ok(s.length <= 2);
});

test('limit habits like smoking point to Constitution', () => {
  assert.ok(suggestStats('Smoking').some((s) => s.stat === 'CON'));
});

test('falls back to the current class when the name gives no clue', () => {
  const s = suggestStats('Xyzzy', 'warrior');
  assert.deepEqual(s.map((x) => x.stat), ['STR', 'CON']);
});

test('Final Boss party = archived characters + live Season 4 character', () => {
  const snap = (id: string, seasonId: string) => ({
    characterId: id, seasonId, name: id, classId: 'mage', level: 1,
    stats: { STR: 5, DEX: 5, INT: 9, CON: 4, WIS: 7, CHA: 5 }, equipment: [], frozenAt: '',
  });
  const d = {
    ...emptyData(),
    characters: [
      { id: 'a', seasonId: '2027-S1', name: 'A', classId: 'mage', createdAt: '', equipment: [], snapshot: snap('a', '2027-S1') },
      // Season 2 skipped, Season 3 skipped
      { id: 'd', seasonId: '2027-S4', name: 'D', classId: 'warrior', createdAt: '', equipment: [] },
    ],
  };
  const party = finalBossParty(d, new Date(2027, 11, 28));
  assert.deepEqual(party.map((p) => p.characterId), ['a', 'd']);
});

test('moving the dev clock back into a season thaws its character', async () => {
  const { archiveEndedSeasons } = await import('../src/domain/game.ts');
  const d = { ...emptyData(), characters: [{ id: 'c', seasonId: '2027-S1', name: 'C', classId: 'mage', createdAt: '', equipment: [] }] };
  const frozen = archiveEndedSeasons(d, new Date(2027, 4, 1));
  assert.ok(frozen.characters[0].snapshot);
  const thawed = archiveEndedSeasons(frozen, new Date(2027, 1, 1));
  assert.equal(thawed.characters[0].snapshot, undefined);
});

test('old saves migrate VIT to CON', async () => {
  const { migrate } = await import('../src/data/storage.ts');
  const old = {
    schemaVersion: 1,
    habits: [{ id: 'h', primaryStat: 'VIT', secondaryStat: 'WIS' }],
    characters: [{ id: 'c', snapshot: { stats: { STR: 5, VIT: 7 } } }],
  };
  const d = migrate(old);
  assert.equal(d.schemaVersion, 3);
  assert.equal(d.habits[0].primaryStat, 'CON');
  assert.deepEqual(d.characters[0].snapshot!.stats, { STR: 5, CON: 7 } as any);
});
