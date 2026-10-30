import rawMaterials from '../data/materials.json'
import type { Material, MaterialId } from './types'
import { SECTION_AREA_M2, SECTION_I_M4 } from './constants'

const materialMap = new Map<MaterialId, Material>()
for (const item of rawMaterials) {
  materialMap.set(item.id as MaterialId, item as Material)
}

export const MATERIALS: Material[] = rawMaterials as Material[]
export const WOOD = materialMap.get('wood') as Material
export const STEEL = materialMap.get('steel') as Material

export function getMaterial(id: MaterialId): Material {
  const found = materialMap.get(id)
  if (!found) return WOOD
  return found
}

export const SECTION = {
  area: SECTION_AREA_M2,
  inertia: SECTION_I_M4,
  labelKo: '정사각 단면 22.4 mm × 22.4 mm (수업용)',
}
