/**
 * TrussLab 상수 — 마법 숫자를 코드에 흩어 놓지 않는다.
 * 모든 길이는 m, 힘은 N, 응력은 Pa, 비용은 크레딧이다.
 */
export const GRID_METERS = 1
export const MIN_NODE_DISTANCE = 0.5
export const MAX_NODES = 30
export const MAX_MEMBERS = 60
export const MAX_LOADS = 20
export const MAX_SPAN_METERS = 12
export const MAX_HEIGHT_METERS = 8

export const FORCE_TOLERANCE = 0.5
export const UTILIZATION_WARNING = 0.8
export const DEFLECTION_EXAGGERATION = 20
export const BUCKLING_K = 1.0

/** 고정 정사각 단면 — 수업용 모델 값이지 실제 설계값이 아니다. */
export const SECTION_AREA_M2 = 5e-4
export const SECTION_I_M4 = 2.08e-8

export const NODE_COST = 5
export const DEFAULT_LOAD_N = 500
export const DEFAULT_TARGET_LOAD_N = 500

export const VIEW_WIDTH_METERS = 12
export const VIEW_HEIGHT_METERS = 8

export const LOAD_TEST_STEPS = 10
export const MATRIX_TOLERANCE = 1e-9

export const DISCLAIMER_KO =
  'TrussLab은 2D 이상화 모델을 사용하는 수업용 도구입니다. 실제 시공 설계나 안전 인증에 사용할 수 없습니다.'
