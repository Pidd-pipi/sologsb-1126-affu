/**
 * ScoreProfile（权重方案）—— 各因子权重、归一化方式与 A/B/C 等级阈值。
 * 拖动权重 → 名次实时重算；方案可另存为季节方案。
 */

/** 参与加权的因子键（与 Factors 字段一一对应） */
export type FactorKey =
  | 'slope'
  | 'flatness'
  | 'aspect'
  | 'waterDistance'
  | 'wind'
  | 'signal'
  | 'sun'
  | 'rockfall'
  | 'shade'
  | 'distanceToCar'
  | 'distanceToTrail'

/** 归一化方式 */
export type NormalizeMethod = 'minmax' | 'threshold'

/** 因子权重表：每项 0-100 */
export type FactorWeights = Record<FactorKey, number>

/** 等级阈值：综合得分 ≥ gradeA 为 A，≥ gradeB 为 B，其余为 C */
export interface GradeThresholds {
  gradeA: number
  gradeB: number
}

/**
 * 硬性门槛键：坡度上限、信号下限、水源距离上限。
 * 与「权重偏好」不同，门槛是否决式的（任一不达标最高 B，两项及以上直接 C）。
 */
export type LimitGateKey = 'maxSlope' | 'minSignal' | 'maxWaterDistance'

/** 每套权重方案保存的三项硬性门槛 */
export interface LimitGates {
  /** 坡度上限（°），营位坡度超过即不达标 */
  maxSlope: number
  /** 信号下限（格），营位信号低于即不达标 */
  minSignal: number
  /** 水源距离上限（m），营位离水源超过即不达标（过远不便补水） */
  maxWaterDistance: number
}

export interface ScoreProfile {
  /** 主键，自增 */
  id?: number
  /** 方案名 */
  name: string
  /** 各因子权重（0-100） */
  weights: FactorWeights
  /** 归一化方式：极差归一 / 阈值分段 */
  normalize: NormalizeMethod
  /** 等级阈值 A/B/C */
  thresholds: GradeThresholds
  /** 硬性门槛：坡度上限 / 信号下限 / 水源距离上限 */
  limits: LimitGates
  /** 适用季节 */
  season: string
  /** 是否为当前启用方案 */
  active: boolean
  note: string
  createdAt: string
  updatedAt: string
}

/** 因子的展示元数据：中文名、单位、方向（desc = 值越小越好） */
export interface FactorMeta {
  key: FactorKey
  label: string
  unit: string
  higherIsBetter: boolean
  /** 阈值分段模式下各档位的分界值（对应 100/80/60/40/20 分） */
  breaks: number[]
}

export const FACTOR_META: FactorMeta[] = [
  { key: 'slope', label: '地形坡度', unit: '°', higherIsBetter: false, breaks: [3, 6, 10, 15] },
  { key: 'flatness', label: '平整度', unit: '分', higherIsBetter: true, breaks: [60, 70, 80, 90] },
  { key: 'aspect', label: '坡向光照', unit: '分', higherIsBetter: true, breaks: [50, 60, 72, 85] },
  {
    key: 'waterDistance',
    label: '水源距离',
    unit: 'm',
    higherIsBetter: false,
    breaks: [80, 150, 300, 500]
  },
  { key: 'wind', label: '风力遮蔽', unit: '级', higherIsBetter: false, breaks: [1, 2, 3, 4] },
  { key: 'signal', label: '通信信号', unit: '格', higherIsBetter: true, breaks: [1, 2, 3, 4] },
  { key: 'sun', label: '日照时长', unit: 'h', higherIsBetter: true, breaks: [2, 3, 4, 5] },
  { key: 'rockfall', label: '落石落枝', unit: '分', higherIsBetter: true, breaks: [30, 50, 70, 88] },
  {
    key: 'shade',
    label: '植被遮蔽',
    unit: '分',
    higherIsBetter: true,
    breaks: [20, 35, 50, 65]
  },
  {
    key: 'distanceToCar',
    label: '离车距离',
    unit: 'm',
    higherIsBetter: false,
    breaks: [50, 120, 250, 400]
  },
  {
    key: 'distanceToTrail',
    label: '离步道距离',
    unit: 'm',
    higherIsBetter: false,
    breaks: [30, 80, 150, 300]
  }
]

export const FACTOR_KEYS: FactorKey[] = FACTOR_META.map((m) => m.key)

/** 均衡型默认权重（合计 100） */
export const DEFAULT_WEIGHTS: FactorWeights = {
  slope: 14,
  flatness: 10,
  aspect: 6,
  waterDistance: 14,
  wind: 10,
  signal: 8,
  sun: 7,
  rockfall: 12,
  shade: 5,
  distanceToCar: 8,
  distanceToTrail: 6
}

export const SEASONS: string[] = ['春季', '夏季', '秋季', '冬季', '四季通用']

export const NORMALIZE_LABELS: Record<NormalizeMethod, string> = {
  minmax: '极差归一',
  threshold: '阈值分段'
}

/** 默认等级阈值（新建 / 旧方案缺省时使用） */
export const DEFAULT_THRESHOLDS: GradeThresholds = { gradeA: 78, gradeB: 58 }

/** 硬性门槛的展示元数据：中文名、单位、取值范围、步长、门槛文案 */
export interface LimitGateMeta {
  key: LimitGateKey
  label: string
  shortLabel: string
  unit: string
  min: number
  max: number
  step: number
  /** 不达标时向领队解释门槛的话术，{limit}/{actual} 为占位符 */
  ruleText: string
}

export const LIMIT_GATE_META: LimitGateMeta[] = [
  {
    key: 'maxSlope',
    label: '坡度上限',
    shortLabel: '坡度',
    unit: '°',
    min: 0,
    max: 30,
    step: 0.5,
    ruleText: '坡度不得超过 {limit}{unit}'
  },
  {
    key: 'minSignal',
    label: '信号下限',
    shortLabel: '信号',
    unit: '格',
    min: 0,
    max: 5,
    step: 1,
    ruleText: '信号不得低于 {limit}{unit}'
  },
  {
    key: 'maxWaterDistance',
    label: '水源距离上限',
    shortLabel: '水源',
    unit: 'm',
    min: 10,
    max: 2000,
    step: 10,
    ruleText: '水源距离不得超过 {limit}{unit}'
  }
]

export const LIMIT_GATE_KEYS: LimitGateKey[] = LIMIT_GATE_META.map((m) => m.key)

/** 均衡型默认门槛（与 DEFAULT_WEIGHTS 配套） */
export const DEFAULT_LIMIT_GATES: LimitGates = {
  maxSlope: 8,
  minSignal: 2,
  maxWaterDistance: 300
}

/** 权重预设：均衡型 / 雨季防风 / 亲子舒适 / 重装野营（每组合计 100）。 */
export const WEIGHT_PRESETS: Record<string, FactorWeights> = {
  balanced: { ...DEFAULT_WEIGHTS },
  typhoon: {
    slope: 12,
    flatness: 8,
    aspect: 4,
    waterDistance: 18,
    wind: 18,
    signal: 6,
    sun: 4,
    rockfall: 14,
    shade: 4,
    distanceToCar: 8,
    distanceToTrail: 4
  },
  family: {
    slope: 12,
    flatness: 16,
    aspect: 6,
    waterDistance: 16,
    wind: 6,
    signal: 12,
    sun: 8,
    rockfall: 10,
    shade: 6,
    distanceToCar: 6,
    distanceToTrail: 2
  },
  wild: {
    slope: 8,
    flatness: 6,
    aspect: 10,
    waterDistance: 14,
    wind: 12,
    signal: 2,
    sun: 10,
    rockfall: 12,
    shade: 10,
    distanceToCar: 8,
    distanceToTrail: 8
  }
}

/** 取预设权重；未命中时回落到均衡型。返回副本，避免调用方改动共享对象。 */
export function weightSumGuard(name: string): FactorWeights {
  const preset = WEIGHT_PRESETS[name] ?? DEFAULT_WEIGHTS
  return { ...preset }
}

/**
 * 各场景配套的硬性门槛：
 * - balanced 均衡：常规山谷营地的通用口径；
 * - typhoon 雨季：放宽信号、收紧坡度与水源（既怕山洪又怕补水太远）；
 * - family 亲子：坡度要缓、信号要好、水源不能太远；
 * - wild 重装：队伍自持力强，门槛整体放宽。
 */
export const LIMIT_GATE_PRESETS: Record<string, LimitGates> = {
  balanced: { maxSlope: 8, minSignal: 2, maxWaterDistance: 300 },
  typhoon: { maxSlope: 6, minSignal: 1, maxWaterDistance: 250 },
  family: { maxSlope: 5, minSignal: 3, maxWaterDistance: 200 },
  wild: { maxSlope: 15, minSignal: 0, maxWaterDistance: 800 }
}

/** 取预设门槛；未命中时回落到均衡型。返回副本。 */
export function limitGatesPreset(name: string): LimitGates {
  return { ...(LIMIT_GATE_PRESETS[name] ?? LIMIT_GATE_PRESETS.balanced) }
}

/**
 * 把任意来源（旧数据 / 表单 / 导入）补齐为合法的 LimitGates：
 * 旧方案没有 limits 字段时按均衡型默认值回填，保证「旧方案升级后仍能使用」。
 */
export function normalizeLimitGates(input?: Partial<LimitGates> | null): LimitGates {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    maxSlope: num(input?.maxSlope, DEFAULT_LIMIT_GATES.maxSlope),
    minSignal: num(input?.minSignal, DEFAULT_LIMIT_GATES.minSignal),
    maxWaterDistance: num(input?.maxWaterDistance, DEFAULT_LIMIT_GATES.maxWaterDistance)
  }
}

export function emptyWeights(): FactorWeights {
  return FACTOR_KEYS.reduce((acc, key) => {
    acc[key] = 0
    return acc
  }, {} as FactorWeights)
}
