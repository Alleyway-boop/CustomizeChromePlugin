// directives/animateOnScroll.ts
import { DirectiveBinding } from 'vue'
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

interface AnimateOnScrollOptions {
  initialOpacity?: number
  initialY?: number
  transitionDuration?: number
  resetAnimationOnReenter?: boolean
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding<AnimateOnScrollOptions>) {
    const isVisible = ref(false)
    let hasAnimated = false

    const { initialOpacity = 0, initialY = 15, transitionDuration = 0.6, resetAnimationOnReenter = true } = binding.value || {}

    el.style.opacity = initialOpacity.toString()
    el.style.transform = `translateY(${initialY}px)`
    el.style.transition = `opacity ${transitionDuration}s, transform ${transitionDuration}s`

    useIntersectionObserver(
      el,
      ([{ isIntersecting }]) => {
        if (isIntersecting) {
          isVisible.value = true
          if (!hasAnimated || resetAnimationOnReenter) {
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
            hasAnimated = true
          }
        } else {
          isVisible.value = false
          if (resetAnimationOnReenter) {
            el.style.opacity = initialOpacity.toString()
            el.style.transform = `translateY(${initialY}px)`
            hasAnimated = false
          }
        }
      }
    )
  }
}
