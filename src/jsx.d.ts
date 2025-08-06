// Vue + JSX 类型声明
import type { DefineComponent } from 'vue';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    
    interface Element extends VNode {}
    interface ElementClass extends DefineComponent {}
    interface ElementAttributesProperty {
      $props: any;
    }
    interface IntrinsicAttributes {
      [key: string]: any;
    }
    interface IntrinsicClassAttributes<T> {
      [key: string]: any;
    }
  }
}

import type { VNode } from 'vue';