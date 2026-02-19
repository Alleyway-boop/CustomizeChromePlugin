/**
 * Example Vue component test demonstrating @vue/test-utils usage
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

// Example component to test
const ExampleComponent = defineComponent({
  name: 'ExampleComponent',
  props: {
    message: {
      type: String,
      default: 'Hello',
    },
  },
  emits: ['update'],
  setup(props, { emit }) {
    const count = ref(0)

    const increment = () => {
      count.value++
      emit('update', count.value)
    }

    return () =>
      h('div', { class: 'example' }, [
        h('p', { class: 'message' }, props.message),
        h('p', { class: 'count' }, `Count: ${count.value}`),
        h('button', { class: 'increment', onClick: increment }, 'Increment'),
      ])
  },
})

describe('ExampleComponent', () => {
  it('should render message prop', () => {
    const wrapper = mount(ExampleComponent, {
      props: { message: 'Test Message' },
    })

    expect(wrapper.find('.message').text()).toBe('Test Message')
  })

  it('should use default message prop', () => {
    const wrapper = mount(ExampleComponent)

    expect(wrapper.find('.message').text()).toBe('Hello')
  })

  it('should initialize count at 0', () => {
    const wrapper = mount(ExampleComponent)

    expect(wrapper.find('.count').text()).toBe('Count: 0')
  })

  it('should increment count when button is clicked', async () => {
    const wrapper = mount(ExampleComponent)

    await wrapper.find('.increment').trigger('click')

    expect(wrapper.find('.count').text()).toBe('Count: 1')
  })

  it('should emit update event with count', async () => {
    const wrapper = mount(ExampleComponent)

    await wrapper.find('.increment').trigger('click')

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([1])
  })
})
