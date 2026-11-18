import bands from './data/bands.json';
import equipment from './data/equipment.json';
import hired from './data/hired.json';
import type { BandTemplate, Catalog, EquipmentItem, HiredTemplate } from './types.ts';

export const catalog: Catalog = {
  bands: bands as BandTemplate[],
  equipment: equipment as EquipmentItem[],
  hired: hired as HiredTemplate[],
};

export const bandTemplate = (id: string | undefined): BandTemplate | undefined =>
  id ? catalog.bands.find((b) => b.id === id) : undefined;

/** Oggetti acquistabili da una banda: quelli senza restrizioni e quelli che la nominano. */
export function equipmentFor(templateId: string | undefined): EquipmentItem[] {
  return catalog.equipment.filter((e) => !e.bands?.length || (templateId !== undefined && e.bands.includes(templateId)));
}

export function hiredFor(templateId: string | undefined): HiredTemplate[] {
  return catalog.hired.filter((h) => !h.bands?.length || (templateId !== undefined && h.bands.includes(templateId)));
}

export function groupByCategory(items: EquipmentItem[]): [string, EquipmentItem[]][] {
  const map = new Map<string, EquipmentItem[]>();
  for (const i of items) map.set(i.category, [...(map.get(i.category) ?? []), i]);
  return [...map.entries()];
}
