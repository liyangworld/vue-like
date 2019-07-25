import { VNodeFlags, ChildrenFlags } from './flags'

export const Fragment = Symbol()
export const Portal = Symbol()

export function h(tag, data = null, children = null) {
    // 确定 flags
    let flags = null
    if(typeof tag === 'string'){
        flags = tag === 'svg' ? VNodeFlags.ELEMENT_SVG : VNodeFlags.ELEMENT_HTML
    }else if(tag === Fragment){
        flags = VNodeFlags.FRAGMENT
    }else if(tag === Portal){
        flags = VNodeFlags.PORTAL
        tag = data && data.target
    }else{
        if(tag !== null && typeof tag === 'object'){
            // 兼容 Vue2 的对象式组件
            flags = tag.functional ? VNodeFlags.COMPONENT_FUNCTIONAL : VNodeFlags.COMPONENT_STATEFUL_NORMAL
        }else if(typeof tag === 'function'){
            // Vue3 的类组件
            flags = tag.prototype && tag.prototype.render ? VNodeFlags.COMPONENT_STATEFUL_NORMAL : VNodeFlags.COMPONENT_FUNCTIONAL
        }
    }
    
    // 确定 childFlags
    let childFlags = null
    if(Array.isArray(children)){
        const { length } = children
        if(length === 0){
            childFlags = ChildrenFlags.NO_CHILDREN
        }else if(length === 1){
            childFlags = ChildrenFlags.SINGLE_VNODE
            children = children[0]
        }else {
            childFlags = ChildrenFlags.KEYED_VNODES
            children = normalizeVNodes(children)
        }
    }else if(children == null){
        childFlags = ChildrenFlags.NO_CHILDREN
    }else if(children._isVNode){
        childFlags = ChildrenFlags.SINGLE_VNODE
    }else {
        // 其他情况都作为文本节点处理
        childFlags = ChildrenFlags.SINGLE_VNODE
        children = createTextVNode(children + '')
    }

    return {
        _isVNode: true,
        flags,
        tag,
        data,
        key: data && data.key ? data.key : null,
        children,
        childFlags,
        el: null
    }
}

function normalizeVNodes(children) {
    return children.map((child, index) => {
        if(child.key == null){
            child.key = '|' + index
        }
        return child
    })
}

export function createTextVNode(text){
    return {
        _isVNode: true,
        flags: VNodeFlags.TEXT,
        tag: null,
        data: null,
        children: text,
        childFlags: ChildrenFlags.NO_CHILDREN
    }
}