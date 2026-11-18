export const STAT_KEYS = ['M', 'AC', 'AB', 'F', 'R', 'Fe', 'I', 'A', 'Ld'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export interface Model {
  id: string;
  kind: 'hero' | 'hench';
  hired?: boolean; // mercenario ingaggiato
  name: string;
  role: string;
  count: number; // solo per i gruppi di seguaci
  stats: Stats;
  equip: string;
  skills: string;
  injuries: string;
  xp: number;
  adv: number; // avanzamenti già fatti
  cost: number;
  dead: boolean;
}

export interface Band {
  id: string;
  at: number;
  name: string;
  type: string;
  templateId?: string; // banda del catalogo da cui è nata
  player: string;
  gold: number;
  shards: number;
  notes: string;
  stash: string[];
  models: Model[];
}

export interface Settings {
  ptsWin: number;
  ptsDraw: number;
  ptsLoss: number;
  baseRating: number;
  startGold: number;
  heroAdv: string;
  henchAdv: string;
}

export interface Campaign {
  name: string;
  week: number;
  notes: string;
  settings: Settings;
}

export interface Match {
  id: string;
  at: number;
  week: number;
  scenario: string;
  a: string;
  b: string;
  result: 'a' | 'b' | 'd';
}

export interface LogEntry {
  id: string;
  at: number;
  week: number;
  band: string;
  text: string;
}

export interface TableRow {
  id: string;
  from: number;
  to: number;
  title: string;
  text: string;
  gold: number;
  shards: number;
  item: string;
}

export interface TableDef {
  id: string;
  at: number;
  name: string;
  die: string; // d6, 2d6, d66, Nd6 (un d6 per ogni eroe)
  note: string;
  rows: TableRow[];
}

export interface AppState {
  v: 1;
  t: number; // ultima modifica locale
  campaign: Campaign;
  bands: Band[];
  matches: Match[];
  log: LogEntry[];
  tables: TableDef[];
}

/* ---- catalogo (dati presi dal manuale, vedi src/data/README.md) ---- */
export interface UnitTemplate {
  id: string;
  name: string;
  role: string;
  cost: number;
  max?: number;
  stats: Stats;
  equip?: string;
  skills?: string;
  notes?: string;
}

export interface BandTemplate {
  id: string;
  name: string;
  startGold: number;
  maxModels?: number;
  notes?: string;
  heroes: UnitTemplate[];
  henchmen: UnitTemplate[];
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  cost: number;
  notes?: string;
  bands?: string[];
}

export interface HiredTemplate extends UnitTemplate {
  upkeep?: number;
  bands?: string[];
}

export interface Catalog {
  bands: BandTemplate[];
  equipment: EquipmentItem[];
  hired: HiredTemplate[];
}
