<template>
  <div class="qwert">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useSlots } from 'vue'

const slots = useSlots()
console.log(slots.default?.())
</script>

<style scoped>

</style>
