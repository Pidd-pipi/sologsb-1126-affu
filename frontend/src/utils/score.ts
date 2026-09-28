/**
 * 评分工具：极差归一、阈值分段、加权求和、等级阈值判定、否决短路。
 * 全部为纯函数，便于 useRanking 与各处复用。
 */
import type { Campsite } from '@/types/campsite'
import { ASPECT_SCORE } from '@/types/campsite'
import type { FactorAssessment, RockfallRisk } from '@/types/factor'
import { ROCKFALL_SCORE } from '@/types/factor'
import type { FactorKey, FactorMeta, FactorWeights, GradeThresholds, HardGates, NormalizeMethod } from '@/types/score'
import { FACTOR_META, GATE_META } from '@/types/score'

/** 推荐等级 */
export type Grade = 'A' | 'B' | 'C'

/** 单个因子在某营位上的原始指标值 */
export interface RawFactorValues {
  slope: number
  flatness: number
  aspect: number
  waterDistance: number
  wind: number
  signal: number
  sun: number
  rockfall: number
  shade: number
  distanceToCar: number
  distanceToTrail: number
}

/** 归一化后的单因子明细 */
export interface FactorScoreRow {
  key: FactorKey
  label: string
  unit: string
  higherIsBetter: boolean
  raw: number
  /** 归一化得分 0-100 */
  normalized: number
  /** 权重（0-100） */
  weight: number
  /** 权重占全部有效权重的比例，0-1 */
  weightRatio: number
  /** 计入综合得分的贡献值 = normalized * weightRatio */
  contribution: number
}

/** 单项硬门槛不达标明细，供名次表与地图逐项说明 */
export interface GateFail {
  /** 门槛字段名 */
  key: keyof HardGates
  /** 中文名，如「坡度上限」 */
  label: string
  /** 门槛值 */
  limit: number
  /** 营位实测值 */
  actual: number
  /** 单位 */
  unit: string
  /** 简短原因，如「坡度过陡」 */
  reason: string
  /** 完整说明，如「坡度 12.0° 超过上限 8°」 */
  message: string
}

/** 一个营位的完整评分结果 */
export interface SiteScore {
  siteId: number
  total: number
  grade: Grade
  rows: FactorScoreRow[]
  vetoed: boolean
  vetoTypes: string[]
  /** 未通过的硬门槛（顺序固定：坡度 / 信号 / 水源） */
  gateFails: GateFail[]
}

export function clamp(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** 极差归一：把一组数值线性映射到 0-100；higherIsBetter=false 时反向。 */
export function minmaxNormalize(values: number[], higherIsBetter: boolean): number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max - min < 1e-9) return values.map(() => 100)
  return values.map((v) => {
    const base = ((v - min) / (max - min)) * 100
    return clamp(higherIsBetter ? base : 100 - base)
  })
}

/** 阈值分段：按 breaks 落档，得到 100 / 80 / 60 / 40 / 20 五档分。 */
export function thresholdNormalize(value: number, meta: FactorMeta): number {
  const steps = [100, 80, 60, 40, 20]
  const b = meta.breaks
  if (meta.higherIsBetter) {
    for (let i = 0; i < b.length; i += 1) {
      if (value <= b[i]) return steps[i]
    }
    return steps[steps.length - 1]
  }
  for (let i = 0; i < b.length; i += 1) {
    if (value <= b[i]) return steps[i]
  }
  return steps[steps.length - 1]
}

/** 风因子：风力越大越差（0 级 = 100 分，每级 -14 分，最低 16 分）。 */
export function windScore(force: number): number {
  return clamp(100 - Math.max(0, force) * 14, 16, 100)
}

/** 由营位 + 因子评估折算原始指标值；缺少评估记录时给保守缺省值。 */
export function rawValuesOf(site: Campsite, factor?: FactorAssessment | null): RawFactorValues {
  return {
    slope: Number(site.slope) || 0,
    flatness: Number(site.flatness) || 0,
    aspect: ASPECT_SCORE[site.aspect] ?? 70,
    waterDistance: factor ? Number(factor.waterDistance) || 0 : 400,
    wind: factor ? Number(factor.windForce) || 0 : 3,
    signal: factor ? Number(factor.signalBars) || 0 : 0,
    sun: factor ? Number(factor.sunHours) || 0 : 3,
    rockfall: factor ? ROCKFALL_SCORE[factor.rockfallRisk as RockfallRisk] ?? 60 : 50,
    shade: factor ? Number(factor.shade) || 0 : 30,
    distanceToCar: factor ? Number(factor.distanceToCar) || 0 : 300,
    distanceToTrail: factor ? Number(factor.distanceToTrail) || 0 : 200
  }
}

/**
 * 批量归一化：极差归一需要同一批营位一起比较，所以先收集全部原始值再归一。
 * 返回 siteId -> 各因子归一化分值。
 */
export function buildNormalizedMatrix(
  raws: Array<{ siteId: number; values: RawFactorValues }>,
  method: NormalizeMethod
): Map<number, Record<FactorKey, number>> {
  const out = new Map<number, Record<FactorKey, number>>()
  const matrix = FACTOR_META.map((meta) => {
    if (method === 'minmax') {
      const column = raws.map((r) => r.values[meta.key])
      return minmaxNormalize(column, meta.higherIsBetter)
    }
    return raws.map((r) => {
      if (meta.key === 'wind') return windScore(r.values.wind)
      return thresholdNormalize(r.values[meta.key], meta)
    })
  })

  raws.forEach((r, idx) => {
    const record = {} as Record<FactorKey, number>
    FACTOR_META.forEach((meta, col) => {
      record[meta.key] = clamp(Math.round(matrix[col][idx]))
    })
    out.set(r.siteId, record)
  })
  return out
}

/** 加权求和：按有效权重占比归一，保证权重和不为 100 时得分依然可比。 */
export function weightedTotal(normalized: Record<FactorKey, number>, weights: FactorWeights): number {
  let sum = 0
  let weightSum = 0
  FACTOR_META.forEach((meta) => {
    const w = Math.max(0, Number(weights[meta.key]) || 0)
    if (w <= 0) return
    sum += clamp(normalized[meta.key]) * w
    weightSum += w
  })
  if (weightSum <= 0) return 0
  return round1(sum / weightSum)
}

/**
 * 硬门槛判定：坡度超上限、信号低于下限、水源距离超上限，任一即记入失败明细。
 * 规则与权重完全解耦，只看实测值与方案门槛。
 */
export function checkGates(raw: RawFactorValues, gates: HardGates): GateFail[] {
  const fails: GateFail[] = []
  const actualOf: Record<keyof HardGates, number> = {
    maxSlope: raw.slope,
    minSignal: raw.signal,
    maxWaterDistance: raw.waterDistance
  }
  for (const meta of GATE_META) {
    const actual = actualOf[meta.key]
    const limit = gates[meta.key]
    const bad = meta.rule === 'lte' ? actual > limit : actual < limit
    if (!bad) continue
    const actualText = formatGateActual(meta.key, actual)
    const bound = meta.rule === 'lte' ? '上限' : '下限'
    const message = `${meta.hint}：${actualText}（${bound} ${limit}${meta.unit}）`
    fails.push({ key: meta.key, label: meta.label, limit, actual, unit: meta.unit, reason: meta.hint, message })
  }
  return fails
}

function formatGateActual(key: keyof HardGates, value: number): string {
  if (key === 'maxSlope') return `坡度 ${value.toFixed(1)}°`
  if (key === 'minSignal') return `信号 ${value} 格`
  return `水源 ${value} m`
}

/** 等级阈值判定；命中否决项短路为 C；硬门槛 1 项不达标最高 B，2 项及以上直接 C。 */
export function gradeOf(
  total: number,
  thresholds: GradeThresholds,
  vetoed: boolean,
  gateFailCount = 0
): Grade {
  const a = Number(thresholds.gradeA) || 80
  const b = Number(thresholds.gradeB) || 60
  if (vetoed) return 'C'
  if (gateFailCount >= 2) return 'C'
  if (total >= a && gateFailCount === 0) return 'A'
  if (total >= b) return 'B'
  return 'C'
}

/** 组装单个营位的因子明细行（含权重占比与贡献值）。 */
export function buildFactorRows(
  normalized: Record<FactorKey, number>,
  weights: FactorWeights
): FactorScoreRow[] {
  const weightSum = FACTOR_META.reduce(
    (acc, meta) => acc + Math.max(0, Number(weights[meta.key]) || 0),
    0
  )
  return FACTOR_META.map((meta) => {
    const weight = Math.max(0, Number(weights[meta.key]) || 0)
    const weightRatio = weightSum > 0 ? weight / weightSum : 0
    return {
      key: meta.key,
      label: meta.label,
      unit: meta.unit,
      higherIsBetter: meta.higherIsBetter,
      raw: 0,
      normalized: clamp(normalized[meta.key]),
      weight,
      weightRatio,
      contribution: round1(clamp(normalized[meta.key]) * weightRatio)
    }
  })
}

/** 权重合计，用于校验表单。 */
export function weightSum(weights: FactorWeights): number {
  return FACTOR_META.reduce((acc, meta) => acc + Math.max(0, Number(weights[meta.key]) || 0), 0)
}

/** 等级对应的展示色（标签、地图标记共用）。 */
export const GRADE_COLOR: Record<Grade, string> = {
  A: '#15803d',
  B: '#d97706',
  C: '#b91c1c'
}

export const GRADE_LABEL: Record<Grade, string> = {
  A: 'A 级 · 优先推荐',
  B: 'B 级 · 可作备选',
  C: 'C 级 · 不建议'
}
