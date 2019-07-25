const VNodeFlags = {
    ELEMENT_HTML: 1,        // html 标签
    ELEMENT_SVG: 1 << 1,    // SVG 标签

    COMPONENT_STATEFUL_NORMAL: 1 << 2,  // 普通有状态组件
    COMPONENT_STATEFUL_SHOULD_KEEP_ALIVE: 1 << 3, // 需要被 keepAlive 的有状态组件
    COMPONENT_STATEFUL_KEPT_ALIVE: 1 << 4, // 已经被 keepAlive 的有状态组件

    COMPONENT_FUNCTIONAL: 1 << 5, // 函数式组件

    TEXT: 1 << 6, // 纯文本
    FRAGMENT: 1 << 7, // Fragment
    PORTAL: 1 << 8 // Portal
}

// html 和 SVG 都是标签元素，可以用 ELEMENT 表示 
VNodeFlags.ELEMENT = VNodeFlags.ELEMENT_HTML | VNodeFlags.ELEMENT_SVG

// 有状态组件
VNodeFlags.COMPONENT_STATEFUL = 
  VNodeFlags.COMPONENT_STATEFUL_NORMAL | 
  VNodeFlags.COMPONENT_STATEFUL_KEPT_ALIVE | 
  VNodeFlags.COMPONENT_STATEFUL_SHOULD_KEEP_ALIVE

VNodeFlags.COMPONENT = VNodeFlags.COMPONENT_STATEFUL | VNodeFlags.COMPONENT_FUNCTIONAL

const ChildrenFlags = {
    UNKNOWN_CHILDREN: 0, // 未知的 children 类型
    NO_CHILDREN: 1, // 没有children
    SINGLE_VNODE: 1 << 1, // children 是单个 VNode
    KEYED_VNODES: 1 << 2, // children 是多个拥有 key 的 VNode
    NONE_KEYED_VNODES: 1 << 3 // children 是多个没有 key 的 VNode
}

ChildrenFlags.MULTIPLE_VNODES = ChildrenFlags.KEYED_VNODES | ChildrenFlags.NONE_KEYED_VNODES

export { VNodeFlags, ChildrenFlags }
