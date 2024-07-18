import type { App } from 'vue'
import animateOnScroll from './animate/animateOnScroll'
export default {
  install(Vue: App) {
    Vue.directive('animateOnScroll', animateOnScroll)
  }
}
