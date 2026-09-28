/**
 * useScoringConfig —— 当前生效的评分配置（权重 / 归一方式 / 等级阈值 / 硬性门槛）。
 *
 * 数据来源分两层：
 *   1. 已保存并启用的 ScoreProfile（profileStore.activeProfile）；
 *   2. 评分页「临时调整」中的 working* 值（uiStore，未保存也生效）。
 *
 * 评分页拖动门槛后，首页名次表、地图颜色、详情页等级立即变化；
 * 「恢复当前方案」或切换到其它已保存方案时，working* 被覆盖回该方案的门槛。
 * working 尚未从任何方案同步前（极端时序）回落到启用方案，保证拿到的始终是完整配置。
 */
import { computed, type ComputedRef } from 'vue'
import { useProfileStore } from '@/stores/profileStore'
import { useUiStore } from '@/stores/uiStore'
import type { FactorWeights, GradeThresholds, LimitGates, NormalizeMethod } from '@/types/score'
import { DEFAULT_LIMIT_GATES, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, normalizeLimitGates } from '@/types/score'

export interface ScoringConfig {
  weights: ComputedRef<FactorWeights>
  normalize: ComputedRef<NormalizeMethod>
  thresholds: ComputedRef<GradeThresholds>
  gates: ComputedRef<LimitGates>
}

export function useScoringConfig(): ScoringConfig {
  const profileStore = useProfileStore()
  const uiStore = useUiStore()

  const weights = computed<FactorWeights>(() =>
    uiStore.workingReady ? uiStore.workingWeights : profileStore.activeWeights
  )
  const normalize = computed<NormalizeMethod>(
    () =>
      (uiStore.workingReady
        ? uiStore.workingNormalize
        : profileStore.activeProfile?.normalize) ?? 'minmax'
  )
  const thresholds = computed<GradeThresholds>(
    () =>
      (uiStore.workingReady
        ? uiStore.workingThresholds
        : profileStore.activeProfile?.thresholds) ?? DEFAULT_THRESHOLDS
  )
  const gates = computed<LimitGates>(() =>
    normalizeLimitGates(
      uiStore.workingReady ? uiStore.workingLimits : profileStore.activeProfile?.limits
    )
  )

  return { weights, normalize, thresholds, gates }
}

/** 不依赖 store 实例时的便捷兜底（如新增营位预览只读取启用方案）。 */
export function fallbackLimits(): LimitGates {
  return { ...DEFAULT_LIMIT_GATES }
}

export function fallbackThresholds(): GradeThresholds {
  return { ...DEFAULT_THRESHOLDS }
}

export function fallbackWeights(): FactorWeights {
  return { ...DEFAULT_WEIGHTS }
}
