import { BUCKLING_K } from './constants'
import { SECTION_I_M4 } from './constants'

/**
 * 오일러 좌굴하중. MVP는 핀-핀(K=1.0) 한 가지 경우만 쓴다.
 * 실제 좌굴은 단부 조건, 초기 결함, 접합부에 따라 달라진다.
 */
export function eulerBucklingLoad(
  elasticModulus: number,
  lengthMeters: number,
  k = BUCKLING_K,
): number {
  if (lengthMeters <= 0) return Number.POSITIVE_INFINITY
  const effective = k * lengthMeters
  return (Math.PI * Math.PI * elasticModulus * SECTION_I_M4) / (effective * effective)
}

export function bucklingUtilization(
  compressionForce: number,
  elasticModulus: number,
  lengthMeters: number,
  k = BUCKLING_K,
): number {
  if (compressionForce >= 0) return 0
  const critical = eulerBucklingLoad(elasticModulus, lengthMeters, k)
  if (!Number.isFinite(critical) || critical <= 0) return 0
  return Math.abs(compressionForce) / critical
}
