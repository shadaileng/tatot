<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useTarotStore } from '@/store'

onLaunch(() => { 
  const store = useTarotStore()
  store.loadRecords()
  console.log('🃏 塔罗牌小程序启动')
})

// 微信分享配置
onShow(() => {
  // 设置默认分享
  // #ifdef MP-WEIXIN
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline'],
  })
  // #endif
})
</script>

<style>
@import '@/app.css';
</style>

<style lang="scss">
@import '@/styles/global.scss';
</style>
