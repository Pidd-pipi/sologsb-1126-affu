<script setup lang="ts">
/**
 * GateTags —— 硬门槛达标情况说明。
 * - 全部达标：显示「门槛达标」（可通过 :show-ok="false" 隐藏）
 * - 1 项不达标：橙色标签列出卡在的项，提示最高 B
 * - 2 项及以上：红色标签列出卡在的项，提示直接 C
 * 名次表与地图用同一份文案，避免两处口径不一致。
 */
import { computed } from 'vue'
import type { GateFail } from '@/utils/score'

const props = withDefaults(
  defineProps<{
    fails: GateFail[]
    /** 全部达标时是否显示绿色「门槛达标」 */
    showOk?: boolean
    size?: 'small' | 'default'
  }>(),
  {
    showOk: true,
    size: 'default'
  }
)

const count = computed(() => props.fails.length)
const severe = computed(() => count.value >= 2)

const summary = computed(() => {
  if (count.value === 0) return '门槛达标'
  if (severe.value) return `卡 ${count.value} 项 · 直接 C`
  return `卡 ${count.value} 项 · 最高 B`
})

const tooltip = computed(() => props.fails.map((f) => f.message).join('；'))
</script>

<template>
  <span v-if="count > 0 || showOk" class="gate-tags" :class="[`gate-tags--${size}`]">
    <el-tag
      :type="count === 0 ? 'success' : severe ? 'danger' : 'warning'"
      size="small"
      effect="plain"
    >
      {{ summary }}
    </el-tag>
    <el-tooltip
      v-for="f in fails"
      :key="f.key"
      :content="f.message"
      placement="top"
      :show-after="200"
    >
      <el-tag :type="severe ? 'danger' : 'warning'" size="small" class="gate-tags__item">
        {{ f.reason }}
      </el-tag>
    </el-tooltip>
  </span>
</template>

<style scoped>
.gate-tags {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.gate-tags__item {
  cursor: help;
}
</style>
