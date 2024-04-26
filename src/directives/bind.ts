import { Directive } from '.'

const forceAttrRE = /^(spellcheck|draggable|form|list|type)$/

// Normalization:

const camelizeRE = /-(\w)/g
const hyphenateRE = /\B([A-Z])/g
const camelize = cacheStringFunction((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})
const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase(),
)

const isArray = Array.isArray
const isString = (val: unknown): val is string => typeof val === 'string'
const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

const listDelimiterRE = /;(?![^(]*\))/g
const propertyDelimiterRE = /:([^]+)/
const styleCommentRE = /\/\*[^]*?\*\//g

type NormalizedStyle = Record<string, string | number>

function parseStringStyle(cssText: string): NormalizedStyle {
  const ret: NormalizedStyle = {}
  cssText
    .replace(styleCommentRE, '')
    .split(listDelimiterRE)
    .forEach(item => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE)
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
      }
    })
  return ret
}

function normalizeStyle(
  value: unknown,
): NormalizedStyle | string | undefined {
  if (isArray(value)) {
    const res: NormalizedStyle = {}
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      const normalized = isString(item)
        ? parseStringStyle(item)
        : (normalizeStyle(item) as NormalizedStyle)
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isString(value) || isObject(value)) {
    return value
  }
}

function normalizeClass(value: unknown): string {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

// End of normalization

export const bind: Directive<Element & { _class?: string }> = ({
  el,
  get,
  effect,
  arg,
  modifiers
}) => {
  let prevValue: any

  // record static class
  if (arg === 'class') {
    el._class = el.className
  }

  effect(() => {
    let value = get()
    if (arg) {
      if (modifiers?.camel) {
        arg = camelize(arg)
      }
      setProp(el, arg, value, prevValue)
    } else {
      for (const key in value) {
        setProp(el, key, value[key], prevValue && prevValue[key])
      }
      for (const key in prevValue) {
        if (!value || !(key in value)) {
          setProp(el, key, null)
        }
      }
    }
    prevValue = value
  })
}

const setProp = (
  el: Element & { _class?: string },
  key: string,
  value: any,
  prevValue?: any
) => {
  if (key === 'class') {
    el.setAttribute(
      'class',
      normalizeClass(el._class ? [el._class, value] : value) || ''
    )
  } else if (key === 'style') {
    value = normalizeStyle(value)
    const { style } = el as HTMLElement
    if (!value) {
      el.removeAttribute('style')
    } else if (isString(value)) {
      if (value !== prevValue) style.cssText = value
    } else {
      for (const key in value) {
        setStyle(style, key, value[key])
      }
      if (prevValue && !isString(prevValue)) {
        for (const key in prevValue) {
          if (value[key] == null) {
            setStyle(style, key, '')
          }
        }
      }
    }
  } else if (
    !(el instanceof SVGElement) &&
    key in el &&
    !forceAttrRE.test(key)
  ) {
    // @ts-ignore
    el[key] = value
    if (key === 'value') {
      // @ts-ignore
      el._value = value
    }
  } else {
    // special case for <input v-model type="checkbox"> with
    // :true-value & :false-value
    // store value as dom properties since non-string values will be
    // stringified.
    if (key === 'true-value') {
      ;(el as any)._trueValue = value
    } else if (key === 'false-value') {
      ;(el as any)._falseValue = value
    } else if (value != null) {
      el.setAttribute(key, value)
    } else {
      el.removeAttribute(key)
    }
  }
}

const importantRE = /\s*!important$/

const setStyle = (
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[]
) => {
  if (isArray(val)) {
    val.forEach((v) => setStyle(style, name, v))
  } else {
    if (name.startsWith('--')) {
      // custom property definition
      style.setProperty(name, val)
    } else {
      if (importantRE.test(val)) {
        // !important
        style.setProperty(
          hyphenate(name),
          val.replace(importantRE, ''),
          'important'
        )
      } else {
        style[name as any] = val
      }
    }
  }
}
