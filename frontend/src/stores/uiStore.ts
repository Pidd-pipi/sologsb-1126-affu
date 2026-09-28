/**
 * 界面状态：风险否决记录的读写、名次表筛选条件、评分页的临时权重。
 * 临时权重放在 store 里，拖权重条时首页与评分页共享同一份实时结果。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, toPlain } from '@/utils/db'
import type { RiskVeto } from '@/types/veto'
import type { FactorWeights, NormalizeMethod, GradeThresholds, HardGates } from '@/types/score'
import { DEFAULT_WEIGHTS, DEFAULT_GATES, normalizeGates } from '@/types/score'
import type { AccessMode, SurfaceType } from '@/types/campsite'
import { nowIso, todayIso } from '@/utils/format'

export const useUiStore = defineStore('ui', () => {
  const vetos = ref<RiskVeto[]>([])
  const loadingVetos = ref(false)

  /** 名次表筛选条件 */
  const filterCamp = ref<string>('')
  const filterSurface = ref<SurfaceType | ''>('')
  const filterAccess = ref<AccessMode | ''>('')
  const keyword = ref<string>('')

  /** 评分页拖动中的临时权重（未保存前不落库） */
  const workingWeights = ref<FactorWeights>({ ...DEFAULT_WEIGHTS })
  const workingNormalize = ref<NormalizeMethod>('minmax')
  const workingThresholds = ref<GradeThresholds>({ gradeA: 78, gradeB: 58 })
  /** 临时硬门槛：改这里，名次、等级与地图颜色立即变；切回已保存方案时恢复 */
  const workingGates = ref<HardGates>({ ...DEFAULT_GATES })
  const workingSeason = ref<string>('四季通用')
  const dirty = ref(false)

  /** 地图页当前选中的营位 id */
  const focusedSiteId = ref<number | null>(null)

  async function loadVetos(): Promise<void> {
    loadingVetos.value = true
    try {
      vetos.value = await db.vetos.toArray()
    } finally {
      loadingVetos.value = false
    }
  }

  async function addVeto(input: RiskVeto): Promise<number> {
    const now = nowIso()
    const record = toPlain({
      ...input,
      judgedAt: input.judgedAt || todayIso(),
      createdAt: now,
      updatedAt: now
    }) as RiskVeto
    delete record.id
    const id = await db.vetos.add(record)
    await loadVetos()
    return id
  }

  async function removeVeto(id: number): Promise<void> {
    await db.vetos.delete(id)
    await loadVetos()
  }

  /** 某营位命中的全部否决项 */
  function vetosOf(siteId: number | null | undefined): RiskVeto[] {
    if (siteId == null) return []
    return vetos.value.filter((v) => v.siteId === siteId)
  }

  function isVetoed(siteId: number | null | undefined): boolean {
    return vetosOf(siteId).length > 0
  }

  /** 命中否决的营位 id 集合，名次表与地图共用。 */
  const vetoedSiteIds = computed<number[]>(() =>
    Array.from(new Set(vetos.value.map((v) => v.siteId)))
  )

  /** 用启用方案覆盖临时权重与门槛（切换/恢复已保存方案时调用）。 */
  function syncFromProfile(
    weights: FactorWeights,
    normalize: NormalizeMethod,
    thresholds: GradeThresholds,
    season: string,
    gates?: HardGates
  ): void {
    workingWeights.value = { ...DEFAULT_WEIGHTS, ...weights }
    workingNormalize.value = normalize
    workingThresholds.value = { ...thresholds }
    workingGates.value = normalizeGates(gates)
    workingSeason.value = season
    dirty.value = false
  }

  function resetFilters(): void {
    filterCamp.value = ''
    filterSurface.value = ''
    filterAccess.value = ''
    keyword.value = ''
  }

  /** 临时调整某项硬门槛（立即重算名次、等级与地图颜色，不落库）。 */
  function patchWorkingGates(patch: Partial<HardGates>): void {
    workingGates.value = { ...workingGates.value, ...patch }
    dirty.value = true
  }

  const vetoTotal = computed(() => vetos.value.length)

  return {
    vetos,
    loadingVetos,
    vetoTotal,
    filterCamp,
    filterSurface,
    filterAccess,
    keyword,
    workingWeights,
    workingNormalize,
    workingThresholds,
    workingGates,
    workingSeason,
    dirty,
    focusedSiteId,
    vetoedSiteIds,
    loadVetos,
    addVeto,
    removeVeto,
    vetosOf,
    isVetoed,
    syncFromProfile,
    patchWorkingGates,
    resetFilters
  }
})
