<script setup lang="ts">
import { useData } from 'vitepress'

const { title } = useData()
</script>

<template>
  <div :key="title" class="giscus">
    <component
        :is="'script'"
        src="https://giscus.app/client.js"
        data-repo="reckless-huang/blog-vite"
        data-repo-id="R_kgDOMdElSw"
        data-category="Announcements"
        data-category-id="DIC_kwDOMdElS84ChTX6"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="preferred_color_scheme"
        data-lang="zh-CN"
        crossorigin="anonymous"
        async
    />
  </div>
</template>

<style scoped>
.giscus{
  margin-top: 10px;
}
</style>