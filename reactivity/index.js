// 判定是否为对象（不为null）
const isObject = val => val !== null && typeof val === 'object'
// 判断属性值是否为对象，如果是，则要递归将其也转化为响应式对象
const convert = target => isObject(target) ? reactive(target) : target
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (target, key) => hasOwnProperty.call(target, key)

export function reactive(target) {
    // 判定传参是否为对象，如果不是直接返回
    if (!isObject(target)) return target

    const handler = {
        get(target, key, receiver) {
            // 收集依赖
            track(target, key)
            const result = Reflect.get(target, key, receiver)
            // 判断属性值是否为对象，如果是，则要递归将其也转化为响应式对象
            return convert(result)
        },
        set(target, key, value, receiver) {
            // 获取目标对象中对应属性值
            const oldValue = Reflect.get(target, key, receiver)
            // 在 set 中需要返回一个 boolean 类型的值标志是否赋值成功
            let result = true
            // 如果属性值不同
            if (oldValue !== value) {
                // 更新属性值，获取是否更新成功
                result = Reflect.set(target, key, value, receiver)
                // 触发更新
                trigger(target, key)
            }
            return result
        },
        deleteProperty(target, key) {
            // 判断是否有该属性名
            const hadKey = hasOwn(target, key)
            // 删除该属性，获取是否删除成功
            const result = Reflect.deleteProperty(target, key)
            if (hadKey && result) {
                // 触发更新
                trigger(target, key)
            }
            return result
        }
    }

    return new Proxy(target, handler)
}

// 定义一个全局变量用于记录 callback
let activeEffect = null

export function effect(callback) {
    // 记录 callback 函数
    activeEffect = callback
    // 调用 callback 函数
    callback()
    // 清空记录的 callback 函数
    activeEffect = null
}

// 定义一个 WeakMap 用于存储目标对象和 Map
let targetMap = new WeakMap()

export function track(target, key) {
    // 如果没有目标对象直接返回
    if (!activeEffect) return
    // 获取当前目标对象对应的 Map 对象
    let depsMap = targetMap.get(target)
    // 如果没有 Map 对象，则初始化一个 Map 对象
    if (!depsMap) {
        // 将 Map 对象 和目标对象存储在 WeakMap 中
        targetMap.set(target, (depsMap = new Map()))
    }
    // 获取 Map对象中属性名对应的值
    let dep = depsMap.get(key)
    // 如果属性值不存在，初始化一个 Set 对象作为属性值
    if (!dep) {
        // 将属性值和属性名存储在 Map 对象中
        depsMap.set(key, (dep = new Set()))
    }
    // 在属性值中添加回调事件
    dep.add(activeEffect)
}

export function trigger(target, key) {
    // 获取 WeakMap 中的目标对象对应的 Map 对象
    const depsMap = targetMap.get(target)
    // 如果不存在 Map 对象直接返回
    if (!depsMap) return
    // 获取 Map 对象中属性名对应的回调函数组
    const dep = depsMap.get(key)
    // 如果存在回调函数组
    if (dep) {
        // 遍历回调函数组
        dep.forEach(effect => {
            // 触发回调函数
            effect()
        })
    }
}

export function ref(raw) {
    // 判断raw是否是ref创建的对象，如果是的话直接返回
    if (isObject(raw) && raw.__v_isRef) return
    // 判断属性值是否为对象，如果是，则要递归将其也转化为响应式对象
    let value = convert(raw)
    const r = {
        __v_isRef: true,
        get value() {
            // 收集依赖
            track(r, 'value')
            return value
        },
        set value(newValue) {
            if (newValue !== value) {
                raw = newValue
                // 判断属性值是否为对象，如果是，则要递归将其也转化为响应式对象
                value = convert(raw)
                // 触发更新
                trigger(r, 'value')
            }
        }
    }
    return r
}

export function toRefs(proxy) {
    // 判断是否为数组
    const ret = proxy instanceof Array ? new Array(proxy.length) : {}
    for (const key in proxy) {
        // 将响应式对象的值都通过 ref 方法封装
        ret[key] = toProxyRef(proxy, key)
    }
    return ret
}

function toProxyRef(proxy, key) {
    const r = {
        // 标志是 ref 对象
        __v_isRef: true,
        get value() {
            return proxy[key]
        },
        set value(newValue) {
            proxy[key] = newValue
        }
    }
    return r
}

export function computed(getter) {
    // 默认value的值是undefined
    const result = ref()
    // 使用 effect 方法对象响应数据变化
    effect(() => (result.value = getter()))
    return result
}