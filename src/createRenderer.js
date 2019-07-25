import { VNodeFlags, ChildrenFlags } from "./flags";
import { createTextVNode } from "./h";

export default function createRenderer(options) {
  const {
    nodeOps: {
      createElement: platformCreateElement,
      createText: platformCreateText,
      setText: platformSetText,
      appendChild: platformAppendChild,
      insertBefore: platformInsertBefore,
      removeChild: platformRemoveChild,
      parentNode: platformParentNode,
      nextSibling: platformNextSibling,
      querySelector: platformQuerySelector
    },
    patchData: platformPatchData
  } = options;

  function render(vnode, container) {
    const prevVNode = container.vnode;
    if (prevVNode == null) {
      if (vnode) {
        mount(vnode, container);
        container.vnode = vnode;
      }
    } else {
      if (vnode) {
        patch(prevVNode, vnode, container);
        container.vnode = vnode;
      } else {
        platformRemoveChild(container, prevVNode.el);
        container.vnode = null;
      }
    }
  }

  function mount(vnode, container, isSVG, refNode) {
    const { flags } = vnode;
    if (flags & VNodeFlags.ELEMENT) {
      mountElement(vnode, container, isSVG, refNode);
    } else if (flags & VNodeFlags.COMPONENT) {
      mountComponent(vnode, container, isSVG);
    } else if (flags & VNodeFlags.TEXT) {
      mountText(vnode, container);
    } else if (flags & VNodeFlags.FRAGMENT) {
      mountFragment(vnode, container, isSVG);
    } else if (flags & VNodeFlags.PORTAL) {
      mountPortal(vnode, container, isSVG);
    }
  }

  function mountElement(vnode, container, isSVG, refNode) {
    isSVG = isSVG || vnode.flags & VNodeFlags.ELEMENT_SVG;
    const el = platformCreateElement(vnode.tag, isSVG);
    vnode.el = el;

    const data = vnode.data;
    if (data) {
      for (let key in data) {
        platformPatchData(el, key, null, data[key]);
      }
    }

    const childFlags = vnode.childFlags;
    const children = vnode.children;
    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      mount(children, el, isSVG);
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      for (let i = 0; i < children.length; i++) {
        mount(children[i], el, isSVG);
      }
    }

    refNode
      ? platformInsertBefore(container, el, refNode)
      : platformAppendChild(container, el);
  }

  function mountText(vnode, container) {
    const el = platformCreateText(vnode.children);
    vnode.el = el;

    platformAppendChild(container, el);
  }

  function mountFragment(vnode, container, isSVG) {
    const { children, childFlags } = vnode;
    switch (childFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        mount(children, container, isSVG);
        vnode.el = children.el;
        break;
      case ChildrenFlags.NO_CHILDREN:
        const placeholder = createTextVNode("");
        mountText(placeholder, container);
        vnode.el = placeholder.el;
        break;
      default:
        for (let i = 0; i < children.length; i++) {
          mount(children[i], container, isSVG);
        }
        vnode.el = children[0].el;
        break;
    }
  }

  function mountPortal(vnode, container) {
    const { tag, children, childFlags } = vnode;

    // 获取挂载点
    const target = typeof tag === "string" ? platformQuerySelector(tag) : tag;

    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      mount(children, target);
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      for (let i = 0; i < children.length; i++) {
        mount(children[i], target);
      }
    }

    // 占位的空文本节点，挂载到 container 中
    const placeholder = createTextVNode("");
    mountText(placeholder, container, null);

    vnode.el = placeholder.el;
  }

  function mountComponent(vnode, container, isSVG) {
    if (vnode.flags & VNodeFlags.COMPONENT_STATEFUL) {
      mountStatefulComponent(vnode, container, isSVG);
    } else {
      mountFunctionalComponent(vnode, container, isSVG);
    }
  }

  function mountStatefulComponent(vnode, container, isSVG) {
    const instance = (vnode.children = new vnode.tag());

    instance.$props = vnode.data;

    // 在 _update 之外重新获取 $props
    instance._update = function() {
      if (instance._mounted) {
        const prevVNode = instance.$vnode;
        const nextVNode = (instance.$vnode = instance.render());
        patch(prevVNode, nextVNode, platformParentNode(prevVNode.el));
        instance.$el = vnode.el = instance.$vnode.el;
      } else {
        instance.$vnode = instance.render();
        mount(instance.$vnode, container, isSVG);
        instance._mounted = true;
        instance.$el = vnode.el = instance.$vnode.el;
        instance.mounted && instance.mounted();
      }
    };

    instance._update();
  }

  function mountFunctionalComponent(vnode, container, isSVG) {
    vnode.handel = {
      prev: null,
      next: vnode,
      container,
      // 在 update 之外更改 prev、next、container
      update: () => {
        if (vnode.handel.prev) {
          const prevVNode = vnode.handel.prev;
          const nextVNode = vnode.handel.next;

          const prevTree = prevVNode.children;
          const props = nextVNode.data;
          const nextTree = (nextVNode.children = nextVNode.tag(props));

          patch(prevTree, nextTree, vnode.handel.container);
        } else {
          const props = vnode.data;
          const $vnode = (vnode.children = vnode.tag(props));
          mount($vnode, container, isSVG);
          vnode.el = $vnode.el;
        }
      }
    };

    vnode.handle.update();
  }

  function patch(prevVNode, nextVNode, container) {
    const nextFlags = nextVNode.flags;
    const prevFlags = prevVNode.flags;

    if (prevFlags !== nextFlags) {
      replaceVNode(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.ELEMENT) {
      patchElement(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.COMPONENT) {
      patchComponent(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.TEXT) {
      patchText(prevVNode, nextVNode);
    } else if (nextFlags & VNodeFlags.FRAGMENT) {
      patchFragment(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodeFlags.PORTAL) {
      patchPortal(prevVNode, nextVNode);
    }
  }

  function replaceVNode(prevVNode, nextVNode, container) {
    platformRemoveChild(container, prevVNode.el);
    if (prevVNode.flags & VNodeFlags.COMPONENT_STATEFUL_NORMAL) {
      const instance = prevVNode.children;
      instance.unmounted && instance.unmounted();
    }

    mount(nextVNode, container);
  }

  function patchElement(prevVNode, nextVNode, container) {
    if (prevVNode.tag !== nextVNode.tag) {
      replaceVNode(prevVNode, nextVNode, container);
      return;
    }

    const el = (nextVNode.el = prevVNode.el);
    const prevData = prevVNode.data;
    const nextData = nextVNode.data;

    if (nextData) {
      for (let key in nextData) {
        const prevValue = prevData[key];
        const nextValue = nextData[key];
        platformPatchData(el, key, prevValue, nextValue);
      }
    }

    if (prevData) {
      for (let key in prevData) {
        const prevValue = prevData[key];
        if (prevValue && !nextData.hasOwnProperty(key)) {
          platformPatchData(el, key, prevValue, null);
        }
      }
    }

    patchChildren(
      prevVNode.childFlags, // 旧的 VNode 子节点的类型
      nextVNode.childFlags, // 新的 VNode 子节点的类型
      prevVNode.children, // 旧的 VNode 子节点
      nextVNode.children, // 新的 VNode 子节点
      el // 当前标签元素，即这些子节点的父节点
    );
  }

  function patchText(prevVNode, nextVNode) {
    const el = (nextVNode.el = prevVNode.el);
    if (nextVNode.children !== prevVNode.children) {
      platformSetText(el, nextVNode.children);
    }
  }

  function patchFragment(prevVNode, nextVNode, container) {
    patchChildren(
      prevVNode.childFlags, // 旧片段的子节点类型
      nextVNode.childFlags, // 新片段的子节点类型
      prevVNode.children, // 旧片段的子节点
      nextVNode.children, // 新片段的子节点
      container
    );

    switch (nextVNode.childFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        nextVNode.el = nextVNode.children.el;
        break;
      case ChildrenFlags.NO_CHILDREN:
        nextVNode.el = prevVNode.el;
        break;
      default:
        nextVNode.el = nextVNode.children[0].el;
    }
  }

  function patchPortal(prevVNode, nextVNode) {
    patchChildren(
      prevVNode.childFlags,
      nextVNode.childFlags,
      prevVNode.children,
      nextVNode.children,
      prevVNode.tag // 注意 container 是旧的 container
    );

    nextVNode.el = prevVNode.el;
    // 如果新旧容器不同，才需要搬运
    if (nextVNode.tag !== prevVNode.tag) {
      // 获取新的容器元素，即挂载目标
      const container =
        typeof nextVNode.tag === "string"
          ? platformQuerySelector(nextVNode.tag)
          : nextVNode.tag;

      switch (nextVNode.childFlags) {
        case ChildrenFlags.SINGLE_VNODE:
          // 如果新的 Portal 是单个子节点，就把该节点搬运到新容器中
          platformAppendChild(container, nextVNode.children.el);
          break;
        case ChildrenFlags.NO_CHILDREN:
          // 新的 Portal 没有子节点，不需要搬运
          break;
        default:
          // 如果新的 Portal 是多个子节点，遍历逐个将它们搬运到新容器中
          for (let i = 0; i < nextVNode.children.length; i++) {
            platformAppendChild(container, nextVNode.children[i].el);
          }
          break;
      }
    }
  }

  function patchComponent(prevVNode, nextVNode, container) {
    if (nextVNode.tag !== prevVNode.tag) {
      replaceVNode(prevVNode, nextVNode, container);
    } else if (nextVNode.flags & VNodeFlags.COMPONENT_STATEFUL_NORMAL) {
      // 获取组件实例
      const instance = (nextVNode.children = prevVNode.children);
      // 更新 props
      instance.$props = nextVNode.data;
      // 更新组件
      instance._update();
    } else {
      // 更新函数式组件
      const handle = (nextVNode.handle = prevVNode.handle);
      handle.prev = prevVNode;
      handle.next = nextVNode;
      handle.container = container;

      handle.update();
    }
  }

  function patchChildren(
    prevChildFlags,
    nextChildFlags,
    prevChildren,
    nextChildren,
    container
  ) {
    switch (prevChildFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        switch (nextChildFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            patch(prevChildren, nextChildren, container);
            break;
          case ChildrenFlags.NO_CHILDREN:
            platformRemoveChild(container, prevChildren.el);
            break;
          default:
            platformRemoveChild(container, prevChildren.el);
            for (let i = 0; i < nextChildren.length; i++) {
              mount(nextChildren[i], container);
            }
            break;
        }
        break;
      case ChildrenFlags.NO_CHILDREN:
        switch (nextChildFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            mount(nextChildren, container);
            break;
          case ChildrenFlags.NO_CHILDREN:
            break;
          default:
            for (let i = 0; i < nextChildren.length; i++) {
              mount(nextChildren[i], container);
            }
            break;
        }
        break;
      default:
        switch (nextChildFlags) {
          case ChildrenFlags.SINGLE_VNODE:
            for (let i = 0; i < prevChildren.length; i++) {
              platformRemoveChild(container, prevChildren[i].el);
            }
            mount(nextChildren, container);
            break;
          case ChildrenFlags.NO_CHILDREN:
            for (let i = 0; i < prevChildren.length; i++) {
              platformRemoveChild(container, prevChildren[i].el);
            }
            break;
          default:
            let j = 0;
            let prevVNode = prevChildren[j];
            let nextVNode = nextChildren[j];
            let prevEnd = prevChildren.length - 1;
            let nextEnd = nextChildren.length - 1;
            // 预处理
            outer: {
              while (prevVNode.key === nextVNode.key) {
                patch(prevVNode, nextVNode, container);
                j++;
                if (j > prevEnd || j > nextEnd) {
                  break outer;
                }
                prevVNode = prevChildren[j];
                nextVNode = nextChildren[j];
              }
              // 更新相同的后缀节点
              prevVNode = prevChildren[prevEnd];
              nextVNode = nextChildren[nextEnd];
              while (prevVNode.key === nextVNode.key) {
                patch(prevVNode, nextVNode, container);
                prevEnd--;
                nextEnd--;
                if (j > prevEnd || j > nextEnd) {
                  break outer;
                }
                prevVNode = prevChildren[prevEnd];
                nextVNode = nextChildren[nextEnd];
              }
            }
            // 一方处理完后
            if (j > prevEnd && j <= nextEnd) {
              // j -> nextEnd 之间的节点应该被添加
              const nextPos = nextEnd + 1;
              const refNode =
                nextPos < nextChildren.length ? nextChildren[nextPos].el : null;
              while (j <= nextEnd) {
                mount(nextChildren[j++], container, false, refNode);
              }
            } else if (j > nextEnd) {
              while (j <= prevEnd) {
                platformRemoveChild(container, prevChildren[j++].el);
              }
            } else {
              // 构造 source 数组
              const nextLeft = nextEnd - j + 1; // 新 children 中剩余未处理节点的数量
              const source = [];
              for (let i = 0; i < nextLeft; i++) {
                source.push(-1);
              }

              const prevStart = j;
              const nextStart = j;
              let moved = false;
              let pos = 0;

              // 构建索引表
              const keyIndex = {};
              for (let i = nextStart; i <= nextEnd; i++) {
                keyIndex[nextChildren[i].key] = i;
              }
              let patched = 0;

              // 遍历旧 children 的剩余未处理节点
              for (let i = prevStart; i <= prevEnd; i++) {
                prevVNode = prevChildren[i];

                if (patched < nextLeft) {
                  // 通过索引表快速找到新 children 中具有相同 key 的节点的位置
                  const k = keyIndex[prevVNode.key];
                  if (typeof k !== "undefined") {
                    nextVNode = nextChildren[k];
                    // patch 更新
                    patch(prevVNode, nextVNode, container);
                    patched++;
                    // 更新 source 数组
                    source[k - nextStart] = i;
                    // 判断是否需要移动
                    if (k < pos) {
                      moved = true;
                    } else {
                      pos = k;
                    }
                  } else {
                    // 没找到，说明旧节点在新 children 中已经不存在了，应该移除
                    platformRemoveChild(container, prevVNode.el);
                  }
                } else {
                  // 多余的节点，应该移除
                  platformRemoveChild(container, prevVNode.el);
                }
              }

              if (moved) {
                const seq = lis(source);
                // j 指向最长递增子序列的最后一个值
                let j = seq.length - 1;
                // 从后向前遍历新 children 中的剩余未处理节点
                for (let i = nextLeft - 1; i >= 0; i--) {
                  if (source[i] === -1) {
                    // 作为全新的节点挂载

                    // 该节点在新 children 中的真实位置索引
                    const pos = i + nextStart;
                    const nextVNode = nextChildren[pos];
                    // 该节点下一个节点的位置索引
                    const nextPos = pos + 1;
                    // 挂载
                    mount(
                      nextVNode,
                      container,
                      false,
                      nextPos < nextChildren.length
                        ? nextChildren[nextPos].el
                        : null
                    );
                  } else if (i !== seq[j]) {
                    // 说明该节点需要移动

                    // 该节点在新 children 中的真实位置索引
                    const pos = i + nextStart;
                    const nextVNode = nextChildren[pos];
                    // 该节点下一个节点的位置索引
                    const nextPos = pos + 1;
                    // 移动
                    platformInsertBefore(
                      container,
                      nextVNode.el,
                      nextPos < nextChildren.length
                        ? nextChildren[nextPos].el
                        : null
                    );
                  } else {
                    // 当 i === seq[j] 时，说明该位置的节点不需要移动
                    // 并让 j 指向下一个位置
                    j--;
                  }
                }
              }



            }

            break
        }
        break
    }
  }
  return { render };
}

// 最长递增子序列
function lis(arr) {
  const p = arr.slice();
  const result = [0];
  let i;
  let j;
  let u;
  let v;
  let c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = ((u + v) / 2) | 0;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }

      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }

  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
